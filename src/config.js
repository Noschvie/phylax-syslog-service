import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../');

// Validation helpers
const validatePort = (value, name) => {
  const port = parseInt(value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid port (1-65535), got: ${value}`);
  }
  return port;
};

const validatePositiveNumber = (value, name, minValue = 0) => {
  const num = parseInt(value, 10);
  if (Number.isNaN(num) || num <= minValue) {
    throw new Error(`${name} must be > ${minValue}, got: ${value}`);
  }
  return num;
};

const validateDirectory = (dirPath, name) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    }
    // Check if writable
    fs.accessSync(dirPath, fs.constants.W_OK);
    return dirPath;
  } catch (error) {
    throw new Error(`${name} directory is not accessible: ${dirPath}. Error: ${error.message}`, { cause: error });
  }
};

const validateBoolean = (value) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw new Error(`Expected boolean value, got: ${value}`);
};

// Build configuration
const config = {
  // Node.js & Logging
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Syslog Service Configuration
  syslogPort: validatePort(process.env.SYSLOG_PORT || '514', 'SYSLOG_PORT'),
  syslogUdpBufferSize: validatePositiveNumber(
    process.env.SYSLOG_UDP_BUFFER_SIZE || '81920',
    'SYSLOG_UDP_BUFFER_SIZE',
  ),

  // Log File Storage
  syslogLogDir: validateDirectory(
    process.env.SYSLOG_LOG_DIR || path.join(projectRoot, 'logs'),
    'SYSLOG_LOG_DIR',
  ),
  syslogFileSizeLimit: validatePositiveNumber(
    process.env.SYSLOG_FILE_SIZE_LIMIT || '52428800',
    'SYSLOG_FILE_SIZE_LIMIT',
    1048576, // At least 1 MB
  ),
  syslogUnzippedFileSizeLimit: validatePositiveNumber(
    process.env.SYSLOG_UNZIPPED_FILE_SIZE_LIMIT || '5242880',
    'SYSLOG_UNZIPPED_FILE_SIZE_LIMIT',
  ),
  syslogDateTimeFormat: process.env.SYSLOG_DATE_TIME_FORMAT || 'yyyy-MM-dd HH:mm:ss.fff',
  syslogLogFormat: process.env.SYSLOG_LOG_FORMAT || 'standard',
  // standard: TIMESTAMP HOSTNAME [TAG] MESSAGE
  // extended: RECEPTION_TIME SENDER_ADDRESS TIMESTAMP HOSTNAME [TAG] MESSAGE

  // Syslog Service Timings
  syslogFlushInterval: validatePositiveNumber(
    process.env.SYSLOG_FLUSH_INTERVAL || '5000',
    'SYSLOG_FLUSH_INTERVAL',
    0,
  ),
  syslogDaySwitchMessageDelay: validatePositiveNumber(
    process.env.SYSLOG_DAY_SWITCH_MESSAGE_DELAY || '15000',
    'SYSLOG_DAY_SWITCH_MESSAGE_DELAY',
    0,
  ),

  // Message Quality Checks
  syslogMaxProcessingDelay: validatePositiveNumber(
    process.env.SYSLOG_MAX_PROCESSING_DELAY || '10000',
    'SYSLOG_MAX_PROCESSING_DELAY',
    0,
  ),
  syslogMaxReceptionDelay: validatePositiveNumber(
    process.env.SYSLOG_MAX_RECEPTION_DELAY || '2000',
    'SYSLOG_MAX_RECEPTION_DELAY',
    0,
  ),
  syslogNoDelayCheckLoggers: (
    process.env.SYSLOG_NO_DELAY_CHECK_LOGGERS
  )
    .split(',')
    .map((s) => s.trim()),

  // Heartbeat Monitoring (Optional)
  heartbeatEnabled: validateBoolean(process.env.HEARTBEAT_ENABLED || 'false'),
  heartbeatPort: validatePort(process.env.HEARTBEAT_PORT || '11514', 'HEARTBEAT_PORT'),
  heartbeatInterval: validatePositiveNumber(
    process.env.HEARTBEAT_INTERVAL || '5000',
    'HEARTBEAT_INTERVAL',
    0,
  ),
  heartbeatDestination: process.env.HEARTBEAT_DESTINATION || '127.0.0.1',

  // Log Retention (Optional)
  syslogLogRetentionDays: validatePositiveNumber(
    process.env.SYSLOG_LOG_RETENTION_DAYS || '30',
    'SYSLOG_LOG_RETENTION_DAYS',
    0,
  ),
};

// Log all settings on startup
logger.info('Configuration loaded:', {
  nodeEnv: config.nodeEnv,
  logLevel: config.logLevel,
  syslogPort: config.syslogPort,
  syslogLogDir: config.syslogLogDir,
  syslogFileSizeLimit: config.syslogFileSizeLimit,
  syslogFlushInterval: config.syslogFlushInterval,
  heartbeatEnabled: config.heartbeatEnabled,
});

export default config;
