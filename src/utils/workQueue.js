import { getLogger } from './logger.js';

const logger = getLogger('WorkQueue');

/**
 * Queue-based async task processor
 * Processes tasks sequentially (FIFO) with error handling
 */
class WorkQueue {
  constructor(name = 'WorkQueue') {
    this.name = name;
    this.tasks = [];
    this.isProcessing = false;
    this.isStopped = false;
  }

  /**
   * Enqueue an async task
   * @param {Function} asyncTask - Function that returns a Promise
   * @param {string} taskName - Optional name for logging
   */
  enqueue(asyncTask, taskName = 'unknown') {
    if (this.isStopped) {
      logger.warn(`${this.name}: Task enqueued after stop requested: ${taskName}`);
      return;
    }

    this.tasks.push({ fn: asyncTask, name: taskName });
    if (!this.isProcessing) {
      this._processNext();
    }
  }

  /**
   * Start processing the queue
   */
  start() {
    if (this.isProcessing) {
      logger.warn(`${this.name}: Already processing`);
      return;
    }
    this.isStopped = false;
    logger.info(`${this.name}: Started`);
    this._processNext();
  }

  /**
   * Stop processing queue gracefully
   * Waits for the current task to complete, then stops
   * Safe to call multiple times (idempotent)
   */
  async stop() {
    logger.info(`${this.name}: Stopping...`);
    this.isStopped = true;

    // Wait for processing to finish
    await this._waitForProcessing();

    if (this.isProcessing) {
      logger.warn(`${this.name}: Stop timeout, still processing`);
    }

    logger.info(`${this.name}: Stopped with ${this.tasks.length} tasks remaining`);
  }

  /**
   * Wait for processing to complete with timeout
   */
  async _waitForProcessing() {
    const timeout = 60000; // 60 seconds to match test timeout
    const interval = 100;
    let elapsed = 0;

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        elapsed += interval;
        if (!this.isProcessing || elapsed >= timeout) {
          clearInterval(checkInterval);
          resolve();
        }
      }, interval);
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      name: this.name,
      isProcessing: this.isProcessing,
      queueSize: this.tasks.length,
      isStopped: this.isStopped,
    };
  }

  /**
   * Process the next task in the queue
   */
  async _processNext() {
    // If stopped and no more tasks, exit
    if (this.isStopped && this.tasks.length === 0) {
      this.isProcessing = false;
      return;
    }

    // If no tasks, wait a bit, then check again
    if (this.tasks.length === 0) {
      this.isProcessing = false;
      return;
    }

    const task = this.tasks.shift();
    this.isProcessing = true;

    try {
      await task.fn();
      logger.debug(`${this.name}: Completed task: ${task.name}`);
    } catch (error) {
      logger.error(`${this.name}: Task failed: ${task.name}`, { error: error.message });
    }

    // Continue with next task
    setImmediate(() => this._processNext());
  }
}

export default WorkQueue;
