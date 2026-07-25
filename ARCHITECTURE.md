# Phylax Syslog Service - Node.js Architecture & Design

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Design](#component-design)
4. [Data Flow](#data-flow)
5. [Configuration](#configuration)
6. [Deployment](#deployment)
7. [Development Guide](#development-guide)
8. [Migration Notes](#migration-notes)

---

## Overview

**Phylax Syslog Service** is a containerized syslog message receiver, processor, and logger that:
- Listens for syslog messages via UDP/TCP (RFC 3164)
- Parses and routes messages to per-logger files
- Automatically rotates log files based on size and date
- Compresses old log files to ZIP archives
- Sends heartbeat monitoring messages
- Supports day-switch triggered cleanup

**Technology Stack:**
- **Runtime:** Node.js 24+
- **Deployment:** Docker / Docker Compose
- **Configuration:** Environment variables (.env)
- **Logging:** Pino (structured JSON logging)
- **Compression:** Archiver (ZIP)
- **Scheduling:** node-cron (scheduled tasks)

---

## Architecture

### High-Level System Design

```
┌────────────────────────────────────────────────────────────┐
│                  Phylax Syslog Service                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐                                          │
│  │  UDP/TCP    │  Receives syslog datagrams              │
│  │  Listener   │  Port: 514 (RFC 3164)                   │
│  └─────┬───────┘                                          │
│        │                                                  │
│        ▼                                                  │
│  ┌──────────────────────┐                               │
│  │ Syslog Message       │ Parses RFC 3164 format       │
│  │ Parser               │ Extracts: facility, level,   │
│  └──────┬───────────────┘ hostname, timestamp, text    │
│         │                                               │
│         ▼                                               │
│  ┌──────────────────────┐                              │
│  │ Syslog Logger        │ Routes to per-logger files  │
│  │ Registry             │ Creates logger on demand    │
│  └─┬──────────────┬──────┘                            │
│    │              │                                    │
│    ▼              ▼                                    │
│  ┌────────────┐ ┌────────────┐  ┌────────────┐       │
│  │  Logger 1  │ │  Logger 2  │  │  Logger N  │       │
│  │  (Queued   │ │  (Queued   │  │  (Queued   │       │
│  │   I/O)     │ │   I/O)     │  │   I/O)     │       │
│  └────┬───────┘ └────┬───────┘  └────┬───────┘       │
│       │              │               │                │
│       └──────────────┼───────────────┘                │
│                      │                                │
│  ┌───────────────────▼────────────────┐              │
│  │  Async Work Queue                  │              │
│  │  (File I/O + Rotation + ZIP)       │              │
│  └───────────────────┬────────────────┘              │
│                      │                                │
│  ┌───────────────────▼────────────────┐              │
│  │  Log File System                   │              │
│  │  /logs/hostname.log                │              │
│  │  /logs/hostname.log.1.zip (rotated)│              │
│  └────────────────────────────────────┘              │
│                                                      │
│  ┌────────────────────────────────────┐             │
│  │ Heartbeat Sender (optional)        │             │
│  │ Sends monitoring message every 5s  │             │
│  └────────────────────────────────────┘             │
│                                                      │
└────────────────────────────────────────────────────────┘
```

### Component Layering

```
┌─────────────────────────────────────────┐
│     Application Layer (index.js)        │
│  - Startup/Shutdown orchestration       │
│  - Process lifecycle management         │
└─────────────────────────────────────────┘
           ▲             ▲
           │             │
┌──────────┴─────┐  ┌────┴──────────┐
│ Syslog Layer   │  │ Optional:     │
│ (UDP/TCP)      │  │ Heartbeat     │
│ - Listener     │  │ - Sender      │
│ - Parser       │  └───────────────┘
│ - Router       │
└────┬───────────┘
     │
┌────▼──────────────────────┐
│  Storage Layer            │
│  - Syslog Logger (async)  │
│  - Log Rotation           │
│  - Compression (ZIP)      │
└────┬──────────────────────┘
     │
┌────▼──────────────────────┐
│  Infrastructure Layer      │
│  - Config (env vars)       │
│  - Logging (pino)          │
│  - Work Queue              │
└────────────────────────────┘
```

---

## Component Design

### 1. **Syslog Listener** (`src/syslog/syslogService.js`)

**Responsibility:** Receive UDP/TCP syslog messages

**Key Features:**
- Listens on port 514 (configurable)
- Handles multiple concurrent UDP datagrams
- Routes messages to `SyslogLogger` instances
- Maintains a registry of active loggers
- Periodic flush of all loggers (default: 5s)

**Interface:**
```javascript
class SyslogService {
  start()              // Start listening on port
  stop()               // Stop listening
  handleMessage(msg)   // Handle incoming syslog message
  flush()              // Flush all loggers
  getOrCreateLogger(name)  // Get/create logger by name
}
```

**Thread-Safety:**
- Use Map for a thread-safe logger registry
- All file I/O are async (non-blocking)

---

### 2. **Syslog Message Parser** (`src/syslog/syslogMessage.js`)

**Responsibility:** Parse RFC 3164 syslog format

**RFC 3164 Format:**
```
<PRI>Mmm dd hh:mm:ss HOSTNAME TAG: MESSAGE
       ▲
       └─ Priority = (Facility << 3) | Level
       
Example:
<14>Mar 17 13:30:45 server01 MyApp: Starting process
```

**Parsing Logic:**
1. Extract `<PRI>` → Facility + Level
2. Parse date/time (with year inference from the current date)
3. Extract hostname (first word after timestamp)
4. Extract tag/instance name (word between hostname and colon)
5. The remainder is message text

**Fallback Parsing:**
- If RFC 3164 fails → Try ISO 8601 format (Phylax extension)
- If both fail → Treat the entire string as a message

**Key Methods:**
```javascript
class SyslogMessage {
  constructor(facility, level, timestamp, hostname, instanceName, sequenceNumber, text)
  
  static parseFromUDP(senderAddress, buffer)  // Parse from raw UDP data
  
  toString(format)                             // Serialize to string
  getFacilityName()                           // Get facility name
  getLevelName()                              // Get level name
}
```

---

### 3. **Syslog Logger** (`src/syslog/syslogLogger.js`)

**Responsibility:** Write syslog messages to individual log files

**Key Features:**
- One logger per `hostname` or `facility`
- Async file I/O via work queue
- Automatic file rotation on:
  - **Size limit** (e.g., 50 MB)
  - **Daily rollover** (midnight)
- Delay checking (optional) for message freshness
- State tracking (Ok, Error, Inactive)

**File Naming Convention:**
```
/logs/
  ├── server01.log              (current day, uncompressed)
  ├── server01.2024-07-23.log   (previous day, not yet compressed)
  ├── server01.2024-07-22.log.zip  (compressed archive)
  ├── server02.log
  └── ...
```

**Rotation Algorithm:**
```
1. Check message timestamp
2. If date differs from last write date:
   a. Flush current file
   b. Rename current file with date: "name.YYYY-MM-DD.log"
   c. Queue file for compression
   d. Open new file "name.log"
3. Check file size
4. If size > limit:
   a. Rotate to numbered file: "name.YYYY-MM-DD.log.1"
   b. Open new file "name.log"
   c. Queue old file for compression
```

**Delay Checking:**
- Compare: `receptionTime - creationTime`
- If exceeds `maxProcessingDelay` → log warning
- Ignore delay check for specific logger names (e.g., "MessageRecorder")

**Interface:**
```javascript
class SyslogLogger {
  log(syslogMessage)        // Queue message for writing
  flush()                   // Flush buffer to disk
  stop()                    // Cleanup and close
  getState()                // Return ServiceState
}
```

---

### 4. **Log Zipper** (`src/syslog/logZipper.js`)

**Responsibility:** Compress rotated log files

**Key Features:**
- Async work queue for compression
- Handles multiple zip jobs concurrently
- Deletes original after successful compression
- Error handling (logs errors, doesn't crash)
- Cleanup of old archives (configurable retention)

**Compression Logic:**
```
1. Receives path to .log file to compress
2. Creates .zip with same basename
3. Adds .log file to zip archive
4. Closes and finalizes zip
5. Deletes original .log file
6. Logs completion
```

**Interface:**
```javascript
class LogZipper {
  start()                           // Start processing queue
  stop()                            // Stop queue gracefully
  queueForCompression(filePath)     // Queue a file for zipping
  cleanupOldArchives(daysRetention) // Remove archives older than N days
}
```

---

### 5. **Configuration Manager** (`src/config.js`)

**Responsibility:** Load and validate environment configuration

**Environment Variables (.env):**
```bash
# Server
NODE_ENV=production
LOG_LEVEL=debug

# Syslog Service
SYSLOG_PORT=514
SYSLOG_UDP_BUFFER_SIZE=81920
SYSLOG_FLUSH_INTERVAL=5000

# Log Storage
SYSLOG_LOG_DIR=/logs
SYSLOG_FILE_SIZE_LIMIT=52428800        # 50 MB
SYSLOG_UNZIPPED_FILE_SIZE_LIMIT=5242880  # 5 MB
SYSLOG_DATE_TIME_FORMAT=yyyy-MM-dd HH:mm:ss.fff

# Delay Checking
SYSLOG_MAX_PROCESSING_DELAY=10000      # 10 seconds
SYSLOG_MAX_RECEPTION_DELAY=2000        # 2 seconds
SYSLOG_NO_DELAY_CHECK_LOGGERS=

# Day Switch
SYSLOG_DAY_SWITCH_MESSAGE_DELAY=15000  # 15 seconds

# Heartbeat (optional)
HEARTBEAT_ENABLED=false
HEARTBEAT_PORT=11514
HEARTBEAT_INTERVAL=5000
HEARTBEAT_DESTINATION=127.0.0.1
```

**Validation:**
- Check required directories exist (create if not)
- Validate port numbers (1-65535)
- Validate file size limits (> 1 MB)
- Validate all numeric values

**Interface:**
```javascript
class Config {
  static load()           // Load from environment
  static validate()       // Validate configuration
  static get(key)        // Get config value by key
}
```

---

### 6. **Heartbeat Sender** (`src/heartbeat/heartbeatSender.js`) - Optional

**Responsibility:** Send periodic monitoring heartbeats

**Heartbeat Message Format:**
```
YYYY-MM-DD HH:mm:ss hostname version Syslog:Ok AcgLog:Inactive AcgStat:Inactive
```

**Features:**
- Sends via UDP every 5 seconds (configurable)
- Includes service state summary
- Retrieves hostname dynamically
- Handles DNS errors gracefully

**Interface:**
```javascript
class HeartbeatSender {
  start()   // Start sending heartbeats
  stop()    // Stop sending
}
```

---

### 7. **Async Work Queue** (`src/utils/workQueue.js`)

**Responsibility:** Execute async tasks sequentially

**Design Pattern:** Producer-Consumer with queue

**Features:**
- Single-threaded execution (no parallel jobs)
- Graceful shutdown (finish in-flight jobs)
- Error handling per job
- Simple API

**Interface:**
```javascript
class WorkQueue {
  enqueue(asyncTask)      // Add task to queue
  start()                 // Start processing
  stop()                  // Stop gracefully
  isProcessing()          // Check if busy
}
```

---

## Data Flow

### Message Reception to Disk

```
UDP Datagram (from network)
  ↓
[SyslogService] receives on port 514
  ↓
[SyslogMessage.parseFromUDP()] parses RFC 3164 format
  ↓
Extract: facility, level, hostname, instanceName, text, timestamp
  ↓
[SyslogService.getOrCreateLogger(instanceName || facility)]
  ↓
[SyslogLogger.log(message)] 
  → Queues message to buffer
  → Checks for day rollover / size limit
  → If yes: rotate file, queue old file for compression
  ↓
[WorkQueue] processes async tasks:
  1. Write buffered messages to file
  2. Compress rotated files (via Archiver)
  3. Delete original files
  ↓
Disk: /logs/hostname.log (or .zip)
```

### File Rotation Flow

**Size-Based Rotation:**
```
message arrives
  ↓
Check: currentFileSize + message.size > LIMIT?
  ↓ YES
Rename: name.log → name.YYYY-MM-DD.log.1
Queue compression of old file
Create new: name.log
  ↓
Write message to new file
```

**Date-Based Rotation (Midnight):**
```
message.timestamp.date != lastWriteDate?
  ↓ YES
Flush current file
Rename: name.log → name.YYYY-MM-DD.log
Queue compression
Create new: name.log
  ↓
Write message to new file
```

### Startup & Shutdown Sequence

**Startup:**
```
index.js main()
  ↓
Config.load() and Config.validate()
  ↓
Logger.init() (pino setup)
  ↓
Create SyslogService instance
  ↓
Create LogZipper instance
  ↓
Create HeartbeatSender instance (if enabled)
  ↓
WorkQueue.start()
LogZipper.start()
SyslogService.start()
HeartbeatSender.start() (optional)
  ↓
Log: "Syslog service started"
```

**Shutdown (SIGTERM / SIGINT):**
```
Signal received
  ↓
HeartbeatSender.stop()
SyslogService.stop()
  → Stop UDP listener
  → Flush all loggers
  → Close all log files
  ↓
LogZipper.stop()
  → Finish in-flight compression jobs
  → Empty queue
  ↓
WorkQueue.stop()
  ↓
Log: "Syslog service stopped"
Exit process
```

---

## Configuration

### Environment Variables (.env)

Create `.env` file in project root:

```bash
# Node.js
NODE_ENV=production
LOG_LEVEL=info

# Syslog Service
SYSLOG_PORT=514
SYSLOG_UDP_BUFFER_SIZE=81920

# Log Storage
SYSLOG_LOG_DIR=/logs
SYSLOG_FILE_SIZE_LIMIT=52428800        # 50 MB
SYSLOG_UNZIPPED_FILE_SIZE_LIMIT=5242880  # 5 MB (for internal check)

# Timestamps
SYSLOG_DATE_TIME_FORMAT=yyyy-MM-dd HH:mm:ss.fff

# Timing
SYSLOG_FLUSH_INTERVAL=5000             # 5 seconds
SYSLOG_DAY_SWITCH_MESSAGE_DELAY=15000  # 15 seconds

# Message Quality Checks
SYSLOG_MAX_PROCESSING_DELAY=10000      # 10 seconds (receptionTime - creationTime)
SYSLOG_MAX_RECEPTION_DELAY=2000        # 2 seconds
SYSLOG_NO_DELAY_CHECK_LOGGERS=

# Heartbeat (optional)
HEARTBEAT_ENABLED=false
HEARTBEAT_PORT=11514
HEARTBEAT_INTERVAL=5000
HEARTBEAT_DESTINATION=127.0.0.1
```

### Docker Environment

In `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=production
  - LOG_LEVEL=info
  - SYSLOG_PORT=514
  - SYSLOG_LOG_DIR=/var/log/syslog
  - SYSLOG_FILE_SIZE_LIMIT=52428800
  # ... more vars
```

---

## Deployment

### Docker Setup

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY .env .env

# Create log directory
RUN mkdir -p /var/log/syslog

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('net').createConnection({port: 514}, ()=>process.exit(0)).on('error', ()=>process.exit(1))"

CMD ["node", "src/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  syslog:
    build: .
    ports:
      - "514:514/udp"
    volumes:
      - syslog-logs:/var/log/syslog
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - SYSLOG_LOG_DIR=/var/log/syslog
    restart: unless-stopped

volumes:
  syslog-logs:
```

**Build & Run:**
```bash
docker-compose build
docker-compose up -d
docker-compose logs -f
```

---

## Development Guide

### Project Structure

```
phylax-syslog-service/
├── src/
│   ├── index.js                 # Entry point
│   ├── config.js                # Configuration loader
│   ├── syslog/
│   │   ├── syslogService.js     # UDP listener
│   │   ├── syslogMessage.js     # RFC 3164 parser
│   │   ├── syslogLogger.js      # Per-logger file writer
│   │   └── logZipper.js         # Compression handler
│   ├── heartbeat/
│   │   └── heartbeatSender.js   # Monitoring (optional)
│   └── utils/
│       ├── logger.js             # Pino logging setup
│       └── workQueue.js          # Async task queue
├── test/
│   ├── syslogMessage.test.js    # Parser tests
│   ├── syslogService.test.js    # Service tests
│   └── integration.test.js      # E2E tests
├── .env.example                 # Configuration template
├── package.json
├── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.md              # This file
└── README.md                    # Quick start guide
```

### Development Workflow

1. **Setup:**
   ```bash
   npm install
   cp .env.example .env
   ```

2. **Run Locally:**
   ```bash
   npm start
   ```

3. **Testing:**
   ```bash
   npm test                 # Run all tests
   npm run test:watch      # Watch mode
   ```

4. **Linting:**
   ```bash
   npm run lint            # ESLint
   npm run lint:fix        # Auto-fix
   ```

5. **Sending Test Syslog Messages:**
   ```bash
   # From another terminal
   echo "<14>Jul 24 10:30:45 testhost TestApp: This is a test message" | nc -u 127.0.0.1 514
   ```

### Testing Strategy

**Unit Tests (per component):**
- `SyslogMessage.parseFromUDP()` → various RFC 3164 formats
- `SyslogLogger` → file rotation logic
- `Config.validate()` → environment validation

**Integration Tests:**
- Start service → Send message → Verify file written
- Trigger rotation → Verify compression queued
- Shutdown → Verify graceful cleanup

**Manual Testing:**
```bash
# Terminal 1: Start service
npm start

# Terminal 2: Send test syslog messages
for i in {1..10}; do
  echo "<14>Jul 24 10:30:$i testhost TestApp: Message $i" | nc -u 127.0.0.1 514
done

# Terminal 3: Monitor logs
tail -f logs/testhost.log
```

---

## Migration Notes

### From C# to Node.js

**Direct Port Mapping:**
| C# Component | Node.js Equivalent |
|---|---|
| `SyslogMessage.cs` | `syslogMessage.js` |
| `SyslogService.cs` | `syslogService.js` |
| `SyslogLogger.cs` | `syslogLogger.js` |
| `SyslogLogZipper.cs` | `logZipper.js` |
| `TmcsSyslogApplication.cs` | `index.js` + orchestration |
| `app.config` | `.env` file |
| `log4net` | `pino` |
| `SharpZipLib` | `archiver` npm |
| `Timer` | `setInterval()` or `node-cron` |
| `UdpListener` | `dgram.createSocket()` |

**Removed Components (Not Needed):**
- ❌ Windows Service (use Docker instead)
- ❌ ACG Integration (`AcgLogService.cs`, `AcgIniFileSettings.cs`)
- ❌ ProjectInstaller (Windows-specific)
- ❌ Heartbeat (optional, can be re-added later)

**Improved/Simplified:**
- ✅ No app.config complexity → simple .env
- ✅ No .NET Framework dependency
- ✅ Platform-independent (Linux/macOS/Windows)
- ✅ Containerized from day 1
- ✅ Modern async/await patterns

### Known Differences

1. **Single Process vs. Thread Pool:**
   - C#: Uses threads (concurrent I/O)
   - Node.js: Single-threaded event loop (async I/O)
   - **Impact:** Similar performance, different concurrency model

2. **File I/O:**
   - C#: Buffered writes with Timer flushing
   - Node.js: Async writes via WorkQueue
   - **Impact:** More predictable backpressure handling

3. **Error Handling:**
   - C#: Checked exceptions + log4net configuration
   - Node.js: Try-catch + pino structured logging
   - **Impact:** Simpler, more explicit error flows

4. **Configuration:**
   - C#: XML-based app.config + Properties designer
   - Node.js: Environment variables (.env)
   - **Impact:** Simpler, more Docker-friendly

---

## Performance Considerations

### Throughput Targets

- **Expected:** 10,000+ messages/sec per service instance
- **File I/O:** Async, batched writes (flush every 5s)
- **Compression:** Background task, non-blocking
- **Memory:** ~50-100 MB for service + buffers

### Optimization Opportunities

1. **Message Buffering:** Batch writes (every N messages or 5s, whichever first)
2. **File Pooling:** Reuse file handles for active loggers
3. **Compression Scheduling:** Run during low-traffic periods (e.g., 02:00 AM)
4. **Worker Threads:** Future: Use `worker_threads` for CPU-intensive compression

### Monitoring

**Metrics to Track:**
- Messages/sec received
- Active logger count
- Pending work queue size
- File rotation frequency
- Compression job duration
- Service state (Ok, Error, Inactive)

---

## Security & Reliability

### Input Validation

- ✅ RFC 3164 format validation
- ✅ Hostname/port range checks
- ✅ File path sanitization (no path traversal)
- ✅ Message size limits (UDP < 64KB)

### Error Handling

- ✅ Graceful degradation on parse errors
- ✅ Async error handling (don't crash on file I/O errors)
- ✅ Signal handlers for clean shutdown (SIGTERM, SIGINT)
- ✅ Health check endpoint (optional)

### Reliability

- ✅ Automatic log rotation
- ✅ Automatic compression
- ✅ Old file cleanup
- ✅ Delay detection (message freshness)
- ✅ State tracking per logger

---

## References

- **RFC 3164:** The BSD syslog Protocol
- **Node.js UDP:** https://nodejs.org/api/dgram.html
- **Pino Logger:** https://getpino.io/
- **Archiver:** https://www.archiverjs.com/
