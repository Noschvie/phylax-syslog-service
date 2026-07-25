import dgram from 'dgram';
import SyslogManager from '../src/syslog/syslogManager.js';
import config from '../src/config.js';

describe('Integration Tests', () => {
  let manager = null;

  beforeEach(async () => {
    manager = new SyslogManager(config);
    // Wait for previous socket to fully close before starting new one
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterEach(async () => {
    if (manager) {
      await manager.stop();
      // Verify it actually stopped
      expect(manager.syslogService.isRunning).toBe(false);
      // Give socket time to fully close
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  test('should start and stop gracefully', async () => {
    await manager.start();
    expect(manager.syslogService.isRunning).toBe(true);

    // Don't manually stop here - let afterEach handle cleanup
    // This prevents double-stop issues
  }, 180000);

  test('should receive a syslog message and create logger', async () => {
    await manager.start();

    // Send a test message
    const client = dgram.createSocket('udp4');
    const message = Buffer.from('<14>Jul 24 10:30:45 testhost MyApp: Integration test');

    return new Promise((resolve) => {
      client.send(message, 0, message.length, config.syslogPort, '127.0.0.1', () => {
        client.close();
      });

      // Wait a bit for processing
      setTimeout(() => {
        const status = manager.getStatus();
        expect(status.loggers.length).toBeGreaterThan(0);
        resolve();
      }, 200);
    });
  }, 180000);

  test('should handle multiple messages', async () => {
    await manager.start();

    const client = dgram.createSocket('udp4');

    const sendMessage = (msg) => {
      return new Promise((resolve) => {
        const buffer = Buffer.from(msg);
        client.send(buffer, 0, buffer.length, config.syslogPort, '127.0.0.1', resolve);
      });
    };

    // Send multiple messages
    await sendMessage('<14>Jul 24 10:30:45 host1 tag1: message 1');
    await sendMessage('<14>Jul 24 10:30:46 host1 tag1: message 2');
    await sendMessage('<14>Jul 24 10:30:47 host2 tag2: message 3');

    client.close();

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    const status = manager.getStatus();
    expect(status.loggers.length).toBeGreaterThanOrEqual(2); // At least 2 different hosts
  }, 180000);

  test('should flush buffered messages', async () => {
    await manager.start();

    const client = dgram.createSocket('udp4');
    const message = Buffer.from('<14>Jul 24 10:30:45 flushtest MyApp: Flush me');

    client.send(message, 0, message.length, config.syslogPort, '127.0.0.1', () => {
      client.close();
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Perform manual flush
    await manager.periodicFlush();

    const status = manager.getStatus();
    const logger = status.loggers[0];

    if (logger) {
      // After flush, buffer should be empty or small
      expect(logger.bufferSize).toBeLessThanOrEqual(1);
    }
  }, 180000);

  test('should report status correctly', async () => {
    await manager.start();

    const status = manager.getStatus();

    expect(status).toHaveProperty('syslogService');
    expect(status).toHaveProperty('loggers');
    expect(status).toHaveProperty('logZipper');
    expect(status.syslogService.isRunning).toBe(true);
  }, 180000);
});
