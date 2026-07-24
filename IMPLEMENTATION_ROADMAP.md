# Implementation Roadmap

## Overview

This document provides a step-by-step roadmap for implementing the Node.js version of the Phylax Syslog Service. It's organized into phases, with each phase building on previous work.

**Timeline:** ~4-5 weeks (with 1-2 developers)  
**Effort:** ~160-200 hours

---

## Phase 1: Foundation & Infrastructure (Week 1)

### 1.1 Project Setup ✓
- [x] Initialize a Git repository
- [x] Create `package.json` with dependencies
- [x] Create `.env.example` with all configuration options
- [x] Setup `Dockerfile` and `docker-compose.yml`
- [x] Create `.gitignore` for Node.js
- [x] Install dev dependencies (eslint, prettier, jest)

**Deliverable:** Empty project structure, ready for development

### 1.2 Logging Infrastructure
- [x] Create `src/utils/logger.js`
  - Initialize Pino logger with formatting options
  - Support JSON output for production
  - Support pretty-print for development
  - Add child loggers with context (service name, component)
  - Log levels: trace, debug, info, warn, error, fatal

**Code Template:**
```javascript
// src/utils/logger.js
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' }
    : undefined,
});

export default logger;
export const getLogger = (name) => logger.child({ component: name });
```

### 1.3 Configuration Management
- [x] Create `src/config.js`
  - Load all environment variables
  - Validate all settings (types, ranges, required fields)
  - Create/verify log directory
  - Log all settings on startup
  - Export configuration object

**Key Settings to Validate:**
- Port numbers (1-65535)
- File size limits (> 1 MB)
- Timing values (> 0)
- Directory paths (readable/writable)

**Deliverable:** Clean startup with valid configuration or clear error messages ✓

---

## Phase 2: Core Syslog Processing (Week 2)

### 2.1 RFC 3164 Message Parser
- [x] Create `src/syslog/syslogMessage.js`
  - Enums: `SyslogFacility`, `SyslogLevel`
  - Parse RFC 3164 format (priority, date, hostname, tag, message)
  - Fallback parsing for Phylax extended format (ISO 8601)
  - Fallback to the raw message if parsing fails
  - Convert to/from string representations

**Test Cases:**
```
1. Valid RFC 3164: "<14>Jul 24 10:30:45 server01 MyApp: Hello"
2. Phylax format: "<14>2024-07-24 10:30:45,123 server01 MyApp Message"
3. Invalid (no priority): "Jul 24 10:30:45 server01 MyApp: Hello"
4. Priority extraction: Facility, Level, Priority value
```

**Tests:** `test/syslogMessage.test.js` ✓

### 2.2 UDP Listener
- [x] Create `src/syslog/syslogService.js`
  - Create a UDP socket on port 514
  - Handle incoming datagrams
  - Parse each message
  - Route to logger based on hostname/facility
  - Implement periodic flush (every 5 seconds)
  - Graceful error handling

**Interface:**
```javascript
class SyslogService {
  start()                    // Start listening
  stop()                     // Stop gracefully
  getOrCreateLogger(name)    // Get/create logger
  flush()                    // Flush all loggers
}
```

**Tests:** 
- Start/stop service ✓
- Receive a message ✓
- Error handling ✓

### 2.3 Async Work Queue
- [x] Create `src/utils/workQueue.js`
  - Queue-based task processor (FIFO)
  - Async/await support
  - Error handling per task
  - Graceful shutdown

**Interface:**
```javascript
class WorkQueue {
  enqueue(asyncTask)         // Add task
  start()                    // Start processing
  stop()                     // Stop gracefully
  isProcessing()            // Check status
}
```

**Deliverable:** Can receive syslog messages via UDP (but not write yet) ✓

---

## Phase 3: File Storage & Rotation (Week 2-3)

### 3.1 Logger Implementation
- [x] Create `src/syslog/syslogLogger.js`
  - One logger per hostname/facility
  - Buffer messages in memory
  - Flush buffer to file via work queue
  - Detect date changes (daily rotation)
  - Detect file size limits (periodic rotation)
  - Rename files with timestamps

**Key Logic:**
```javascript
class SyslogLogger {
  constructor(settings, name)
  
  log(message)              // Queue message
  flush()                   // Flush buffer to file
  _checkRotation()          // Check for daily/size rotation
  _rotateFile()             // Rename and start new file
  stop()                    // Cleanup
}
```

**File Naming:**
- Active: `/logs/hostname.log`
- Rotated: `/logs/hostname.2024-07-24.log`
- Compressed: `/logs/hostname.2024-07-24.log.zip`

**Tests:**
- Message writing ✓
- Daily rotation ✓
- Size-based rotation ✓
- File renaming ✓
- Path sanitization (no traversal) ✓

### 3.2 Compression Handler
- [x] Create `src/syslog/logZipper.js`
  - Async compression using Archiver
  - Queue-based job processing
  - Delete original after compression
  - Error handling

**Interface:**
```javascript
class LogZipper {
  start()                        // Start processing
  stop()                         // Stop gracefully
  queueForCompression(filePath)  // Queue file to zip
}
```

**Tests:**
- Compress file ✓
- Verify zip contents ✓
- Delete original ✓
- Error handling ✓

### 3.3 Integration
- [x] Update `SyslogService` to use real `SyslogLogger`
- [x] Update `SyslogLogger` to queue compression
- [x] Test end-to-end: message → file → rotation → compression

**Deliverable:** Messages written to files with automatic rotation and compression ✓

---

## Phase 4: Application Lifecycle (Week 3)

### 4.1 Application Main Entry Point
- [x] Create `src/index.js`
  - Load configuration
  - Initialize services
  - Start services in order
  - Handle graceful shutdown (SIGTERM, SIGINT)
  - Log startup/shutdown events

**Startup Sequence:**
```
1. Load config
2. Initialize logger
3. Create SyslogService
4. Create LogZipper
5. Start WorkQueue
6. Start LogZipper
7. Start SyslogService
8. Log "Service started"
```

**Shutdown Sequence:**
```
1. Receive SIGTERM/SIGINT
2. Stop SyslogService
3. Flush all loggers
4. Stop LogZipper
5. Stop WorkQueue
6. Log "Service stopped"
7. Exit process
```

### 4.2 Error Handling
- [x] Global exception handler
  - Catch unhandled exceptions
  - Log with full stack trace
  - Attempt a graceful shutdown
  - Exit with error code

### 4.3 Testing
- [x] Create `test/integration.test.js`
  - Start service
  - Send test messages
  - Verify files created
  - Verify rotation triggers
  - Verify shutdown

**Deliverable:** Complete working service ✓

---

## Phase 5: Optional Features (Week 4)

### 5.1 Heartbeat Sender (Optional)
- [ ] Create `src/heartbeat/heartbeatSender.js`
  - Send UDP heartbeat every 5 seconds (configurable)
  - Format: "YYYY-MM-DD HH:mm:ss hostname version Syslog:Ok"
  - Include service state
  - Only if `HEARTBEAT_ENABLED=true`

**Tests:**
- Heartbeat format
- Sending frequency
- State changes

### 5.2 Day-Switch Handler (Optional)
- [ ] Create `src/utils/daySwitchChecker.js`
  - Check for date changes every second
  - Trigger log files update at midnight
  - Use node-cron or setInterval

### 5.3 Delay Checking (Advanced)
- [ ] Implement message delay detection
  - Compare `receptionTime - creationTime`
  - Compare `now - receptionTime`
  - Log warnings for slow messages
  - Skip checks for configured logger names

**Deliverable:** Enhanced monitoring features

---

## Phase 6: Testing & Documentation (Week 4-5)

### 6.1 Unit Tests
- [ ] `test/syslogMessage.test.js` (RFC 3164 parsing)
  - Valid messages
  - Invalid formats
  - Fallback parsing
  - Encoding handling

- [ ] `test/config.test.js` (Configuration)
  - Load from env
  - Validate settings
  - Missing required vars

- [ ] `test/workQueue.test.js` (Async queue)
  - Task execution order
  - Error handling
  - Graceful shutdown

**Target:** >80% code coverage

### 6.2 Integration Tests
- [ ] `test/integration.test.js`
  - Start service
  - Send messages
  - Verify file creation
  - Verify rotation
  - Verify compression
  - Verify shutdown

### 6.3 Load Testing
- [ ] Send 10,000+ messages/sec
  - Verify no message loss
  - Monitor memory usage
  - Monitor CPU usage
  - Check file integrity

### 6.4 Documentation
- [ ] Update ARCHITECTURE.md with actual implementation notes
- [ ] Create API documentation
- [ ] Create a troubleshooting guide
- [ ] Create a deployment checklist

**Deliverable:** Well-tested, documented, production-ready service

---

## Phase 7: Docker & Deployment (Week 5)

### 7.1 Docker Image
- [ ] Test Dockerfile
  - Multi-stage build
  - Non-root user
  - Health checks
  - Image size < 200 MB

### 7.2 Docker Compose
- [ ] Test docker-compose.yml
  - Volume mounting
  - Environment variables
  - Port mapping
  - Resource limits

### 7.3 Deployment Guide
- [ ] Document deployment steps
- [ ] Create example configurations
- [ ] Document monitoring setup
- [ ] Create backup/restore procedures

### 7.4 Performance Tuning
- [ ] Optimize message parsing
- [ ] Optimize file I/O
- [ ] Optimize compression
- [ ] Memory profiling

**Deliverable:** Production-ready Docker deployment

---

## Development Workflow

### Setup Development Environment
```bash
# Clone
git clone <repo>
cd phylax-syslog-service

# Install
npm install

# Create config
cp .env.example .env
nano .env  # Edit if needed

# Run tests
npm test

# Start service
npm start

# In another terminal, send test message
echo "<14>Jul 24 10:30:45 server01 MyApp: Hello" | nc -u 127.0.0.1 514
```

### Daily Development Cycle
```bash
# Watch for changes and auto-reload
npm run dev

# Run tests in watch mode
npm run test:watch

# Format code
npm run lint:fix

# Build Docker image
npm run docker:build

# Test in Docker
npm run docker:run
```

### Code Review Checklist
- [ ] Follows linting rules (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Code coverage > 80%
- [ ] Handles errors gracefully
- [ ] No hardcoded values (use config)
- [ ] Logs important events
- [ ] Updated relevant docs

---

## Success Criteria

### Phase 1 ✓ (Complete)
- [x] Project structure created
- [x] Documentation written
- [x] Logger infrastructure implemented
- [x] Configuration management implemented

### Phase 2 ✓ (Complete)
- [x] Receive syslog messages via UDP
- [x] Parse RFC 3164 format correctly
- [x] Parse Phylax extended format (ISO 8601)
- [x] Async work queue implemented
- [x] Unit tests for all components

### Phase 3 ✓ (Complete)
- [x] Write messages to files
- [x] Rotate files by date and size
- [x] Compress rotated files
- [x] Path sanitization for security
- [x] Integration testing working

### Phase 4 ✓ (Complete)
- [x] Service starts/stops gracefully
- [x] Handles signals (SIGTERM, SIGINT)
- [x] Logs all important events
- [x] 41 tests passing (41/41)
- [x] Code coverage: 68.63%
- [x] Linting: 100% passing

### Phase 5 (Optional)
- [ ] Heartbeat working (if enabled)
- [ ] Delay checking working
- [ ] Day-switch handling working

### Phase 6
- [x] Unit tests created (config, syslogMessage, workQueue)
- [x] Integration tests created
- [x] Code coverage at 68.63%
- [ ] Load tests passing (10k+ msg/sec)
- [ ] Complete documentation

### Phase 7
- [ ] Docker image builds successfully
- [ ] Docker Compose works
- [ ] Production deployment guide complete
- [ ] Performance optimized

---

## Known Challenges & Mitigations

### Challenge: Single-threaded Event Loop
- **Issue:** Node.js is single-threaded; can become CPU-bound with very high message rates
- **Mitigation:** Use async I/O, batch writes, consider Worker Threads for compression

### Challenge: RFC 3164 Date Parsing
- **Issue:** RFC 3164 doesn't include year; must infer from the current date
- **Mitigation:** Use strict date validation, log warnings for anomalies

### Challenge: File Rotation Consistency
- **Issue:** Multiple loggers competing for disk I/O during rotation
- **Mitigation:** Use work queue for sequential processing, careful locking

### Challenge: Zero-Downtime Updates
- **Issue:** Graceful shutdown must flush all messages to disk
- **Mitigation:** Implement graceful shutdown with timeout, health checks

---

## Next Steps

1. **Load Testing:** Test with 10,000+ messages/sec to verify no message loss
2. **Optional Features:** Implement heartbeat sender if needed
3. **Docker Deployment:** Build and test Docker image
4. **Performance Tuning:** Optimize message parsing and file I/O
5. **Documentation:** Create deployment guide and troubleshooting guide

---

## Resources

- **RFC 3164:** https://tools.ietf.org/html/rfc3164
- **Node.js Docs:** https://nodejs.org/docs/
- **Pino Logger:** https://getpino.io/
- **Archiver:** https://www.archiverjs.com/
- **Jest Testing:** https://jestjs.io/

---

**Last Updated:** 2026-07-24  
**Status:** Phases 1–4 Complete! Core functionality working.  
**Tests:** 41/41 passing (100%)  
**Coverage:** 68.63%  
**Linting:** 100% passing  
**Next Review:** After load testing and optional features
