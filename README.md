# Phylax Syslog Service

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](## 📄 License)

Containerized syslog message receiver with RFC 3164 compliance, automatic log rotation, and compression. Receives syslog messages via UDP, routes them to per-logger files, and handles automatic file rotation and ZIP compression.

> A production-ready Node.js implementation of the Phylax Syslog Service (originally written in C#)

---

## 🚀 Quick Start

### Local Development

```bash
# Clone and setup
git clone <repo>
cd phylax-syslog-service
npm install

# Configure (copy and adjust as needed)
cp .env.example .env

# Start the service
npm start

# Send test message (from another terminal)
echo "<14>Jul 24 10:30:45 testhost MyApp: Hello World" | nc -u 127.0.0.1 514

# View logs
tail -f logs/testhost.log
```

### Docker Deployment

```bash
# Configure (copy template and adjust as needed)
cp .env.example .env

# For production, edit .env and set:
#   NODE_ENV=production
#   SYSLOG_LOG_DIR=/var/log/syslog
#   HEARTBEAT_ENABLED=true (recommended)

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

> **Note 1:** The service logs use **local time** by default. For Docker, the timezone is set via the `TZ` environment variable in `.env`. See [DOCKER_TIMEZONE.md](DOCKER_TIMEZONE.md) for detailed configuration options.

> **Note 2:** All configuration comes from the `.env` file. The `.env.example` template includes setup guides for all scenarios (local dev, docker dev, docker production). See [ENV_CONSOLIDATION_SUMMARY.md](ENV_CONSOLIDATION_SUMMARY.md) for details.

---

## ✨ Features

- **RFC 3164 Compliant** — Full support for standard syslog format
- **Per-Logger File Routing** — Separate log files per hostname/facility
- **Automatic Rotation** — Daily rollover and size-based rotation
- **Compression** — ZIP archives for archived logs
- **Async Processing** — Non-blocking I/O via work queue
- **Structured Logging** — JSON logs via Pino
- **Docker Ready** — Production-grade container setup
- **Configurable** — Environment-based configuration
- **Health Checks** — Built-in service health monitoring
- **Graceful Shutdown** — Clean process termination with flushing

---

## 📋 System Requirements

- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Docker:** 20.x (optional, for containerization)
- **UDP Port:** 514 (configurable)

---

## 📦 Installation

### npm Install

```bash
npm install
```

### Dependencies

- **pino** — Structured JSON logging
- **archiver** — ZIP compression
- **dotenv** — Environment configuration
- **node-cron** — Scheduled tasks
- **ini** — INI file parsing

---

## ⚙️ Configuration

Configure the service using environment variables in `.env`:

```bash
# Server
NODE_ENV=production
LOG_LEVEL=info

# Syslog Service
SYSLOG_PORT=514                        # Listen port
SYSLOG_UDP_BUFFER_SIZE=81920           # UDP buffer size

# Log Storage
SYSLOG_LOG_DIR=./logs                  # Log directory
SYSLOG_FILE_SIZE_LIMIT=52428800        # 50 MB per file
SYSLOG_FLUSH_INTERVAL=5000             # 5 seconds

# Message Quality Checks (optional)
SYSLOG_MAX_PROCESSING_DELAY=10000      # 10 seconds
SYSLOG_NO_DELAY_CHECK_LOGGERS=

# Heartbeat (optional)
HEARTBEAT_ENABLED=false
HEARTBEAT_PORT=11514
HEARTBEAT_INTERVAL=5000
```

See `.env.example` for complete configuration options.

---

## 🏗️ Architecture

```
UDP Listener (514)
    ↓
RFC 3164 Parser
    ↓
Syslog Logger (per hostname/facility)
    ↓
Async Work Queue
    ↓
File I/O + Rotation + Compression
    ↓
/logs/hostname.log (and .zip archives)
```

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 🧪 Development

### Available Scripts

```bash
# Start service
npm start

# Start with auto-reload (development)
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format

# Docker commands
npm run docker:build
npm run docker:run
npm run docker:logs
npm run docker:stop

# Health check
npm run healthcheck
```

### Sending Test Syslog Messages

```bash
# Single message
echo "<14>Jul 24 10:30:45 server01 TestApp: Hello" | nc -u 127.0.0.1 514

# Multiple messages (10)
for i in {1..10}; do
  echo "<14>Jul 24 10:30:$i server01 TestApp: Message $i" | nc -u 127.0.0.1 514
done
```

---

## 🐳 Docker

### Build

```bash
docker build -t phylax-syslog:latest .
```

### Run Container

```bash
docker run -d \
  --name phylax-syslog \
  -p 514:514/udp \
  -v syslog-logs:/var/log/syslog \
  -e NODE_ENV=production \
  phylax-syslog:latest
```

### Docker Compose

```bash
# Start
docker-compose up -d

# Logs
docker-compose logs -f

# Shell access
docker-compose exec syslog sh

# Stop
docker-compose down
```

---

## 📂 Project Structure

```
phylax-syslog-service/
├── src/
│   ├── index.js                    # Entry point
│   ├── config.js                   # Configuration loader
│   ├── syslog/
│   │   ├── syslogService.js        # UDP listener
│   │   ├── syslogMessage.js        # RFC 3164 parser
│   │   ├── syslogLogger.js         # Per-logger file writer
│   │   └── logZipper.js            # Compression handler
│   ├── heartbeat/
│   │   └── heartbeatSender.js      # Optional monitoring
│   └── utils/
│       ├── logger.js               # Pino setup
│       └── workQueue.js            # Async task queue
├── test/
│   ├── syslogMessage.test.js
│   ├── syslogService.test.js
│   └── integration.test.js
├── .env.example                    # Configuration template
├── package.json
├── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.md                 # Detailed design
├── IMPLEMENTATION_ROADMAP.md       # Development roadmap
└── README.md                       # This file
```

---

## 📊 Log File Handling

### File Organization

```
logs/
├── server01.log                   # Current (today)
├── server01.2024-07-24.log        # Previous day
├── server01.2024-07-24.log.zip    # Compressed
├── server02.log
└── server02.2024-07-23.log.zip
```

### Rotation Triggers

- **Daily** — Files rotate at midnight based on message timestamp
- **Size** — File rotates when reaching `SYSLOG_FILE_SIZE_LIMIT`
- **Automatic** — Old files are automatically compressed to ZIP

---

## 🐛 Troubleshooting

### Service won't start

```bash
# Check configuration
node -e "require('./src/config.js').validate()"

# Check log directory
ls -la logs/

# Check if port is in use
lsof -i :514
```

### Messages not being received

```bash
# Check service is listening
netstat -an | grep 514

# Send test message
echo "<14>Jul 24 10:30:45 test app: msg" | nc -u 127.0.0.1 514

# Check service logs
tail -50 logs/PhylaxSyslogService.log
```

### File rotation issues

- Verify `SYSLOG_FILE_SIZE_LIMIT` in `.env`
- Check the log directory has write permissions
- Review service logs for compression errors

---

## 📝 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Detailed system design, components, and data flow
- **[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)** — Development phases and roadmap
- **[RFC 3164](https://tools.ietf.org/html/rfc3164)** — Official syslog specification

---

## 🔐 Security

- **Input Validation** — RFC 3164 format validation, size limits
- **File Safety** — Path sanitization, no directory traversal
- **Error Handling** — Graceful degradation, no sensitive data exposure
- **Minimal Privileges** — Runs with minimal required permissions

---

## 📊 Monitoring

### Key Metrics

- Messages received per second
- Active logger count
- Work queue depth
- File rotation frequency
- Compression job duration
- Service state

### Log Output

Service logs are in structured JSON format (Pino):

```bash
# View logs
tail -f logs/PhylaxSyslogService.log

# Pretty-print JSON
tail -f logs/PhylaxSyslogService.log | jq .

# Filter errors
cat logs/PhylaxSyslogService.log | jq 'select(.level >= 40)'
```

---

## 🤝 Contributing

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for design details
2. Follow code style: `npm run lint:fix`
3. Write tests for new features: `npm test`
4. Document changes in commit messages

---

## 📄 License

MIT License – See [LICENSE](./LICENSE) for details

---

## 📞 Support & Links

- **GitHub Issues** — Report bugs or request features
- **RFC 3164** — https://tools.ietf.org/html/rfc3164
- **Node.js UDP** — https://nodejs.org/api/dgram.html
- **Pino Logger** — https://getpino.io/
- **Archiver** — https://www.archiverjs.com/

---

## 🔄 Version & Status

- **Version:** 1.0.0-alpha
- **Status:** 🟡 In Development
- **Last Updated:** 2024-07-24
