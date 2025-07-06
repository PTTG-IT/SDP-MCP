import { EventEmitter } from 'events';

/**
 * Request history entry
 */
interface RequestEntry {
  timestamp: number;
  endpoint: string;
  duration: number;
  success: boolean;
  statusCode?: number;
  userId?: string;
}

/**
 * Time window statistics
 */
interface WindowStats {
  count: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
  endpoints: Map<string, number>;
}

/**
 * Advanced time-tracking rate limiter that maximizes throughput
 */
export class TimeTrackedRateLimiter extends EventEmitter {
  private requestHistory: RequestEntry[] = [];
  private requestQueue: Array<{
    id: string;
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: number;
    endpoint: string;
    userId?: string;
    enqueueTime: number;
  }> = [];
  
  private processing = false;
  private lastRateLimitHit = 0;
  private consecutiveSuccesses = 0;
  private adaptiveRate = 1.0;
  
  // Time windows for analysis (in ms)
  private readonly windows = {
    instant: 10000,    // 10 seconds
    short: 60000,      // 1 minute
    medium: 300000,    // 5 minutes
    long: 900000       // 15 minutes
  };
  
  // Safety margins
  private readonly safetyMargin = 0.85; // Use only 85% of detected limit
  private readonly burstMargin = 0.95;   // Allow bursts up to 95%
  
  constructor(
    private baseLimit: number,
    private windowMs: number = 60000
  ) {
    super();
    this.startProcessing();
  }

  /**
   * Submit a request to the queue
   */
  async execute<T>(
    endpoint: string,
    operation: () => Promise<T>,
    options: {
      priority?: number;
      userId?: string;
    } = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random()}`;
      
      this.requestQueue.push({
        id,
        execute: operation,
        resolve,
        reject,
        priority: options.priority || 5,
        endpoint,
        userId: options.userId,
        enqueueTime: Date.now()
      });
      
      // Sort by priority and enqueue time
      this.requestQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.enqueueTime - b.enqueueTime;
      });
      
      this.emit('queued', {
        id,
        endpoint,
        queueLength: this.requestQueue.length,
        priority: options.priority || 5
      });
    });
  }

  /**
   * Simple acquire method for compatibility
   */
  async acquire(): Promise<void> {
    // For simple rate limiting, just check if we can proceed
    const canProceed = await this.canProcessNext();
    if (!canProceed) {
      // Wait a bit before allowing
      await this.delay(1000);
    }
  }

  /**
   * Process queued requests
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (true) {
      // Check if we can process next request
      const canProcess = await this.canProcessNext();
      
      if (!canProcess || this.requestQueue.length === 0) {
        // Wait a bit before checking again
        await this.delay(100);
        continue;
      }
      
      const request = this.requestQueue.shift()!;
      const startTime = Date.now();
      const waitTime = startTime - request.enqueueTime;
      
      try {
        // Execute the request
        const result = await request.execute();
        
        // Record success
        this.recordRequest({
          timestamp: startTime,
          endpoint: request.endpoint,
          duration: Date.now() - startTime,
          success: true,
          userId: request.userId
        });
        
        request.resolve(result);
        
        this.emit('processed', {
          id: request.id,
          endpoint: request.endpoint,
          waitTime,
          duration: Date.now() - startTime,
          success: true
        });
        
      } catch (error: any) {
        // Record failure
        this.recordRequest({
          timestamp: startTime,
          endpoint: request.endpoint,
          duration: Date.now() - startTime,
          success: false,
          statusCode: error.response?.status,
          userId: request.userId
        });
        
        // Handle rate limit errors
        if (error.response?.status === 429 || error.message?.includes('too many requests')) {
          this.handleRateLimitHit(error);
          // Re-queue with higher priority
          this.requestQueue.unshift({
            ...request,
            priority: Math.min(10, request.priority + 2)
          });
        } else {
          request.reject(error);
        }
        
        this.emit('processed', {
          id: request.id,
          endpoint: request.endpoint,
          waitTime,
          duration: Date.now() - startTime,
          success: false,
          error: error.message
        });
      }
    }
  }

  /**
   * Check if we can process the next request
   */
  private async canProcessNext(): Promise<boolean> {
    const now = Date.now();
    
    // Get current window stats
    const instantStats = this.getWindowStats(this.windows.instant);
    const shortStats = this.getWindowStats(this.windows.short);
    
    // Calculate effective limit based on adaptive rate
    const effectiveLimit = Math.floor(this.baseLimit * this.adaptiveRate * this.safetyMargin);
    
    // Check instant burst protection (10 second window)
    const instantLimit = Math.ceil(effectiveLimit / 6); // 1/6 of minute limit for 10 seconds
    if (instantStats.count >= instantLimit * this.burstMargin) {
      this.emit('throttle', {
        reason: 'instant_burst',
        current: instantStats.count,
        limit: instantLimit,
        waitMs: this.calculateWaitTime(this.windows.instant, instantLimit)
      });
      return false;
    }
    
    // Check short-term limit (1 minute)
    if (shortStats.count >= effectiveLimit) {
      const waitMs = this.calculateWaitTime(this.windows.short, effectiveLimit);
      this.emit('throttle', {
        reason: 'minute_limit',
        current: shortStats.count,
        limit: effectiveLimit,
        waitMs
      });
      
      // Wait if necessary
      if (waitMs > 0) {
        await this.delay(waitMs);
      }
      return false;
    }
    
    // Check if we should slow down based on recent failures
    if (shortStats.failureCount > 2) {
      const failureRate = shortStats.failureCount / shortStats.count;
      if (failureRate > 0.2) { // More than 20% failures
        this.emit('throttle', {
          reason: 'high_failure_rate',
          failureRate,
          waitMs: 5000
        });
        await this.delay(5000);
        return false;
      }
    }
    
    // Predictive check - will this request likely exceed limits?
    const projectedCount = this.projectRequestCount(now + 5000); // Project 5 seconds ahead
    if (projectedCount > effectiveLimit) {
      const waitMs = this.calculateOptimalWaitTime();
      this.emit('throttle', {
        reason: 'predictive',
        projected: projectedCount,
        limit: effectiveLimit,
        waitMs
      });
      
      if (waitMs > 0) {
        await this.delay(waitMs);
      }
      return false;
    }
    
    return true;
  }

  /**
   * Record a request in history
   */
  private recordRequest(entry: RequestEntry): void {
    this.requestHistory.push(entry);
    
    // Clean old entries (keep last 15 minutes)
    const cutoff = Date.now() - this.windows.long;
    this.requestHistory = this.requestHistory.filter(e => e.timestamp > cutoff);
    
    // Update success tracking
    if (entry.success) {
      this.consecutiveSuccesses++;
      
      // Gradually increase rate if stable
      if (this.consecutiveSuccesses > 50 && Date.now() - this.lastRateLimitHit > 300000) {
        this.adaptiveRate = Math.min(1.2, this.adaptiveRate * 1.02);
        this.emit('rateAdjusted', { 
          newRate: this.adaptiveRate,
          reason: 'stable_success'
        });
      }
    } else if (entry.statusCode === 429) {
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Handle rate limit hit
   */
  private handleRateLimitHit(error: any): void {
    this.lastRateLimitHit = Date.now();
    this.consecutiveSuccesses = 0;
    
    // Reduce adaptive rate more aggressively
    const oldRate = this.adaptiveRate;
    this.adaptiveRate = Math.max(0.5, this.adaptiveRate * 0.7);
    
    this.emit('rateLimitHit', {
      timestamp: this.lastRateLimitHit,
      oldRate,
      newRate: this.adaptiveRate,
      retryAfter: error.response?.headers?.['retry-after']
    });
  }

  /**
   * Get statistics for a time window
   */
  private getWindowStats(windowMs: number): WindowStats {
    const cutoff = Date.now() - windowMs;
    const windowRequests = this.requestHistory.filter(e => e.timestamp > cutoff);
    
    const stats: WindowStats = {
      count: windowRequests.length,
      successCount: windowRequests.filter(e => e.success).length,
      failureCount: windowRequests.filter(e => !e.success).length,
      avgDuration: 0,
      endpoints: new Map()
    };
    
    if (windowRequests.length > 0) {
      const totalDuration = windowRequests.reduce((sum, e) => sum + e.duration, 0);
      stats.avgDuration = totalDuration / windowRequests.length;
      
      // Count by endpoint
      windowRequests.forEach(req => {
        stats.endpoints.set(req.endpoint, (stats.endpoints.get(req.endpoint) || 0) + 1);
      });
    }
    
    return stats;
  }

  /**
   * Calculate wait time to stay under limit
   */
  private calculateWaitTime(windowMs: number, limit: number): number {
    const cutoff = Date.now() - windowMs;
    const windowRequests = this.requestHistory.filter(e => e.timestamp > cutoff);
    
    if (windowRequests.length < limit) return 0;
    
    // Find the oldest request that would put us over limit
    const sortedRequests = windowRequests.sort((a, b) => a.timestamp - b.timestamp);
    const oldestOverLimit = sortedRequests[windowRequests.length - limit];
    
    return Math.max(0, (oldestOverLimit.timestamp + windowMs) - Date.now());
  }

  /**
   * Calculate optimal wait time based on patterns
   */
  private calculateOptimalWaitTime(): number {
    const shortStats = this.getWindowStats(this.windows.short);
    const effectiveLimit = Math.floor(this.baseLimit * this.adaptiveRate * this.safetyMargin);
    
    if (shortStats.count >= effectiveLimit * 0.9) {
      // Close to limit, wait longer
      return this.calculateWaitTime(this.windows.short, effectiveLimit) + 1000;
    } else if (shortStats.count >= effectiveLimit * 0.7) {
      // Getting close, small wait
      return 500;
    }
    
    return 0;
  }

  /**
   * Project future request count
   */
  private projectRequestCount(futureTime: number): number {
    const windowStart = futureTime - this.windowMs;
    const currentRequests = this.requestHistory.filter(e => e.timestamp > windowStart);
    const pendingRequests = this.requestQueue.length;
    
    // Estimate how many pending requests would be processed by futureTime
    const timeUntilFuture = futureTime - Date.now();
    const avgProcessingTime = this.getAverageProcessingTime();
    const estimatedProcessed = Math.min(
      pendingRequests,
      Math.floor(timeUntilFuture / avgProcessingTime)
    );
    
    return currentRequests.length + estimatedProcessed;
  }

  /**
   * Get average processing time
   */
  private getAverageProcessingTime(): number {
    const recentRequests = this.requestHistory.slice(-20);
    if (recentRequests.length === 0) return 1000; // Default 1 second
    
    const avgDuration = recentRequests.reduce((sum, e) => sum + e.duration, 0) / recentRequests.length;
    return avgDuration + 100; // Add small buffer
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): {
    queue: {
      length: number;
      byPriority: Map<number, number>;
      oldestWaitTime: number;
    };
    windows: {
      instant: WindowStats;
      short: WindowStats;
      medium: WindowStats;
    };
    limits: {
      base: number;
      effective: number;
      adaptiveRate: number;
      currentUsage: number;
      percentUsed: number;
    };
    performance: {
      avgDuration: number;
      successRate: number;
      throughput: number;
    };
  } {
    const now = Date.now();
    const instantStats = this.getWindowStats(this.windows.instant);
    const shortStats = this.getWindowStats(this.windows.short);
    const mediumStats = this.getWindowStats(this.windows.medium);
    
    const effectiveLimit = Math.floor(this.baseLimit * this.adaptiveRate * this.safetyMargin);
    
    // Queue stats
    const byPriority = new Map<number, number>();
    let oldestWaitTime = 0;
    
    this.requestQueue.forEach(req => {
      byPriority.set(req.priority, (byPriority.get(req.priority) || 0) + 1);
      const waitTime = now - req.enqueueTime;
      if (waitTime > oldestWaitTime) oldestWaitTime = waitTime;
    });
    
    // Performance stats
    const totalRequests = shortStats.count;
    const successRate = totalRequests > 0 ? shortStats.successCount / totalRequests : 0;
    const throughput = (shortStats.count / this.windowMs) * 60000; // Requests per minute
    
    return {
      queue: {
        length: this.requestQueue.length,
        byPriority,
        oldestWaitTime
      },
      windows: {
        instant: instantStats,
        short: shortStats,
        medium: mediumStats
      },
      limits: {
        base: this.baseLimit,
        effective: effectiveLimit,
        adaptiveRate: this.adaptiveRate,
        currentUsage: shortStats.count,
        percentUsed: (shortStats.count / effectiveLimit) * 100
      },
      performance: {
        avgDuration: shortStats.avgDuration,
        successRate,
        throughput
      }
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestHistory = [];
    this.requestQueue = [];
    this.adaptiveRate = 1.0;
    this.consecutiveSuccesses = 0;
    this.lastRateLimitHit = 0;
    this.emit('reset');
  }

  /**
   * Optimize for maximum throughput
   */
  optimizeForThroughput(): void {
    const stats = this.getStats();
    
    // If we're well below limit and have good success rate, increase adaptive rate
    if (stats.limits.percentUsed < 60 && stats.performance.successRate > 0.95) {
      this.adaptiveRate = Math.min(1.2, this.adaptiveRate * 1.1);
      this.emit('optimized', {
        reason: 'underutilized',
        newRate: this.adaptiveRate
      });
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}