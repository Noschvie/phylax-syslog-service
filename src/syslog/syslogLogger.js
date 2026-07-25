import fs from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('SyslogLogger');

/**
 * Logger for a specific hostname/facility combination
 * Buffers messages and flushes to file periodically
 * Handles file rotation by date and size
 */
class SyslogLogger {
  constructor(config, name, onRotation) {
    this.config = config;
    this.name = name; // Usually hostname
    this.onRotation = onRotation; // Callback when file rotated
    this.buffer = [];
    this.lastRotationDate = this._getCurrentDate();
    this.currentFileSize = 0;
    this.logFilePath = this._getLogFilePath();
    this.isStopped = false;

    // Initialize file
    this._ensureFileExists();
  }

  /**
   * Add a message to the buffer
   */
  log(message) {
    if (this.isStopped) {
      logger.warn(`${this.name}: Logger stopped, ignoring message`);
      return;
    }

    const formattedLine =
      this.config.syslogLogFormat === 'extended'
        ? message.getExtendedFormattedLine()
        : message.getFormattedLine();
    this.buffer.push(formattedLine);

    // Check if rotation needed
    this._checkRotation();
  }

  /**
   * Flush buffered messages to file
   */
  async flush() {
    if (this.buffer.length === 0) {
      return;
    }

    try {
      const content = `${this.buffer.join('\n')}\n`;

      // Append to file
      await fs.promises.appendFile(this.logFilePath, content, 'utf-8');

      // Update file size
      const stats = await fs.promises.stat(this.logFilePath);
      this.currentFileSize = stats.size;

      this.buffer = [];
      logger.debug(`${this.name}: Flushed ${this.buffer.length} messages`);
    } catch (error) {
      logger.error(`${this.name}: Failed to flush messages`, { error: error.message });
    }
  }

  /**
   * Stop logger and flush remaining messages
   */
  async stop() {
    this.isStopped = true;
    await this.flush();
    logger.info(`${this.name}: Logger stopped`);
  }

  /**
   * Get logger status
   */
  getStatus() {
    return {
      name: this.name,
      bufferSize: this.buffer.length,
      fileSize: this.currentFileSize,
      filePath: this.logFilePath,
      isStopped: this.isStopped,
    };
  }

  /**
   * Check if rotation is needed (daily or size-based)
   */
  _checkRotation() {
    const currentDate = this._getCurrentDate();

    // Check for date change (daily rotation)
    if (currentDate !== this.lastRotationDate) {
      logger.info(`${this.name}: Date changed, rotating file`);
      this._rotateFile();
      this.lastRotationDate = currentDate;
      return;
    }

    // Check for size-based rotation
    if (this.currentFileSize + this._estimateBufferSize() > this.config.syslogFileSizeLimit) {
      logger.info(`${this.name}: File size limit reached, rotating file`);
      this._rotateFile();
    }
  }

  /**
   * Rotate the current log file
   */
  _rotateFile() {
    try {
      // Flush current buffer first
      const content = this.buffer.join('\n') + (this.buffer.length > 0 ? '\n' : '');
      if (content.length > 0) {
        fs.appendFileSync(this.logFilePath, content, 'utf-8');
      }
      this.buffer = [];

      // Get current file stats
      if (!fs.existsSync(this.logFilePath)) {
        this.currentFileSize = 0;
        return;
      }

      const stats = fs.statSync(this.logFilePath);
      this.currentFileSize = stats.size;

      // Rename old file with timestamp
      const rotatedPath = this._getRotatedFilePath();
      fs.renameSync(this.logFilePath, rotatedPath);
      this.currentFileSize = 0;

      logger.info(`${this.name}: File rotated to ${rotatedPath}`);

      // Callback to trigger compression
      if (this.onRotation) {
        this.onRotation(rotatedPath);
      }

      // Create new file
      this._ensureFileExists();
    } catch (error) {
      logger.error(`${this.name}: Failed to rotate file`, { error: error.message });
    }
  }

  /**
   * Ensure the log file exists
   */
  _ensureFileExists() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.logFilePath)) {
      fs.writeFileSync(this.logFilePath, '');
      this.currentFileSize = 0;
    }
  }

  /**
   * Get the current log file path
   */
  _getLogFilePath() {
    // Sanitize hostname to prevent path traversal
    const sanitizedName = this.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.config.syslogLogDir, `${sanitizedName}.log`);
  }

  /**
   * Get a rotated file path with a date suffix
   */
  _getRotatedFilePath() {
    const sanitizedName = this.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const date = this._getCurrentDate();
    return path.join(this.config.syslogLogDir, `${sanitizedName}.${date}.log`);
  }

  /**
   * Get the current date in YYYY-MM-DD format (using local time, not UTC)
   */
  _getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Estimate buffer size in bytes
   */
  _estimateBufferSize() {
    return this.buffer.reduce((sum, line) => sum + line.length + 1, 0); // +1 for newline
  }
}

export default SyslogLogger;
