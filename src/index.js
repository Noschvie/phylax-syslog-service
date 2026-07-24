import logger from './utils/logger.js';
import config from './config.js';
import SyslogManager from './syslog/syslogManager.js';
import HeartbeatSender from './heartbeat/heartbeatSender.js';

let manager = null;
let heartbeatSender = null;
let flushInterval = null;

/**
 * Handle a graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Clear flush interval
  if (flushInterval) {
    clearInterval(flushInterval);
  }

  // Stop heartbeat sender
  if (heartbeatSender) {
    await heartbeatSender.stop();
  }

  // Stop manager
  if (manager) {
    await manager.stop();
  }

  logger.info('Application shutdown complete');
  process.exit(0);
}

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled rejection', { promise: promise.toString(), reason });
  gracefulShutdown('unhandledRejection');
});

/**
 * Set up signal handlers
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Main application startup
 */
async function main() {
  try {
    logger.info('='.repeat(60));
    logger.info('Phylax Syslog Service - Starting');
    logger.info('='.repeat(60));

    // Create and start manager
    manager = new SyslogManager(config);
    await manager.start();

    // Create and start heartbeat sender
    heartbeatSender = new HeartbeatSender(config);
    await heartbeatSender.start();

    // Set up periodic flush interval
    flushInterval = setInterval(async () => {
      await manager.periodicFlush();
    }, config.syslogFlushInterval);

    logger.info('Application fully started and ready to receive syslog messages');
    logger.info(`Listening on port ${config.syslogPort} (UDP)`);
    logger.info(`Log directory: ${config.syslogLogDir}`);
    logger.info(`Flush interval: ${config.syslogFlushInterval}ms`);
    logger.info('='.repeat(60));
  } catch (error) {
    logger.fatal('Failed to start application', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Start application
main();
