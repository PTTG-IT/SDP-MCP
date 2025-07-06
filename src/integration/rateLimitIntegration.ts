import { RateLimitCoordinator } from '../api/rateLimitCoordinator.js';
import { TokenManager } from '../api/tokenManager.js';
import { RateLimitMonitor } from '../monitoring/rateLimitMonitor.js';
import { InstanceCoordinator } from '../coordination/instanceCoordinator.js';
import { RequestQueue } from '../queue/requestQueue.js';
import { TokenAnalytics } from '../analytics/tokenAnalytics.js';
import { AuthManagerV2 } from '../api/authV2.js';
import { SDPConfig } from '../api/types.js';
import { getDbPool } from '../db/config.js';

export interface RateLimitSystemOptions {
  enableMonitoring?: boolean;
  enableAnalytics?: boolean;
  enableQueue?: boolean;
  enableCoordination?: boolean;
  monitoringInterval?: number;
  queueOptions?: any;
}

/**
 * Integrated rate limit system that combines all components
 */
export class RateLimitSystem {
  private coordinator: RateLimitCoordinator;
  private tokenManager: TokenManager;
  private monitor?: RateLimitMonitor;
  private instanceCoordinator?: InstanceCoordinator;
  private requestQueue?: RequestQueue;
  private analytics?: TokenAnalytics;
  private isStarted: boolean = false;

  constructor(
    authManager: AuthManagerV2,
    config: SDPConfig,
    private options: RateLimitSystemOptions = {}
  ) {
    this.coordinator = RateLimitCoordinator.getInstance();
    this.tokenManager = TokenManager.getInstance(authManager, config);
    
    if (options.enableMonitoring !== false) {
      this.monitor = new RateLimitMonitor();
      this.monitor.setTokenManager(this.tokenManager);
    }
    
    if (options.enableAnalytics) {
      this.analytics = new TokenAnalytics();
    }
    
    if (options.enableQueue) {
      this.requestQueue = new RequestQueue(options.queueOptions);
    }
    
    if (options.enableCoordination) {
      this.instanceCoordinator = new InstanceCoordinator();
    }
  }

  /**
   * Start all components
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      console.log('Rate limit system already started');
      return;
    }
    
    console.log('Starting integrated rate limit system...');
    
    // Ensure database tables
    await this.ensureDatabaseTables();
    
    // Initialize coordinator from database
    await this.coordinator.initializeFromDatabase();
    
    // Start instance coordinator first (for leader election)
    if (this.instanceCoordinator) {
      await this.instanceCoordinator.start();
      
      // Only primary instance manages tokens
      this.instanceCoordinator.on('role', async (role) => {
        if (role === 'primary') {
          console.log('This instance is now PRIMARY - starting token management');
          await this.tokenManager.start();
        } else {
          console.log('This instance is SECONDARY - stopping token management');
          this.tokenManager.stop();
        }
      });
      
      // Wait for initial role assignment
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      // No coordination - start token manager directly
      await this.tokenManager.start();
    }
    
    // Start monitoring
    if (this.monitor) {
      this.monitor.start(this.options.monitoringInterval);
      this.setupMonitoringAlerts();
    }
    
    // Start request queue
    if (this.requestQueue) {
      await this.requestQueue.start();
      this.setupQueueHandlers();
    }
    
    this.isStarted = true;
    console.log('Rate limit system started successfully');
    
    // Log initial status
    await this.logSystemStatus();
  }

  /**
   * Stop all components
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }
    
    console.log('Stopping rate limit system...');
    
    // Stop components in reverse order
    if (this.requestQueue) {
      await this.requestQueue.stop();
    }
    
    if (this.monitor) {
      this.monitor.stop();
    }
    
    this.tokenManager.stop();
    
    if (this.instanceCoordinator) {
      await this.instanceCoordinator.stop();
    }
    
    this.isStarted = false;
    console.log('Rate limit system stopped');
  }

  /**
   * Setup monitoring alerts
   */
  private setupMonitoringAlerts(): void {
    if (!this.monitor) return;
    
    this.monitor.on('alert', async (alert) => {
      console.log(`[RATE LIMIT ALERT] ${alert.level}: ${alert.type} - ${alert.message}`);
      
      // Handle critical alerts
      if (alert.level === 'critical') {
        if (alert.type === 'token_refresh' && this.requestQueue) {
          // Queue a high-priority token refresh
          await this.requestQueue.enqueue(
            'token_refresh',
            { reason: 'critical_alert' },
            'high',
            { alert }
          );
        }
      }
    });
  }

  /**
   * Setup queue handlers
   */
  private setupQueueHandlers(): void {
    if (!this.requestQueue) return;
    
    this.requestQueue.on('failed', async (event) => {
      console.error(`Queue request failed: ${event.id} - ${event.error}`);
      
      // Record failure in analytics
      if (this.analytics && event.type === 'token_refresh') {
        await this.coordinator.recordTokenRefresh(false, event.error);
      }
    });
    
    this.requestQueue.on('completed', (event) => {
      console.log(`Queue request completed: ${event.id} (${event.type})`);
    });
  }

  /**
   * Get comprehensive system status
   */
  async getStatus(): Promise<{
    coordinator: any;
    tokenManager: any;
    monitor?: any;
    analytics?: any;
    queue?: any;
    instance?: any;
  }> {
    const status: any = {
      coordinator: this.coordinator.getStatus(),
      tokenManager: this.tokenManager.getStatus()
    };
    
    if (this.monitor) {
      status.monitor = this.monitor.getCurrentMetrics();
    }
    
    if (this.analytics) {
      status.analytics = await this.analytics.calculateTokenHealth();
    }
    
    if (this.requestQueue) {
      status.queue = await this.requestQueue.getStatistics();
    }
    
    if (this.instanceCoordinator) {
      status.instance = await this.instanceCoordinator.getStatus();
    }
    
    return status;
  }

  /**
   * Generate system report
   */
  async generateReport(days: number = 7): Promise<string> {
    const sections: string[] = ['# Rate Limit System Report'];
    sections.push(`Generated: ${new Date().toISOString()}\n`);
    
    // System status
    const status = await this.getStatus();
    sections.push('## Current Status');
    sections.push(`- Token Refresh Allowed: ${status.coordinator.tokenRefresh.canRefreshNow}`);
    sections.push(`- API Requests (last min): ${status.coordinator.apiRequests.requestsLastMinute}`);
    sections.push(`- Circuit Breaker: ${status.coordinator.circuitBreaker.state}`);
    
    if (status.instance) {
      sections.push(`- Instance Role: ${status.instance.role}`);
      sections.push(`- Active Instances: ${status.instance.activeInstances}`);
    }
    
    // Analytics report
    if (this.analytics) {
      sections.push('\n## Token Analytics');
      const report = await this.analytics.generateUsageReport(days);
      sections.push(report);
    }
    
    // Queue statistics
    if (status.queue) {
      sections.push('\n## Request Queue');
      sections.push(`- Pending: ${status.queue.pending}`);
      sections.push(`- Processing: ${status.queue.processing}`);
      sections.push(`- Success Rate: ${status.queue.successRate.toFixed(1)}%`);
    }
    
    // Monitoring summary
    if (this.monitor) {
      sections.push('\n## Monitoring Summary');
      sections.push(this.monitor.formatSummary());
    }
    
    return sections.join('\n');
  }

  /**
   * Log system status
   */
  private async logSystemStatus(): Promise<void> {
    const status = await this.getStatus();
    
    console.log('\n=== Rate Limit System Status ===');
    console.log(`Token Refresh: ${status.coordinator.tokenRefresh.canRefreshNow ? 'AVAILABLE' : 'BLOCKED'}`);
    console.log(`Circuit Breaker: ${status.coordinator.circuitBreaker.state}`);
    
    if (status.instance) {
      console.log(`Instance Role: ${status.instance.role.toUpperCase()}`);
    }
    
    if (status.analytics) {
      console.log(`Token Health: ${status.analytics.currentHealth.toUpperCase()} (${status.analytics.healthScore}/100)`);
    }
    
    console.log('================================\n');
  }

  /**
   * Ensure all database tables exist
   */
  private async ensureDatabaseTables(): Promise<void> {
    // Check if database is available
    const pool = getDbPool();
    if (!pool) {
      console.log('Database not configured - skipping table creation');
      return;
    }
    
    // Create tables for each component
    if (this.instanceCoordinator) {
      await InstanceCoordinator.ensureTables();
    }
    
    // RateLimitStore tables are created by the store itself
    
    console.log('Database tables verified');
  }

  /**
   * Queue an API request
   */
  async queueApiRequest(
    payload: any,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<string | null> {
    if (!this.requestQueue) {
      console.warn('Request queue not enabled');
      return null;
    }
    
    return await this.requestQueue.enqueue('api_request', payload, priority);
  }

  /**
   * Queue a token refresh
   */
  async queueTokenRefresh(
    priority: 'high' | 'normal' | 'low' = 'high'
  ): Promise<string | null> {
    if (!this.requestQueue) {
      console.warn('Request queue not enabled');
      return null;
    }
    
    return await this.requestQueue.enqueue('token_refresh', {}, priority);
  }

  /**
   * Get analytics forecast
   */
  async getForecast(hours: number = 24): Promise<any> {
    if (!this.analytics) {
      return null;
    }
    
    return await this.analytics.getRefreshForecast(hours);
  }

  /**
   * Force token refresh (emergency use only)
   */
  async forceTokenRefresh(): Promise<void> {
    console.warn('FORCE TOKEN REFRESH REQUESTED - Use with caution');
    
    // Reset circuit breaker
    this.coordinator.resetCircuitBreaker();
    
    // Force refresh
    await this.tokenManager.forceRefresh();
  }
}