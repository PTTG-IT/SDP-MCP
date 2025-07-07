import { SDPClient } from './client.js';
import { TimeTrackedRateLimiter } from '../utils/timeTrackedRateLimit.js';
import { SDPConfig } from '../utils/config.js';

/**
 * Optimized SDP Client with advanced rate limiting and request queuing
 */
export class OptimizedSDPClient extends SDPClient {
  private timeTracker: TimeTrackedRateLimiter;
  
  constructor(config: SDPConfig, enableMonitoring = false) {
    super(config);
    
    // Initialize time-tracked rate limiter
    this.timeTracker = new TimeTrackedRateLimiter(
      config.rateLimitPerMinute || 60,
      60000 // 1 minute window
    );
    
    // Optional monitoring
    if (enableMonitoring) {
      this.setupMonitoring();
    }
    
    // Wrap all API methods with time tracking
    this.wrapApiMethods();
  }

  /**
   * Set up monitoring and logging
   */
  private setupMonitoring(): void {
    // Listen to time tracker events
    this.timeTracker.on('queued', (data) => {
      console.log(`📥 Queued: ${data.endpoint} (Priority: ${data.priority}, Queue: ${data.queueLength})`);
    });
    
    this.timeTracker.on('processed', (data) => {
      const status = data.success ? '✅' : '❌';
      console.log(`${status} Processed: ${data.endpoint} (Wait: ${data.waitTime}ms, Duration: ${data.duration}ms)`);
    });
    
    this.timeTracker.on('throttle', (data) => {
      console.log(`⏸️  Throttled: ${data.reason} (Wait: ${data.waitMs}ms)`);
    });
    
    this.timeTracker.on('rateLimitHit', (data) => {
      console.log(`🚫 Rate limit hit! Reducing to ${(data.newRate * 100).toFixed(0)}% capacity`);
    });
    
    this.timeTracker.on('rateAdjusted', (data) => {
      console.log(`📈 Rate adjusted to ${(data.newRate * 100).toFixed(0)}% (${data.reason})`);
    });
    
    // Periodic status reports
    setInterval(() => {
      const stats = this.getDetailedStats();
      if (stats.queue.length > 0 || stats.limits.percentUsed > 50) {
        this.logStatus();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Wrap API methods with time tracking
   */
  private wrapApiMethods(): void {
    // Store original modules
    const originalRequests = this.requests;
    const originalProjects = this.projects;
    const originalRequesters = this.requesters;
    const originalTechnicians = this.technicians;
    const originalAssets = this.assets;
    const originalProblems = this.problems;
    const originalChanges = this.changes;
    const originalLookups = this.lookups;
    
    // Create wrapped versions
    this.requests = this.wrapModule(originalRequests, 'requests');
    this.projects = this.wrapModule(originalProjects, 'projects');
    this.requesters = this.wrapModule(originalRequesters, 'requesters');
    this.technicians = this.wrapModule(originalTechnicians, 'technicians');
    this.assets = this.wrapModule(originalAssets, 'assets');
    this.problems = this.wrapModule(originalProblems, 'problems');
    this.changes = this.wrapModule(originalChanges, 'changes');
    this.lookups = this.wrapModule(originalLookups, 'lookups');
  }

  /**
   * Wrap a module with time tracking
   */
  private wrapModule<T extends object>(module: T, moduleName: string): T {
    return new Proxy(module, {
      get: (target, prop) => {
        const original = target[prop as keyof T];
        if (typeof original === 'function') {
          return (...args: any[]) => {
            return this.timeTracker.execute(
              `${moduleName}.${String(prop)}`,
              () => (original as Function).apply(target, args),
              { priority: this.getPriority(moduleName, String(prop)) }
            );
          };
        }
        return original;
      }
    }) as T;
  }

  /**
   * Determine priority for different operations
   */
  private getPriority(_module: string, method: string): number {
    // Critical operations
    if (method === 'create' || method === 'update') return 8;
    
    // Important reads
    if (method === 'get' || method === 'find') return 6;
    
    // List operations
    if (method === 'list' || method.includes('list')) return 5;
    
    // Bulk operations
    if (method.includes('bulk') || method.includes('Batch')) return 3;
    
    // Default
    return 5;
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): ReturnType<TimeTrackedRateLimiter['getStats']> {
    return this.timeTracker.getStats();
  }

  /**
   * Log current status
   */
  logStatus(): void {
    const stats = this.getDetailedStats();
    
    console.log('\n📊 Rate Limiter Status:');
    console.log(`├─ Queue: ${stats.queue.length} requests`);
    if (stats.queue.length > 0) {
      console.log(`│  └─ Oldest waiting: ${(stats.queue.oldestWaitTime / 1000).toFixed(1)}s`);
    }
    console.log(`├─ Usage: ${stats.limits.currentUsage}/${stats.limits.effective} (${stats.limits.percentUsed.toFixed(1)}%)`);
    console.log(`├─ Throughput: ${stats.performance.throughput.toFixed(1)} req/min`);
    console.log(`├─ Success Rate: ${(stats.performance.successRate * 100).toFixed(1)}%`);
    console.log(`└─ Adaptive Rate: ${(stats.limits.adaptiveRate * 100).toFixed(0)}%\n`);
  }

  /**
   * Optimize for maximum throughput
   */
  optimize(): void {
    this.timeTracker.optimizeForThroughput();
  }

  /**
   * Execute a high-priority operation
   */
  async executeHighPriority<T>(
    endpoint: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.timeTracker.execute(endpoint, operation, { priority: 9 });
  }

  /**
   * Execute a batch of operations efficiently
   */
  async executeBatch<T>(
    operations: Array<{
      name: string;
      execute: () => Promise<T>;
      priority?: number;
    }>
  ): Promise<Array<{ name: string; result?: T; error?: any }>> {
    const results = await Promise.allSettled(
      operations.map(op =>
        this.timeTracker.execute(
          op.name,
          op.execute,
          { priority: op.priority || 5 }
        ).then(result => ({ name: op.name, result }))
         .catch(error => ({ name: op.name, error }))
      )
    );
    
    return results.map(r => r.status === 'fulfilled' ? r.value : { name: '', error: r.reason });
  }

  /**
   * Wait for queue to empty
   */
  async waitForQueueEmpty(timeoutMs = 60000): Promise<boolean> {
    const startTime = Date.now();
    
    while (this.getDetailedStats().queue.length > 0) {
      if (Date.now() - startTime > timeoutMs) {
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return true;
  }

  /**
   * Reset rate limiter
   */
  resetRateLimiter(): void {
    this.timeTracker.reset();
  }
}