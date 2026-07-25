import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import { getLogger } from '../utils/logger.js';
import WorkQueue from '../utils/workQueue.js';

const logger = getLogger('LogZipper');

/**
 * Handles async compression of rotated log files
 * Uses work queue to process jobs sequentially
 */
class LogZipper {
  constructor(config) {
    this.config = config;
    this.workQueue = new WorkQueue('LogZipperQueue');
    this.isStopped = false;
  }

  /**
   * Start the zipper service
   */
  start() {
    this.workQueue.start();
    logger.info('Log zipper started');
  }

  /**
   * Stop the zipper service gracefully
   * Safe to call multiple times (idempotent)
   */
  async stop() {
    if (this.isStopped) {
      logger.debug('Log zipper already stopped');
      return;
    }
    this.isStopped = true;

    await this.workQueue.stop();
    logger.info('Log zipper stopped');
  }

  /**
   * Queue a file for compression
   */
  queueForCompression(filePath) {
    if (!fs.existsSync(filePath)) {
      logger.warn(`File not found for compression: ${filePath}`);
      return;
    }

    const task = async() => {
      await this._compressFile(filePath);
    };

    this.workQueue.enqueue(task, `compress:${path.basename(filePath)}`);
  }

  /**
   * Get zipper status
   */
  getStatus() {
    return {
      queue: this.workQueue.getStatus(),
    };
  }

  /**
   * Compress a single file to .zip
   */
  async _compressFile(filePath) {
    const zipPath = `${filePath}.zip`;

    try {
      logger.info(`Compressing: ${filePath}`);

      // Create output stream
      const output = fs.createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          logger.info(`Compression complete: ${zipPath} (${archive.pointer()} bytes)`);

          // Delete original file
          try {
            fs.unlinkSync(filePath);
            logger.debug(`Deleted original: ${filePath}`);
          } catch (error) {
            logger.warn(`Failed to delete original: ${filePath}`, { error: error.message });
          }

          resolve();
        });

        archive.on('error', (error) => {
          logger.error(`Compression failed: ${filePath}`, { error: error.message });
          reject(error);
        });

        output.on('error', (error) => {
          logger.error(`Output stream error: ${zipPath}`, { error: error.message });
          reject(error);
        });

        archive.pipe(output);

        // Add file to archive with basename only (no directory)
        const basename = path.basename(filePath);
        archive.file(filePath, { name: basename });

        archive.finalize();
      });
    } catch (error) {
      logger.error(`Failed to compress: ${filePath}`, { error: error.message });
      throw error;
    }
  }
}

export default LogZipper;
