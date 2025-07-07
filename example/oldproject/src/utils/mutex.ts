/**
 * Simple mutex implementation for preventing concurrent operations
 */
export class Mutex {
  private locked = false;
  private waitQueue: (() => void)[] = [];

  /**
   * Acquire the mutex. Returns a promise that resolves when the lock is acquired.
   */
  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }

    // Wait for the lock to be released
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Release the mutex, allowing the next waiting operation to proceed.
   */
  release(): void {
    if (!this.locked) {
      throw new Error('Mutex is not locked');
    }

    const next = this.waitQueue.shift();
    if (next) {
      // Let the next waiting operation proceed
      next();
    } else {
      // No one is waiting, unlock
      this.locked = false;
    }
  }

  /**
   * Execute a function with the mutex locked.
   * Automatically releases the mutex when done.
   */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Check if the mutex is currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }
}