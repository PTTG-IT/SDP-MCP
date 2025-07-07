import { RateLimitCoordinator, RateLimitStatus } from '../api/rateLimitCoordinator.js';
import { TokenManager } from '../api/tokenManager.js';
import { EventEmitter } from 'events';

export interface RateLimitMetrics {
  timestamp: Date;
  tokenRefresh: {
    canRefreshNow: boolean;
    timeUntilNextRefresh: number;
    refreshesInWindow: number;
    lastRefreshAge: number | null;
  };
  apiRequests: {
    requestsPerMinute: number;
    requestsPerHour: number;
    utilizationPercentMinute: number;
    utilizationPercentHour: number;
  };
  circuitBreaker: {
    isOpen: boolean;
    consecutiveFailures: number;
    timeInCurrentState: number;
  };
  alerts: RateLimitAlert[];
}

export interface RateLimitAlert {
  level: 'warning' | 'critical';
  type: 'token_refresh' | 'api_rate' | 'circuit_breaker';
  message: string;
  timestamp: Date;
}

export class RateLimitMonitor extends EventEmitter {
  private coordinator: RateLimitCoordinator;
  // @ts-ignore - used by setTokenManager
  private tokenManager: TokenManager | null = null;
  private metricsHistory: RateLimitMetrics[] = [];
  private alerts: RateLimitAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly maxHistorySize = 1440; // 24 hours at 1-minute intervals

  constructor() {
    super();
    this.coordinator = RateLimitCoordinator.getInstance();
  }

  /**
   * Set token manager for monitoring
   */
  setTokenManager(tokenManager: TokenManager): void {
    this.tokenManager = tokenManager;
  }

  /**
   * Start monitoring rate limits
   */
  start(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      console.log('Rate limit monitoring already started');
      return;
    }

    console.log(`Starting rate limit monitoring with ${intervalMs}ms interval`);
    
    // Initial collection
    this.collectMetrics();
    
    // Set up periodic collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Rate limit monitoring stopped');
    }
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    const status = this.coordinator.getStatus();
    const metrics = await this.calculateMetrics(status);
    
    // Store metrics
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
    
    // Check for alerts
    this.checkAlerts(metrics);
    
    // Emit metrics event
    this.emit('metrics', metrics);
  }

  /**
   * Calculate metrics from status
   */
  private async calculateMetrics(status: RateLimitStatus): Promise<RateLimitMetrics> {
    const now = new Date();
    
    // Calculate token refresh metrics
    const canRefreshNow = await this.coordinator.canRefreshToken();
    const timeUntilNextRefresh = this.coordinator.getTimeUntilNextRefresh();
    const lastRefreshAge = status.tokenRefresh.lastRefreshTime 
      ? now.getTime() - status.tokenRefresh.lastRefreshTime.getTime()
      : null;
    
    // Calculate API utilization
    const utilizationPercentMinute = (status.apiRequests.requestsLastMinute / 60) * 100;
    const utilizationPercentHour = (status.apiRequests.requestsLastHour / 1000) * 100;
    
    // Calculate circuit breaker state duration
    let timeInCurrentState = 0;
    if (status.circuitBreaker.state === 'open' && status.circuitBreaker.lastFailureTime) {
      timeInCurrentState = now.getTime() - status.circuitBreaker.lastFailureTime.getTime();
    }
    
    return {
      timestamp: now,
      tokenRefresh: {
        canRefreshNow,
        timeUntilNextRefresh,
        refreshesInWindow: status.tokenRefresh.refreshesInWindow,
        lastRefreshAge
      },
      apiRequests: {
        requestsPerMinute: status.apiRequests.requestsLastMinute,
        requestsPerHour: status.apiRequests.requestsLastHour,
        utilizationPercentMinute,
        utilizationPercentHour
      },
      circuitBreaker: {
        isOpen: status.circuitBreaker.state === 'open',
        consecutiveFailures: status.circuitBreaker.failures,
        timeInCurrentState
      },
      alerts: [...this.alerts] // Copy current alerts
    };
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(metrics: RateLimitMetrics): void {
    const newAlerts: RateLimitAlert[] = [];
    
    // Token refresh alerts
    if (!metrics.tokenRefresh.canRefreshNow && metrics.tokenRefresh.timeUntilNextRefresh > 0) {
      const minutes = Math.ceil(metrics.tokenRefresh.timeUntilNextRefresh / 60000);
      newAlerts.push({
        level: 'warning',
        type: 'token_refresh',
        message: `Token refresh blocked for ${minutes} more minutes (rate limit: max 1 every 3 minutes)`,
        timestamp: new Date()
      });
    }
    
    if (metrics.tokenRefresh.refreshesInWindow >= 8) {
      newAlerts.push({
        level: 'critical',
        type: 'token_refresh',
        message: `Approaching token limit: ${metrics.tokenRefresh.refreshesInWindow}/10 tokens used in window`,
        timestamp: new Date()
      });
    }
    
    // API rate alerts
    if (metrics.apiRequests.utilizationPercentMinute > 80) {
      newAlerts.push({
        level: 'warning',
        type: 'api_rate',
        message: `High API usage: ${metrics.apiRequests.utilizationPercentMinute.toFixed(1)}% of per-minute limit`,
        timestamp: new Date()
      });
    }
    
    if (metrics.apiRequests.utilizationPercentHour > 90) {
      newAlerts.push({
        level: 'critical',
        type: 'api_rate',
        message: `Critical API usage: ${metrics.apiRequests.utilizationPercentHour.toFixed(1)}% of hourly limit`,
        timestamp: new Date()
      });
    }
    
    // Circuit breaker alerts
    if (metrics.circuitBreaker.isOpen) {
      newAlerts.push({
        level: 'critical',
        type: 'circuit_breaker',
        message: `Circuit breaker OPEN - API calls blocked due to ${metrics.circuitBreaker.consecutiveFailures} failures`,
        timestamp: new Date()
      });
    }
    
    // Update alerts and emit events
    for (const alert of newAlerts) {
      if (!this.isDuplicateAlert(alert)) {
        this.alerts.push(alert);
        this.emit('alert', alert);
      }
    }
    
    // Clean old alerts (keep last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > oneHourAgo);
  }

  /**
   * Check if alert is duplicate (within last 5 minutes)
   */
  private isDuplicateAlert(alert: RateLimitAlert): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.alerts.some(a => 
      a.type === alert.type &&
      a.level === alert.level &&
      a.timestamp > fiveMinutesAgo
    );
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): RateLimitMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  getHistory(minutes: number = 60): RateLimitMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(minutes: number = 60): RateLimitAlert[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.alerts.filter(a => a.timestamp > cutoff);
  }

  /**
   * Generate summary report
   */
  generateSummary(): {
    current: RateLimitMetrics | null;
    hourlyStats: {
      avgRequestsPerMinute: number;
      maxRequestsPerMinute: number;
      tokenRefreshAttempts: number;
      circuitBreakerTrips: number;
    };
    alerts: {
      total: number;
      byType: Record<string, number>;
      critical: number;
    };
  } {
    const hourlyMetrics = this.getHistory(60);
    const current = this.getCurrentMetrics();
    
    // Calculate hourly stats
    const avgRequestsPerMinute = hourlyMetrics.length > 0
      ? hourlyMetrics.reduce((sum, m) => sum + m.apiRequests.requestsPerMinute, 0) / hourlyMetrics.length
      : 0;
    
    const maxRequestsPerMinute = hourlyMetrics.length > 0
      ? Math.max(...hourlyMetrics.map(m => m.apiRequests.requestsPerMinute))
      : 0;
    
    const tokenRefreshAttempts = hourlyMetrics.filter(m => m.tokenRefresh.lastRefreshAge !== null && m.tokenRefresh.lastRefreshAge < 60000).length;
    
    const circuitBreakerTrips = hourlyMetrics.filter(m => m.circuitBreaker.isOpen).length;
    
    // Alert statistics
    const hourlyAlerts = this.getRecentAlerts(60);
    const alertsByType = hourlyAlerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      current,
      hourlyStats: {
        avgRequestsPerMinute,
        maxRequestsPerMinute,
        tokenRefreshAttempts,
        circuitBreakerTrips
      },
      alerts: {
        total: hourlyAlerts.length,
        byType: alertsByType,
        critical: hourlyAlerts.filter(a => a.level === 'critical').length
      }
    };
  }

  /**
   * Format summary for console output
   */
  formatSummary(): string {
    const summary = this.generateSummary();
    const current = summary.current;
    
    if (!current) {
      return 'No metrics available yet';
    }
    
    const lines = [
      '=== Rate Limit Monitor Summary ===',
      '',
      'Token Refresh Status:',
      `  Can refresh now: ${current.tokenRefresh.canRefreshNow ? 'Yes' : 'No'}`,
      `  Time until next allowed: ${Math.ceil(current.tokenRefresh.timeUntilNextRefresh / 60000)} minutes`,
      `  Refreshes in window: ${current.tokenRefresh.refreshesInWindow}/10`,
      '',
      'API Request Status:',
      `  Requests (last minute): ${current.apiRequests.requestsPerMinute}/60 (${current.apiRequests.utilizationPercentMinute.toFixed(1)}%)`,
      `  Requests (last hour): ${current.apiRequests.requestsPerHour}/1000 (${current.apiRequests.utilizationPercentHour.toFixed(1)}%)`,
      '',
      'Circuit Breaker:',
      `  State: ${current.circuitBreaker.isOpen ? 'OPEN' : 'CLOSED'}`,
      `  Failures: ${current.circuitBreaker.consecutiveFailures}`,
      '',
      'Hourly Statistics:',
      `  Avg requests/min: ${summary.hourlyStats.avgRequestsPerMinute.toFixed(1)}`,
      `  Max requests/min: ${summary.hourlyStats.maxRequestsPerMinute}`,
      `  Token refresh attempts: ${summary.hourlyStats.tokenRefreshAttempts}`,
      `  Circuit breaker trips: ${summary.hourlyStats.circuitBreakerTrips}`,
      '',
      'Alerts (last hour):',
      `  Total: ${summary.alerts.total}`,
      `  Critical: ${summary.alerts.critical}`,
      `  By type: ${JSON.stringify(summary.alerts.byType)}`,
      '================================='
    ];
    
    return lines.join('\n');
  }
}