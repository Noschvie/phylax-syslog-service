import { getLogger } from '../utils/logger.js';

const logger = getLogger('SyslogMessage');

// Syslog Facility enumeration (RFC 3164)
export const SyslogFacility = {
  KERN: 0,
  USER: 1,
  MAIL: 2,
  DAEMON: 3,
  AUTH: 4,
  SYSLOG: 5,
  LPR: 6,
  NEWS: 7,
  UUCP: 8,
  CRON: 9,
  LOCAL0: 16,
  LOCAL1: 17,
  LOCAL2: 18,
  LOCAL3: 19,
  LOCAL4: 20,
  LOCAL5: 21,
  LOCAL6: 22,
  LOCAL7: 23,
};

// Syslog Level enumeration (RFC 3164)
export const SyslogLevel = {
  EMERG: 0,
  ALERT: 1,
  CRIT: 2,
  ERR: 3,
  WARNING: 4,
  NOTICE: 5,
  INFO: 6,
  DEBUG: 7,
};

const FACILITY_NAMES = Object.entries(SyslogFacility).reduce((acc, [name, value]) => {
  acc[value] = name;
  return acc;
}, {});

const LEVEL_NAMES = Object.entries(SyslogLevel).reduce((acc, [name, value]) => {
  acc[value] = name;
  return acc;
}, {});

// Regex pattern for parsing syslog tag (usually in format "tag:" or "tag[pid]:")
const TAG_PATTERN = /^([^[\s:]+)(?:\[\d+])?:\s*(.*)$/;

/**
 * Parse RFC 3164 Syslog message
 * Format: <PRI>HEADER MSG
 * where PRI = Facility * 8 + Severity
 */
class SyslogMessage {
  constructor(rawMessage, receptionTime = new Date()) {
    this.rawMessage = rawMessage;
    this.receptionTime = receptionTime;
    this.timestamp = null;
    this.hostname = null;
    this.tag = null;
    this.message = null;
    this.priority = null;
    this.facility = null;
    this.level = null;
    this.facilityName = null;
    this.levelName = null;
    this.parseError = null;

    this._parse();
  }

  _parse() {
    try {
      // Try RFC 3164 format first
      if (!this._parseRfc3164()) {
        // Try Phylax extended format (ISO 8601)
        if (!this._parsePhylaxFormat()) {
          // Fallback to raw message
          this._parseFallback();
        }
      }
    } catch (error) {
      logger.warn('Error parsing syslog message', { error: error.message });
      this._parseFallback();
    }
  }

  /**
   * Parse RFC 3164 format: <PRI>HEADER MSG
   * Timestamp format: Mmm dd hh:mm:ss (no year)
   */
  _parseRfc3164() {
    const priMatch = this.rawMessage.match(/^<(\d+)>/);
    if (!priMatch) return false;

    const priority = parseInt(priMatch[1], 10);
    const rest = this.rawMessage.substring(priMatch[0].length);

    // Extract priority components
    this.priority = priority;
    this.facility = Math.floor(priority / 8);
    this.level = priority % 8;
    this.facilityName = FACILITY_NAMES[this.facility] || 'UNKNOWN';
    this.levelName = LEVEL_NAMES[this.level] || 'UNKNOWN';

    // Parse timestamp (Mmm dd hh:mm:ss)
    const dateMatch = rest.match(/^(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(.+)/);
    if (!dateMatch) return false;

    const [, month, day, hour, minute, second, remaining] = dateMatch;
    const monthIndex = this._getMonthIndex(month);
    if (monthIndex === -1) return false;

    // Build timestamp (use current year, infer from current date)
    const now = this.receptionTime;
    const year = now.getFullYear();
    const date = new Date(
      year,
      monthIndex,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10),
    );

    // If timestamp is in the future, use previous year
    if (date > now) {
      date.setFullYear(year - 1);
    }

    this.timestamp = date;

    // Parse hostname and message
    const hostnameMatch = remaining.match(/^(\S+)\s+(.*)$/);
    if (!hostnameMatch) {
      const [firstWord] = remaining.split(/\s+/);
      this.hostname = firstWord;
      this.message = remaining;
      return true;
    }

    const [, hostname, messageWithTag] = hostnameMatch;
    this.hostname = hostname;

    // Parse tag (usually in format "tag:" or "tag[pid]:")
    const tagMatch = messageWithTag.match(TAG_PATTERN);
    if (tagMatch) {
      const [, tag, message] = tagMatch;
      this.tag = tag;
      this.message = message;
    } else {
      this.tag = null;
      this.message = messageWithTag;
    }

    return true;
  }

  /**
   * Parse Phylax extended format with ISO 8601 timestamp
   * Format: <PRI>YYYY-MM-DD HH:mm:ss,fff HOSTNAME TAG MESSAGE
   */
  _parsePhylaxFormat() {
    const priMatch = this.rawMessage.match(/^<(\d+)>/);
    if (!priMatch) return false;

    const priority = parseInt(priMatch[1], 10);
    const rest = this.rawMessage.substring(priMatch[0].length);

    // Parse ISO 8601 timestamp: 2024-07-24 10:30:45,123
    const isoMatch = rest.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})\s+(.+)/);
    if (!isoMatch) return false;

    const [, year, month, day, hour, minute, second, millis, remaining] = isoMatch;

    this.priority = priority;
    this.facility = Math.floor(priority / 8);
    this.level = priority % 8;
    this.facilityName = FACILITY_NAMES[this.facility] || 'UNKNOWN';
    this.levelName = LEVEL_NAMES[this.level] || 'UNKNOWN';

    this.timestamp = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10),
      parseInt(millis, 10),
    );

    // Parse hostname and message
    const hostnameMatch = remaining.match(/^(\S+)\s+(.*)$/);
    if (!hostnameMatch) {
      const [firstWord] = remaining.split(/\s+/);
      this.hostname = firstWord;
      this.message = remaining;
      return true;
    }

    const [, hostname, messageWithTag] = hostnameMatch;
    this.hostname = hostname;

    // Parse tag
    const tagMatch = messageWithTag.match(TAG_PATTERN);
    if (tagMatch) {
      const [, tag, message] = tagMatch;
      this.tag = tag;
      this.message = message;
    } else {
      this.tag = null;
      this.message = messageWithTag;
    }

    return true;
  }

  /**
   * Fallback: treat the entire message as raw
   */
  _parseFallback() {
    this.hostname = 'unknown';
    this.message = this.rawMessage;
    this.tag = null;
    this.timestamp = this.receptionTime;
    this.priority = (SyslogFacility.USER * 8) + SyslogLevel.INFO;
    this.facility = SyslogFacility.USER;
    this.level = SyslogLevel.INFO;
    this.facilityName = 'USER';
    this.levelName = 'INFO';
    this.parseError = 'Could not parse message, using fallback';
  }

  /**
   * Helper to get month index from month name (0-11)
   */
  _getMonthIndex(monthName) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(monthName);
  }

  /**
   * Get a formatted log line (for writing to file)
   */
  getFormattedLine() {
    const timestamp = this.timestamp
      ? this.timestamp.toISOString().replace('T', ' ').substring(0, 23)
      : new Date(this.receptionTime).toISOString().replace('T', ' ').substring(0, 23);

    const tag = this.tag ? `[${this.tag}]` : '';
    return `${timestamp} ${this.hostname} ${tag} ${this.message}`;
  }

  /**
   * Get a JSON representation
   */
  toJSON() {
    return {
      timestamp: this.timestamp?.toISOString(),
      receptionTime: this.receptionTime instanceof Date
        ? this.receptionTime.toISOString()
        : this.receptionTime,
      hostname: this.hostname,
      tag: this.tag,
      message: this.message,
      priority: this.priority,
      facility: this.facility,
      facilityName: this.facilityName,
      level: this.level,
      levelName: this.levelName,
      parseError: this.parseError,
    };
  }
}

export default SyslogMessage;
