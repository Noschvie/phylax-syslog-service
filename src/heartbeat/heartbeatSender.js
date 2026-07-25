import dgram from 'dgram';
import logger from '../utils/logger.js';

/**
 * HeartbeatSender - Sends periodic heartbeat messages to monitor service health
 */
class HeartbeatSender {
  constructor(config) {
    this.config = config;
    this.client = dgram.createSocket('udp4');
    this.heartbeatInterval = null;
    this.messageCount = 0;
  }

  /**
   * Start sending heartbeat messages
   */
  async start() {
    if (!this.config.heartbeatEnabled) {
      logger.debug('Heartbeat monitoring is disabled');
      return;
    }

    logger.info('Starting heartbeat sender', {
      destination: this.config.heartbeatDestination,
      port: this.config.heartbeatPort,
      interval: this.config.heartbeatInterval,
    });

    // Send initial heartbeat
    this.sendHeartbeat();

    // Set up periodic heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Send a heartbeat message
   */
  sendHeartbeat() {
    try {
      this.messageCount += 1;
      const timestamp = new Date().toISOString();
      const message = `HEARTBEAT|${this.messageCount}|${timestamp}|phylax-syslog-service`;

      this.client.send(
        message,
        0,
        message.length,
        this.config.heartbeatPort,
        this.config.heartbeatDestination,
        (error) => {
          if (error) {
            logger.warn('Failed to send heartbeat', { error: error.message });
          } else {
            logger.debug('Heartbeat sent', { count: this.messageCount });
          }
        },
      );
    } catch (error) {
      logger.error('Error sending heartbeat', { error: error.message });
    }
  }

  /**
   * Stop sending heartbeat messages
   */
  async stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.client) {
      this.client.close();
    }

    logger.info('Heartbeat sender stopped');
  }
}

export default HeartbeatSender;
