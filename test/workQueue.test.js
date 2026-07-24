import WorkQueue from '../src/utils/workQueue.js';

describe('WorkQueue', () => {
  describe('Task Queueing', () => {
    test('should enqueue and process tasks', async () => {
      const queue = new WorkQueue();
      let executed = false;

      queue.enqueue(async () => {
        executed = true;
      });

      // Wait for automatic processing
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(executed).toBe(true);
    });

    test('should not enqueue after stop', () => {
      const queue = new WorkQueue();
      queue.isStopped = true;

      queue.enqueue(async () => {
        // Should not execute
      });

      expect(queue.tasks.length).toBe(0);
    });

    test('should maintain FIFO order', async () => {
      const queue = new WorkQueue();
      const executed = [];

      queue.enqueue(async () => {
        executed.push(1);
      }, 'task1');

      queue.enqueue(async () => {
        executed.push(2);
      }, 'task2');

      queue.enqueue(async () => {
        executed.push(3);
      }, 'task3');

      queue.start();

      // Wait for all tasks to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(executed).toEqual([1, 2, 3]);
    });
  });

  describe('Async Execution', () => {
    test('should execute async tasks', async () => {
      const queue = new WorkQueue();
      let result = null;

      queue.enqueue(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        result = 'executed';
      });

      queue.start();

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(result).toBe('executed');
    });

    test('should handle task errors gracefully', async () => {
      const queue = new WorkQueue();
      let errorOccurred = false;

      queue.enqueue(async () => {
        throw new Error('Test error');
      });

      // Catch error handling
      queue.enqueue(async () => {
        errorOccurred = true;
      });

      queue.start();

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(errorOccurred).toBe(true);
    });
  });

  describe('Status and Control', () => {
    test('should report status', () => {
      const queue = new WorkQueue('TestQueue');
      const status = queue.getStatus();

      expect(status.name).toBe('TestQueue');
      expect(status.isProcessing).toBe(false);
      expect(status.queueSize).toBe(0);
    });

    test('should stop gracefully', async () => {
      const queue = new WorkQueue();
      let executed = false;

      queue.enqueue(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        executed = true;
      });

      queue.start();

      await new Promise((resolve) => setTimeout(resolve, 50));
      await queue.stop();

      expect(executed).toBe(true);
      expect(queue.isStopped).toBe(true);
    });

    test('should prevent processing after stop', async () => {
      const queue = new WorkQueue();
      queue.isStopped = true;

      let executed = false;
      queue.enqueue(async () => {
        executed = true;
      });

      queue.start();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(executed).toBe(false);
    });
  });

  describe('Queue Processing', () => {
    test('should auto-start processing on first enqueue', async () => {
      const queue = new WorkQueue();
      let executed = false;

      queue.enqueue(async () => {
        executed = true;
      });

      // Processing should start automatically
      expect(queue.isProcessing || executed).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(executed).toBe(true);
    });

    test('should handle many tasks', async () => {
      const queue = new WorkQueue();
      let count = 0;

      // Queue 100 tasks
      for (let i = 0; i < 100; i++) {
        queue.enqueue(async () => {
          count++;
        });
      }

      queue.start();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(count).toBe(100);
    });
  });
});

