import dgram from 'dgram';
import { getLogger } from '../utils/logger.js';
import SyslogMessage from './syslogMessage.js';

const logger = getLogger('SyslogService');

/**
 * UDP Syslog listener service
 * Receives RFC 3164 syslog messages and routes them to appropriate loggers
 */
class SyslogService {
  constructor(config, onMessage) {
    this.config = config;
    this.onMessage = onMessage; // Callback when message received
    this.socket = null;
    this.isRunning = false;
  }

  /**
   * Start listening for syslog messages
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = dgram.createSocket('udp4');

        this.socket.on('message', (buffer, rinfo) => {
          this._handleMessage(buffer, rinfo);
        });

        this.socket.on('error', (error) => {
          logger.error('Socket error', { error: error.message });
        });

        this.socket.on('listening', () => {
          const addr = this.socket.address();
          logger.info(`Syslog service listening on ${addr.address}:${addr.port}`);
          this.isRunning = true;
          resolve();
        });

        this.socket.bind(
          this.config.syslogPort,
          '0.0.0.0',
        );
      } catch (error) {
        logger.error('Failed to start service', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Stop listening
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }

      this.isRunning = false;
      this.socket.close(() => {
        logger.info('Syslog service stopped');
        this.socket = null;
        resolve();
      });
    });
  }

  /**
   * Handle incoming datagram
   */
  _handleMessage(buffer, rinfo) {
    try {
      const rawMessage = buffer.toString('utf-8');
      const receptionTime = new Date();

      // Parse message
      const message = new SyslogMessage(rawMessage, receptionTime);

      if (this.onMessage) {
        this.onMessage(message);
      }

      logger.debug('Message received', {
        from: rinfo.address,
        hostname: message.hostname,
        tag: message.tag,
        facility: message.facilityName,
        level: message.levelName,
      });
    } catch (error) {
      logger.error('Error handling message', { error: error.message });
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.config.syslogPort,
      bufferSize: this.config.syslogUdpBufferSize,
    };
  }
}

export default SyslogService;
