import { EventEmitter } from 'events';

/**
 * Enhanced rate limiter with multi-user support and adaptive rate limiting
 */
export class EnhancedRateLimiter extends EventEmitter {
  private requests: Map<string, number[]> = new Map(); // Track by user/context
  private globalRequests: number[] = [];
  private readonly windowMs = 60000; // 1 minute
  private adaptiveMultiplier = 1.0; // Adaptive rate adjustment
  private lastRateLimitHit = 0;
  private consecutiveSuccesses = 0;
  
  constructor(
    private maxRequestsPerUser: number,
    private maxGlobalRequests: number = maxRequestsPerUser * 10
  ) {
    super();
  }

  /**
   * Acquire permission to make a request
   * @param userId - Unique identifier for the user/context
   * @param priority - Priority level (0-10, higher = more important)
   */
  async acquire(userId: string = 'default', priority: number = 5): Promise<void> {
    const now = Date.now();
    
    // Clean up old requests
    this.cleanupOldRequests(now);
    
    // Get user's request history
    const userRequests = this.requests.get(userId) || [];
    
    // Calculate effective limits based on adaptive multiplier
    const effectiveUserLimit = Math.floor(this.maxRequestsPerUser * this.adaptiveMultiplier);
    const effectiveGlobalLimit = Math.floor(this.maxGlobalRequests * this.adaptiveMultiplier);
    
    // Check both user and global limits
    const userWaitTime = this.calculateWaitTime(userRequests, effectiveUserLimit, now);
    const globalWaitTime = this.calculateWaitTime(this.globalRequests, effectiveGlobalLimit, now);
    
    // Use the longer wait time
    const waitTime = Math.max(userWaitTime, globalWaitTime);
    
    if (waitTime > 0) {
      // Emit event for monitoring
      this.emit('rateLimitWait', {
        userId,
        waitTime,
        userRequests: userRequests.length,
        globalRequests: this.globalRequests.length,
        priority
      });
      
      // For high priority requests, try to make room
      if (priority > 7 && waitTime < 5000) {
        await this.delay(waitTime);
      } else {
        // Normal wait
        await this.delay(waitTime);
      }
      
      // Clean up again after waiting
      this.cleanupOldRequests(Date.now());
    }
    
    // Add the request
    const updatedUserRequests = [...(this.requests.get(userId) || []), now];
    this.requests.set(userId, updatedUserRequests);
    this.globalRequests.push(now);
    
    // Track consecutive successes for adaptive rate limiting
    this.consecutiveSuccesses++;
    
    // Emit event for monitoring
    this.emit('requestAcquired', {
      userId,
      timestamp: now,
      userRequests: updatedUserRequests.length,
      globalRequests: this.globalRequests.length
    });
  }

  /**
   * Report a rate limit hit from the API
   * @param retryAfter - Seconds to wait before retrying
   */
  reportRateLimitHit(retryAfter?: number): void {
    this.lastRateLimitHit = Date.now();
    this.consecutiveSuccesses = 0;
    
    // Reduce adaptive multiplier
    this.adaptiveMultiplier = Math.max(0.5, this.adaptiveMultiplier * 0.8);
    
    this.emit('rateLimitHit', {
      timestamp: this.lastRateLimitHit,
      retryAfter,
      newMultiplier: this.adaptiveMultiplier
    });
  }

  /**
   * Report a successful request
   */
  reportSuccess(): void {
    this.consecutiveSuccesses++;
    
    // Gradually increase rate if we haven't hit limits recently
    if (this.consecutiveSuccesses > 50 && 
        Date.now() - this.lastRateLimitHit > 300000) { // 5 minutes
      this.adaptiveMultiplier = Math.min(1.2, this.adaptiveMultiplier * 1.05);
    }
  }

  /**
   * Get current statistics
   */
  getStats(userId?: string): {
    userRequests?: number;
    globalRequests: number;
    maxUserRequests: number;
    maxGlobalRequests: number;
    adaptiveMultiplier: number;
    resetIn: number;
    users: number;
  } {
    const now = Date.now();
    this.cleanupOldRequests(now);
    
    const userRequests = userId ? (this.requests.get(userId) || []).length : undefined;
    
    let resetIn = 0;
    if (this.globalRequests.length > 0) {
      resetIn = Math.max(0, (this.globalRequests[0] + this.windowMs) - now);
    }
    
    return {
      userRequests,
      globalRequests: this.globalRequests.length,
      maxUserRequests: Math.floor(this.maxRequestsPerUser * this.adaptiveMultiplier),
      maxGlobalRequests: Math.floor(this.maxGlobalRequests * this.adaptiveMultiplier),
      adaptiveMultiplier: this.adaptiveMultiplier,
      resetIn: Math.ceil(resetIn / 1000),
      users: this.requests.size
    };
  }

  /**
   * Get per-user statistics
   */
  getUserStats(): Map<string, number> {
    const now = Date.now();
    this.cleanupOldRequests(now);
    
    const stats = new Map<string, number>();
    for (const [userId, requests] of this.requests) {
      stats.set(userId, requests.length);
    }
    return stats;
  }

  /**
   * Reset rate limiter for a specific user or globally
   */
  reset(userId?: string): void {
    if (userId) {
      this.requests.delete(userId);
    } else {
      this.requests.clear();
      this.globalRequests = [];
      this.adaptiveMultiplier = 1.0;
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Clean up old requests outside the time window
   */
  private cleanupOldRequests(now: number): void {
    // Clean global requests
    this.globalRequests = this.globalRequests.filter(time => now - time < this.windowMs);
    
    // Clean per-user requests
    for (const [userId, requests] of this.requests) {
      const filtered = requests.filter(time => now - time < this.windowMs);
      if (filtered.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, filtered);
      }
    }
  }

  /**
   * Calculate wait time based on request history
   */
  private calculateWaitTime(requests: number[], limit: number, now: number): number {
    if (requests.length < limit) {
      return 0;
    }
    
    const oldestRequest = requests[requests.length - limit];
    return Math.max(0, (oldestRequest + this.windowMs) - now);
  }

  /**
   * Promise-based delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Request queue for managing multiple concurrent users
 */
export class RequestQueue {
  private queue: Array<{
    id: string;
    userId: string;
    priority: number;
    request: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];
  
  private processing = false;
  private concurrentRequests = 0;
  
  constructor(
    private rateLimiter: EnhancedRateLimiter,
    private maxConcurrent: number = 3
  ) {}

  /**
   * Add a request to the queue
   */
  async enqueue<T>(
    request: () => Promise<T>,
    userId: string = 'default',
    priority: number = 5
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `${userId}-${Date.now()}-${Math.random()}`;
      
      this.queue.push({
        id,
        userId,
        priority,
        request,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Sort by priority (higher first) and timestamp (older first)
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0 && this.concurrentRequests < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) continue;
      
      this.concurrentRequests++;
      
      // Process the request
      this.processRequest(item).finally(() => {
        this.concurrentRequests--;
        // Continue processing if there are more requests
        if (this.queue.length > 0) {
          this.processQueue();
        }
      });
    }
    
    this.processing = false;
  }

  /**
   * Process a single request
   */
  private async processRequest(item: typeof this.queue[0]): Promise<void> {
    try {
      // Wait for rate limit
      await this.rateLimiter.acquire(item.userId, item.priority);
      
      // Execute the request
      const result = await item.request();
      
      // Report success
      this.rateLimiter.reportSuccess();
      
      // Resolve the promise
      item.resolve(result);
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error.code === 'RATE_LIMIT_EXCEEDED' || error.response?.status === 429) {
        const retryAfter = error.retryAfter || error.response?.headers?.['retry-after'];
        this.rateLimiter.reportRateLimitHit(retryAfter);
        
        // Re-queue the request with higher priority
        this.queue.unshift({
          ...item,
          priority: Math.min(10, item.priority + 1)
        });
        
        // Start processing again after a delay
        setTimeout(() => this.processQueue(), (retryAfter || 60) * 1000);
      } else {
        // Other error, reject the promise
        item.reject(error);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number;
    processing: boolean;
    concurrent: number;
    maxConcurrent: number;
    queuedByUser: Map<string, number>;
  } {
    const queuedByUser = new Map<string, number>();
    
    for (const item of this.queue) {
      queuedByUser.set(item.userId, (queuedByUser.get(item.userId) || 0) + 1);
    }
    
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      concurrent: this.concurrentRequests,
      maxConcurrent: this.maxConcurrent,
      queuedByUser
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        item.reject(new Error('Queue cleared'));
      }
    }
  }
}