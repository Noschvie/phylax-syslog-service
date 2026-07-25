# Multi-stage build for smaller image size
FROM node:26-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Production image
FROM node:26-alpine

WORKDIR /app

# Install dumb-init and timezone data
# This allows the container to use different timezones via TZ environment variable
RUN apk add --no-cache dumb-init tzdata

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy application
COPY src/ ./src/

# Create log directory
RUN mkdir -p /var/log/syslog && \
    chmod 777 /var/log/syslog

# Create non-root user for security
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /sbin/nologin -D appuser && \
    chown -R appuser:appgroup /app

# Expose syslog UDP port
EXPOSE 514/udp

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('net').createConnection({port: 514}, ()=>process.exit(0)).on('error', ()=>process.exit(1))" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/index.js"]
