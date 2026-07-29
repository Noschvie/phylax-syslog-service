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
        // SO_REUSEADDR is set via the createSocket option, not via a
        // setOption() call - dgram.Socket has no such method.
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('message', (buffer, rinfo) => {
          this._handleMessage(buffer, rinfo);
        });

        this.socket.on('error', (error) => {
          logger.error('Socket error', { error: error.message });
          if (!this.isRunning) {
            // Error occurred before socket was bound - reject the start() promise
            reject(error);
          }
        });

        this.socket.on('listening', () => {
          const addr = this.socket.address();
          logger.info(`Syslog service listening on ${addr.address}:${addr.port}`);

          // Buffer sizes can only be set once the socket is actually bound -
          // bind() is asynchronous, so this must happen here and not right
          // after calling bind() below.
          this._configureBufferSizes();

          this.isRunning = true;
          resolve();
        });

        this.socket.bind(this.config.syslogPort, '0.0.0.0');
      } catch (error) {
        logger.error('Failed to start service', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Set SO_RCVBUF / SO_SNDBUF on the bound socket if a buffer size was
   * configured. Uses the real Node.js dgram API instead of the
   * platform-level setOption() method (which dgram.Socket does not have).
   */
  _configureBufferSizes() {
    if (!this.config.syslogUdpBufferSize) {
      return;
    }

    try {
      this.socket.setRecvBufferSize(this.config.syslogUdpBufferSize);
      logger.debug('SO_RCVBUF set successfully', {
        requested: this.config.syslogUdpBufferSize,
        actual: this.socket.getRecvBufferSize(),
      });
    } catch (error) {
      logger.debug('SO_RCVBUF not supported', { error: error.message });
    }

    try {
      this.socket.setSendBufferSize(this.config.syslogUdpBufferSize);
      logger.debug('SO_SNDBUF set successfully', {
        requested: this.config.syslogUdpBufferSize,
        actual: this.socket.getSendBufferSize(),
      });
    } catch (error) {
      logger.debug('SO_SNDBUF not supported', { error: error.message });
    }
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
