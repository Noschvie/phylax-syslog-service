import { getLogger } from '../utils/logger.js';
import SyslogService from './syslogService.js';
import SyslogLogger from './syslogLogger.js';
import LogZipper from './logZipper.js';

const logger = getLogger('SyslogManager');

/**
 * Manages all syslog components
 * Coordinates SyslogService, SyslogLoggers, and LogZipper
 */
class SyslogManager {
  constructor(config) {
    this.config = config;
    this.syslogService = new SyslogService(config, (message) => this._onSyslogMessage(message));
    this.loggers = new Map(); // hostname -> SyslogLogger
    this.logZipper = new LogZipper(config);
    this.isStopped = false;
  }

  /**
   * Start the manager and all services
   */
  async start() {
    try {
      logger.info('Starting Syslog Manager');

      // Reset stopped flag on start
      this.isStopped = false;

      // Start work queue (used by zipper)
      this.logZipper.start();
      logger.info('Log zipper started');

      // Start syslog service
      await this.syslogService.start();
      logger.info('Syslog service started');

      logger.info('Syslog Manager fully started');
    } catch (error) {
      logger.error('Failed to start Syslog Manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the manager and all services gracefully
   * Safe to call multiple times (idempotent)
   */
  async stop() {
    // Prevent multiple simultaneous stops
    if (this.isStopped) {
      logger.debug('Stop already in progress or completed');
      return;
    }
    this.isStopped = true;

    try {
      logger.info('Stopping Syslog Manager');

      // Stop receiving new messages
      await this.syslogService.stop();
      logger.info('Syslog service stopped');

      // Flush all loggers
      await this._flushAllLoggers();
      logger.info('All loggers flushed');

      // Stop compression queue
      await this.logZipper.stop();
      logger.info('Log zipper stopped');

      // Clear all loggers
      this.loggers.clear();
      logger.info('All loggers cleared');

      logger.info('Syslog Manager fully stopped');
    } catch (error) {
      logger.error('Error stopping Syslog Manager', { error: error.message });
    }
  }

  /**
   * Get manager status
   */
  getStatus() {
    return {
      syslogService: this.syslogService.getStatus(),
      loggers: Array.from(this.loggers.values()).map((syslogLogger) => syslogLogger.getStatus()),
      logZipper: this.logZipper.getStatus(),
    };
  }

  /**
   * Handle incoming syslog message
   */
  _onSyslogMessage(message) {
    try {
      // Get or create logger for this hostname
      const loggerKey = message.hostname || 'unknown';
      let syslogLogger = this.loggers.get(loggerKey);

      if (!syslogLogger) {
        syslogLogger = new SyslogLogger(this.config, loggerKey, (filePath) =>
          this.logZipper.queueForCompression(filePath),
        );
        this.loggers.set(loggerKey, syslogLogger);
        logger.info(`Created logger for: ${loggerKey}`);
      }

      // Log the message
      syslogLogger.log(message);

      logger.debug(`Message logged to ${loggerKey}`, {
        facility: message.facilityName,
        level: message.levelName,
      });
    } catch (error) {
      logger.error('Error handling syslog message', { error: error.message });
    }
  }

  /**
   * Flush all buffered messages from all loggers
   */
  async _flushAllLoggers() {
    const promises = Array.from(this.loggers.entries()).map(([name, syslogLogger]) => {
      logger.debug(`Flushing logger: ${name}`);
      return syslogLogger.flush().catch((error) => {
        logger.error(`Failed to flush ${name}`, { error: error.message });
      });
    });

    await Promise.all(promises);
  }

  /**
   * Periodically flush all loggers
   * Should be called by setInterval
   */
  async periodicFlush() {
    try {
      await this._flushAllLoggers();
    } catch (error) {
      logger.error('Error during periodic flush', { error: error.message });
    }
  }
}

export default SyslogManager;
