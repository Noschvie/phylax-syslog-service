import SyslogMessage, { SyslogFacility, SyslogLevel } from '../src/syslog/syslogMessage.js';

describe('SyslogMessage', () => {
  describe('RFC 3164 Parsing', () => {
    test('should parse valid RFC 3164 message', () => {
      const msg = new SyslogMessage('<14>Jul 24 10:30:45 server01 MyApp: Hello World');

      expect(msg.priority).toBe(14);
      expect(msg.facility).toBe(1); // USER
      expect(msg.level).toBe(6); // INFO
      expect(msg.facilityName).toBe('USER');
      expect(msg.levelName).toBe('INFO');
      expect(msg.hostname).toBe('server01');
      expect(msg.tag).toBe('MyApp');
      expect(msg.message).toBe('Hello World');
    });

    test('should extract priority correctly', () => {
      const msg = new SyslogMessage('<134>Jul 24 10:30:45 server01 MyApp: Hello');

      expect(msg.priority).toBe(134);
      expect(msg.facility).toBe(16); // LOCAL0
      expect(msg.level).toBe(6); // INFO
    });

    test('should handle message with brackets in tag', () => {
      const msg = new SyslogMessage('<14>Jul 24 10:30:45 server01 MyApp[1234]: Hello');

      expect(msg.tag).toBe('MyApp');
      expect(msg.message).toBe('Hello');
    });

    test('should handle message without tag', () => {
      const msg = new SyslogMessage('<14>Jul 24 10:30:45 server01 Hello World');

      expect(msg.hostname).toBe('server01');
      expect(msg.message).toBe('Hello World');
    });

    test('should use reception time if parsing fails', () => {
      const customTime = new Date('2024-07-24T10:00:00Z');
      const msg = new SyslogMessage('Invalid message format', customTime);

      expect(msg.timestamp.toISOString()).toBe(customTime.toISOString());
      expect(msg.parseError).toBeTruthy();
    });

    test('should handle single digit day', () => {
      const msg = new SyslogMessage('<14>Jul  5 10:30:45 server01 MyApp: Hello');

      expect(msg.hostname).toBe('server01');
      expect(msg.message).toBe('Hello');
    });

    test('should infer year correctly when timestamp is in the future', () => {
      const futureMonthMsg = new SyslogMessage('<14>Dec 25 10:30:45 server01 MyApp: Hello');

      // If current month is July, December 25 should be from previous year
      const year = futureMonthMsg.timestamp.getFullYear();
      expect(year).toBeLessThanOrEqual(new Date().getFullYear());
    });
  });

  describe('Phylax Extended Format Parsing', () => {
    test('should parse Phylax ISO 8601 format', () => {
      const msg = new SyslogMessage('<14>2024-07-24 10:30:45,123 server01 MyApp: Hello');

      expect(msg.priority).toBe(14);
      expect(msg.facility).toBe(1); // USER
      expect(msg.level).toBe(6); // INFO
      expect(msg.hostname).toBe('server01');
      expect(msg.tag).toBe('MyApp');
      expect(msg.message).toBe('Hello');
      expect(msg.timestamp.getFullYear()).toBe(2024);
      expect(msg.timestamp.getMonth()).toBe(6); // July (0-based)
      expect(msg.timestamp.getDate()).toBe(24);
    });

    test('should handle Phylax format without tag', () => {
      const msg = new SyslogMessage('<14>2024-07-24 10:30:45,123 server01 Raw message');

      expect(msg.hostname).toBe('server01');
      expect(msg.message).toBe('Raw message');
    });
  });

  describe('Fallback Parsing', () => {
    test('should fallback to raw message when parsing fails', () => {
      const msg = new SyslogMessage('Some raw message without priority');

      expect(msg.hostname).toBe('unknown');
      expect(msg.message).toBe('Some raw message without priority');
      expect(msg.facility).toBe(SyslogFacility.USER);
      expect(msg.level).toBe(SyslogLevel.INFO);
    });
  });

  describe('Formatting', () => {
    test('should format log line correctly', () => {
      const msg = new SyslogMessage('<14>Jul 24 10:30:45 server01 MyApp: Hello World');
      const formatted = msg.getFormattedLine();

      expect(formatted).toContain('server01');
      expect(formatted).toContain('MyApp');
      expect(formatted).toContain('Hello World');
    });

    test('should convert to JSON', () => {
      const msg = new SyslogMessage('<14>Jul 24 10:30:45 server01 MyApp: Hello');
      const json = msg.toJSON();

      expect(json.hostname).toBe('server01');
      expect(json.tag).toBe('MyApp');
      expect(json.message).toBe('Hello');
      expect(json.facilityName).toBe('USER');
      expect(json.levelName).toBe('INFO');
    });
  });

  describe('Facility and Level Names', () => {
    test('should map all facilities correctly', () => {
      expect(new SyslogMessage('<0>Jul 24 10:30:45 server01 test').facilityName).toBe('KERN');
      expect(new SyslogMessage('<14>Jul 24 10:30:45 server01 test').facilityName).toBe('USER'); // 14 = 1*8+6
      expect(new SyslogMessage('<128>Jul 24 10:30:45 server01 test').facilityName).toBe('LOCAL0');
    });

    test('should map all levels correctly', () => {
      expect(new SyslogMessage('<120>Jul 24 10:30:45 server01 test').levelName).toBe('EMERG');
      expect(new SyslogMessage('<126>Jul 24 10:30:45 server01 test').levelName).toBe('INFO');
      expect(new SyslogMessage('<127>Jul 24 10:30:45 server01 test').levelName).toBe('DEBUG');
    });
  });
});

