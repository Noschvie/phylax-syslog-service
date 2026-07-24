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
    this.isClosing = false;
  }

  /**
   * Start listening for syslog messages
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = dgram.createSocket('udp4');

        // Enable SO_REUSEADDR to allow port reuse
        if (typeof this.socket.setOption === 'function') {
          try {
            this.socket.setOption('SO_REUSEADDR', 1);
          } catch (error) {
            logger.debug('SO_REUSEADDR not available', { error: error.message });
          }
        }

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

        // Set buffer sizes after binding (if available)
        try {
          // Try to set SO_RCVBUF and SO_SNDBUF socket options
          if (typeof this.socket.setOption === 'function') {
            try {
              this.socket.setOption(0, 'SO_RCVBUF', this.config.syslogUdpBufferSize);
              logger.debug('SO_RCVBUF set successfully', { size: this.config.syslogUdpBufferSize });
            } catch (error) {
              logger.debug('SO_RCVBUF not supported', { error: error.message });
            }
            try {
              this.socket.setOption(0, 'SO_SNDBUF', this.config.syslogUdpBufferSize);
              logger.debug('SO_SNDBUF set successfully', { size: this.config.syslogUdpBufferSize });
            } catch (error) {
              logger.debug('SO_SNDBUF not supported', { error: error.message });
            }
          } else {
            logger.debug('socket.setOption() not available on this platform');
          }
        } catch (error) {
          logger.debug('Error configuring socket buffer sizes', { error: error.message });
        }
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
      // Already stopped or closing
      if (!this.socket || this.isClosing) {
        resolve();
        return;
      }

      this.isClosing = true;
      this.isRunning = false;

      // Set a timeout in case socket.close() hangs
      const closeTimeout = setTimeout(() => {
        logger.warn('Socket close timeout, forcing shutdown');
        this.isClosing = false;
        this.socket = null;
        resolve();
      }, 5000);

      this.socket.close(() => {
        clearTimeout(closeTimeout);
        logger.info('Syslog service stopped');
        this.isClosing = false;
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

      // Parse message with sender's address for fallback hostname
      const message = new SyslogMessage(rawMessage, receptionTime, rinfo.address);

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
