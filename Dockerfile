# Multi-stage build for smaller image size
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Production image
FROM node:18-alpine

WORKDIR /app

# Install dumb-init to handle signals properly
RUN apk add --no-cache dumb-init

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy application
COPY src/ ./src/
COPY .env .env

# Create log directory
RUN mkdir -p /var/log/syslog && \
    chmod 755 /var/log/syslog

# Create non-root user for security
RUN addgroup -g 1001 syslog && \
    adduser -u 1001 -G syslog -s /sbin/nologin -D syslog && \
    chown -R syslog:syslog /var/log/syslog /app

USER syslog

# Expose syslog UDP port
EXPOSE 514/udp

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('net').createConnection({port: 514}, ()=>process.exit(0)).on('error', ()=>process.exit(1))" || exit 1

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/index.js"]
