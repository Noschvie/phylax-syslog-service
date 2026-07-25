import config from '../src/config.js';

describe('Config', () => {
  describe('Environment Loading', () => {
    test('should load configuration from environment', () => {
      expect(config).toBeDefined();
      expect(config.nodeEnv).toBeDefined();
      expect(config.logLevel).toBeDefined();
    });

    test('should have valid port configuration', () => {
      expect(config.syslogPort).toBeGreaterThanOrEqual(1);
      expect(config.syslogPort).toBeLessThanOrEqual(65535);
    });

    test('should have valid log directory', () => {
      expect(config.syslogLogDir).toBeDefined();
      expect(typeof config.syslogLogDir).toBe('string');
    });

    test('should have valid file size limits', () => {
      expect(config.syslogFileSizeLimit).toBeGreaterThan(1048576); // At least 1 MB
      expect(config.syslogUnzippedFileSizeLimit).toBeGreaterThan(0);
    });

    test('should have valid timing configurations', () => {
      expect(config.syslogFlushInterval).toBeGreaterThanOrEqual(0);
      expect(config.syslogDaySwitchMessageDelay).toBeGreaterThanOrEqual(0);
      expect(config.syslogMaxProcessingDelay).toBeGreaterThanOrEqual(0);
    });

    test('should have delay check loggers as array', () => {
      expect(Array.isArray(config.syslogNoDelayCheckLoggers)).toBe(true);
      expect(config.syslogNoDelayCheckLoggers.length).toBeGreaterThan(0);
    });

    test('should have heartbeat configuration', () => {
      expect(typeof config.heartbeatEnabled).toBe('boolean');
      expect(config.heartbeatPort).toBeGreaterThanOrEqual(1);
      expect(config.heartbeatPort).toBeLessThanOrEqual(65535);
    });
  });

  describe('Default Values', () => {
    test('should use default log level if not set', () => {
      expect(config.logLevel).toMatch(/^(trace|debug|info|warn|error|fatal)$/);
    });

    test('should use sensible defaults for timing', () => {
      expect(config.syslogFlushInterval).toBeGreaterThan(0);
      expect(config.syslogFlushInterval).toBeLessThan(60000); // Less than 1 minute
    });

    test('should use sensible defaults for retention', () => {
      expect(config.syslogLogRetentionDays).toBeGreaterThan(0);
      expect(config.syslogLogRetentionDays).toBeLessThanOrEqual(365);
    });
  });

  describe('Production vs Development', () => {
    test('should have environment mode defined', () => {
      expect(config.nodeEnv).toMatch(/^(development|production|testing|test)$/);
    });

    test('should enable heartbeat in production if configured', () => {
      // This test verifies the boolean is valid
      expect(typeof config.heartbeatEnabled).toBe('boolean');
    });
  });
});
