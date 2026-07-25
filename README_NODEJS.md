# Phylax Syslog Service - Node.js Edition

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](#license)

A containerized syslog message receiver, processor, and logger for the Phylax platform. Receives RFC 3164 syslog messages via UDP, routes them to per-logger files, and automatically rotates and compresses old logs.

## 🚀 Quick Start

### Local Development

```bash
# Clone and setup
git clone <repo>
cd phylax-syslog-service
npm install

# Configure
cp .env.example .env

# Start
npm start

# Send test message (from another terminal)
echo "<14>Jul 24 10:30:45 testhost MyApp: Hello World" | nc -u 127.0.0.1 514

# Check logs
tail -f logs/testhost.log
```

### Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## 📋 Features

- **RFC 3164 Syslog Parser** — Parses standard syslog format
- **Per-Logger File Routing** — Separate files per hostname/facility
- **Automatic Log Rotation** — By date and file size
- **Compression** — ZIP archives for old logs
- **Async Processing** — Non-blocking I/O via work queue
- **Structured Logging** — Pino JSON logs for debugging
- **Docker Ready** — Production-grade container image
- **Configurable** — Environment-based configuration
- **Health Checks** — Container health monitoring

---

## 🏗️ Architecture

### Components

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
Disk: /logs/hostname.log (.zip)
```

**For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file:

```bash
# Server
NODE_ENV=production
LOG_LEVEL=info

# Syslog Service
SYSLOG_PORT=514
SYSLOG_UDP_BUFFER_SIZE=81920

# Log Storage
SYSLOG_LOG_DIR=/logs
SYSLOG_FILE_SIZE_LIMIT=52428800        # 50 MB
SYSLOG_FLUSH_INTERVAL=5000             # 5 seconds

# Message Quality
SYSLOG_MAX_PROCESSING_DELAY=10000      # 10 seconds
SYSLOG_NO_DELAY_CHECK_LOGGERS=

# Heartbeat (optional)
HEARTBEAT_ENABLED=false
HEARTBEAT_PORT=11514
HEARTBEAT_INTERVAL=5000
```

See `.env.example` for all available options.

---

## 📦 Installation

### Requirements

- **Node.js:** 18.x or higher
- **npm:** 9.x or higher
- **Docker:** 20.x (for containerized deployment)

### Dependencies

```json
{
  "pino": "^8.0.0",           // Structured logging
  "archiver": "^6.0.0",       // ZIP compression
  "dotenv": "^16.0.0",        // Environment config
  "ini": "^3.0.0",            // INI file parsing
  "node-cron": "^3.0.0"       // Scheduled tasks
}
```

---

## 🧪 Development

### Running Locally

```bash
npm start                  # Start service
npm run dev               # Start with nodemon (auto-reload)
```

### Testing

```bash
npm test                  # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Linting

```bash
npm run lint            # Check code style
npm run lint:fix        # Auto-fix issues
```

### Sending Test Messages

```bash
# Single message
echo "<14>Jul 24 10:30:45 server01 TestApp: Hello" | nc -u 127.0.0.1 514

# Multiple messages
for i in {1..100}; do
  echo "<14>Jul 24 10:30:$i server01 TestApp: Message $i" | nc -u 127.0.0.1 514
done

# From macOS (if nc is limited)
python3 -c "
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.sendto(b'<14>Jul 24 10:30:45 server01 TestApp: Hello', ('127.0.0.1', 514))
"
```

---

## 🐳 Docker

### Build Image

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
  -e LOG_LEVEL=info \
  phylax-syslog:latest
```

### Docker Compose

```bash
docker-compose up -d              # Start
docker-compose logs -f            # View logs
docker-compose exec syslog sh     # Shell access
docker-compose down               # Stop
```

### Health Check

```bash
docker ps                         # Check status
docker inspect phylax-syslog       # Detailed info
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
│   │   └── heartbeatSender.js      # Monitoring (optional)
│   └── utils/
│       ├── logger.js               # Pino setup
│       └── workQueue.js            # Async task queue
├── test/
│   ├── syslogMessage.test.js       # Parser tests
│   └── integration.test.js         # E2E tests
├── .env.example                    # Config template
├── .env                            # Config (git-ignored)
├── package.json
├── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.md                 # Detailed design
└── README.md                       # This file
```

---

## 🔄 Log File Handling

### File Naming

```
logs/
├── server01.log                    # Current day, being written
├── server01.2024-07-24.log        # Previous day, not rotated yet
├── server01.2024-07-24.log.zip    # Compressed archive
├── server02.log
└── server02.2024-07-24.log.zip
```

### Rotation Triggers

1. **Date Change** (midnight) → Rotate old file
2. **Size Limit** (50 MB default) → Rotate current file
3. **Startup** → Check for orphaned logs

### Cleanup

- Old `.log` files are automatically compressed to `.zip`
- Archives older than configured retention are deleted
- Original files deleted after successful compression

---

## 🐛 Troubleshooting

### Service won't start

```bash
# Check configuration
node -e "require('./src/config.js').validate()"

# Check log directory permissions
ls -la /var/log/syslog/

# Check port availability
lsof -i :514
```

### Messages not being received

```bash
# Check if service is listening
netstat -an | grep 514

# Verify UDP port (not TCP)
ss -u -ln | grep 514

# Send test message
echo "<14>Jul 24 10:30:45 test app: msg" | nc -u 127.0.0.1 514

# Check for errors in logs
tail -100 logs/*.log
```

### File rotation not working

- Check `SYSLOG_FILE_SIZE_LIMIT` in .env
- Verify log directory has write permissions
- Check service logs for compression errors

### High memory usage

- Reduce `SYSLOG_FLUSH_INTERVAL` (more frequent writes)
- Check for message buffering issues
- Review work queue length

---

## 📊 Monitoring

### Key Metrics

- **Messages/sec received**
- **Active logger count**
- **Work queue depth**
- **File rotation frequency**
- **Compression job duration**
- **Service state**

### Logging

The service logs structured JSON (Pino format):

```json
{"level":30,"time":"2024-07-24T10:30:45.123Z","msg":"Syslog message received","hostname":"server01","facility":"LOCAL0"}
```

Monitor logs:

```bash
# Live logs
tail -f logs/PhylaxSyslogService.log

# JSON pretty-print
tail -f logs/PhylaxSyslogService.log | jq .

# Filter by level
cat logs/PhylaxSyslogService.log | jq 'select(.level > 40)'
```

---

## 📝 Deployment Checklist

- [ ] Configure `.env` with production settings
- [ ] Create persistent volume for logs
- [ ] Set up log rotation policy (rsyslog/logrotate)
- [ ] Configure Docker resource limits (CPU, memory)
- [ ] Set up monitoring/alerting
- [ ] Test graceful shutdown (SIGTERM handling)
- [ ] Verify heartbeat (if enabled)
- [ ] Load testing (message throughput)
- [ ] Backup strategy for log archives

---

## 🔐 Security

- **Input Validation:** RFC 3164 format validation, size limits
- **File Safety:** Path sanitization, no directory traversal
- **Error Handling:** Graceful degradation, no sensitive data in logs
- **Permissions:** Runs with minimal required privileges

---

## 🤝 Contributing

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for design details
2. Follow code style: `npm run lint:fix`
3. Write tests: `npm test`
4. Document changes in commit messages

---

## 📄 License

MIT

---

## 🔗 Related

- **Original C# Project:** Syslog Service
- **RFC 3164:** https://tools.ietf.org/html/rfc3164
- **Node.js UDP:** https://nodejs.org/api/dgram.html
- **Pino:** https://getpino.io/

---

## 📞 Support

For issues, questions, or suggestions:
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for design documentation
- Review [test/](./test/) for usage examples
- Check logs: `tail -f logs/PhylaxSyslogService.log`

---

**Last Updated:** 2024-07-24  
**Version:** 1.0.0-alpha  
**Status:** 🟡 In Development
