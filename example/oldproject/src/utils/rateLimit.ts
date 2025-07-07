export class RateLimiter {
  private requests: number[] = [];
  private readonly windowMs = 60000; // 1 minute in milliseconds
  
  constructor(private readonly maxRequests: number) {}

  /**
   * Wait if necessary to respect rate limits
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    
    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // Check if we're at the limit
    if (this.requests.length >= this.maxRequests) {
      // Calculate how long to wait
      const oldestRequest = this.requests[0];
      const waitTime = (oldestRequest + this.windowMs) - now;
      
      if (waitTime > 0) {
        await this.delay(waitTime);
        // After waiting, clean up old requests again
        this.requests = this.requests.filter(time => Date.now() - time < this.windowMs);
      }
    }
    
    // Add current request
    this.requests.push(now);
  }

  /**
   * Get current usage statistics
   */
  getStats(): { current: number; max: number; resetIn: number } {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    let resetIn = 0;
    if (this.requests.length > 0) {
      resetIn = Math.max(0, (this.requests[0] + this.windowMs) - now);
    }
    
    return {
      current: this.requests.length,
      max: this.maxRequests,
      resetIn: Math.ceil(resetIn / 1000), // Convert to seconds
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Exponential backoff helper for retrying failed requests
 */
export class ExponentialBackoff {
  private attempt = 0;
  
  constructor(
    private readonly baseDelayMs = 1000,
    private readonly maxDelayMs = 60000,
    private readonly maxAttempts = 5
  ) {}

  /**
   * Get the next delay in milliseconds
   */
  getNextDelay(): number | null {
    if (this.attempt >= this.maxAttempts) {
      return null;
    }
    
    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, this.attempt),
      this.maxDelayMs
    );
    
    // Add jitter (±20%)
    const jitter = delay * 0.2;
    const actualDelay = delay + (Math.random() * jitter * 2 - jitter);
    
    this.attempt++;
    return Math.round(actualDelay);
  }

  /**
   * Reset the backoff counter
   */
  reset(): void {
    this.attempt = 0;
  }

  /**
   * Check if we should retry
   */
  shouldRetry(): boolean {
    return this.attempt < this.maxAttempts;
  }
}