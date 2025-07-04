import { EventEmitter } from 'events';
import { EnhancedRateLimiter } from './enhancedRateLimit.js';

interface RateLimitMetrics {
  totalRequests: number;
  successfulRequests: number;
  rateLimitHits: number;
  averageWaitTime: number;
  peakUsagePercent: number;
  userMetrics: Map<string, {
    requests: number;
    rateLimitHits: number;
    averageWaitTime: number;
  }>;
  lastReset: Date;
}

/**
 * Monitor and log rate limit usage for optimization
 */
export class RateLimitMonitor extends EventEmitter {
  private metrics: RateLimitMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    rateLimitHits: 0,
    averageWaitTime: 0,
    peakUsagePercent: 0,
    userMetrics: new Map(),
    lastReset: new Date()
  };
  
  private waitTimes: number[] = [];
  private readonly metricsWindow = 3600000; // 1 hour
  
  constructor(private rateLimiter: EnhancedRateLimiter) {
    super();
    this.setupListeners();
  }

  /**
   * Set up event listeners
   */
  private setupListeners(): void {
    // Track request acquisitions
    this.rateLimiter.on('requestAcquired', (data) => {
      this.metrics.totalRequests++;
      
      const userMetric = this.metrics.userMetrics.get(data.userId) || {
        requests: 0,
        rateLimitHits: 0,
        averageWaitTime: 0
      };
      userMetric.requests++;
      this.metrics.userMetrics.set(data.userId, userMetric);
      
      // Update peak usage
      const stats = this.rateLimiter.getStats();
      const usagePercent = (stats.globalRequests / stats.maxGlobalRequests) * 100;
      this.metrics.peakUsagePercent = Math.max(this.metrics.peakUsagePercent, usagePercent);
    });
    
    // Track rate limit waits
    this.rateLimiter.on('rateLimitWait', (data) => {
      this.waitTimes.push(data.waitTime);
      
      // Update user-specific wait time
      const userMetric = this.metrics.userMetrics.get(data.userId) || {
        requests: 0,
        rateLimitHits: 0,
        averageWaitTime: 0
      };
      
      const userWaitTimes = this.waitTimes.filter((_, i) => i % this.metrics.userMetrics.size === 0);
      userMetric.averageWaitTime = userWaitTimes.reduce((a, b) => a + b, 0) / userWaitTimes.length;
      this.metrics.userMetrics.set(data.userId, userMetric);
      
      // Log if wait time is significant
      if (data.waitTime > 5000) {
        this.emit('significantWait', {
          userId: data.userId,
          waitTime: data.waitTime,
          priority: data.priority
        });
      }
    });
    
    // Track rate limit hits
    this.rateLimiter.on('rateLimitHit', (data) => {
      this.metrics.rateLimitHits++;
      
      this.emit('alert', {
        type: 'rateLimitHit',
        message: `Rate limit hit! New multiplier: ${data.newMultiplier.toFixed(2)}`,
        data
      });
    });
    
    // Periodic metrics calculation
    setInterval(() => this.calculateMetrics(), 60000); // Every minute
  }

  /**
   * Calculate average metrics
   */
  private calculateMetrics(): void {
    // Calculate average wait time
    if (this.waitTimes.length > 0) {
      this.metrics.averageWaitTime = 
        this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
    }
    
    // Clean old wait times (keep last hour)
    const cutoff = Date.now() - this.metricsWindow;
    this.waitTimes = this.waitTimes.slice(-100); // Keep last 100 for memory efficiency
    
    // Emit periodic report
    this.emit('metricsUpdate', this.getReport());
  }

  /**
   * Get current metrics report
   */
  getReport(): {
    summary: RateLimitMetrics;
    currentStats: ReturnType<EnhancedRateLimiter['getStats']>;
    recommendations: string[];
  } {
    const currentStats = this.rateLimiter.getStats();
    const recommendations: string[] = [];
    
    // Generate recommendations
    if (this.metrics.rateLimitHits > 0) {
      recommendations.push(
        `Consider reducing SDP_RATE_LIMIT_PER_MINUTE from ${currentStats.maxUserRequests} to ${Math.floor(currentStats.maxUserRequests * 0.8)}`
      );
    }
    
    if (this.metrics.peakUsagePercent > 80) {
      recommendations.push(
        'High usage detected. Consider implementing request batching or caching.'
      );
    }
    
    if (this.metrics.averageWaitTime > 2000) {
      recommendations.push(
        'Users experiencing delays. Consider request prioritization or queue optimization.'
      );
    }
    
    if (this.metrics.userMetrics.size > 5) {
      recommendations.push(
        'Multiple users detected. Consider implementing per-user rate limits or fair queuing.'
      );
    }
    
    return {
      summary: { ...this.metrics },
      currentStats,
      recommendations
    };
  }

  /**
   * Log current status
   */
  logStatus(): void {
    const report = this.getReport();
    const stats = report.currentStats;
    
    console.log('\n📊 Rate Limit Status:');
    console.log(`├─ Current Usage: ${stats.globalRequests}/${stats.maxGlobalRequests} (${((stats.globalRequests/stats.maxGlobalRequests)*100).toFixed(1)}%)`);
    console.log(`├─ Active Users: ${stats.users}`);
    console.log(`├─ Adaptive Multiplier: ${stats.adaptiveMultiplier.toFixed(2)}`);
    console.log(`├─ Reset in: ${stats.resetIn}s`);
    
    if (this.metrics.rateLimitHits > 0) {
      console.log(`├─ ⚠️  Rate Limit Hits: ${this.metrics.rateLimitHits}`);
    }
    
    if (this.metrics.averageWaitTime > 0) {
      console.log(`├─ Average Wait Time: ${(this.metrics.averageWaitTime/1000).toFixed(1)}s`);
    }
    
    if (report.recommendations.length > 0) {
      console.log('└─ 💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    console.log('');
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): string {
    const report = this.getReport();
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: report.summary,
      currentStats: report.currentStats,
      recommendations: report.recommendations
    }, null, 2);
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitHits: 0,
      averageWaitTime: 0,
      peakUsagePercent: 0,
      userMetrics: new Map(),
      lastReset: new Date()
    };
    this.waitTimes = [];
  }
}

/**
 * Middleware to automatically apply rate limiting to axios instance
 */
export function createRateLimitMiddleware(
  rateLimiter: EnhancedRateLimiter,
  getUserId?: (config: any) => string
) {
  return {
    request: async (config: any) => {
      const userId = getUserId ? getUserId(config) : 'default';
      const priority = config.priority || 5;
      
      await rateLimiter.acquire(userId, priority);
      return config;
    },
    
    response: (response: any) => {
      rateLimiter.reportSuccess();
      return response;
    },
    
    error: (error: any) => {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        rateLimiter.reportRateLimitHit(retryAfter);
      }
      throw error;
    }
  };
}