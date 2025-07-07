import { EventEmitter } from 'events';
import { logger } from './logging.js';
import { RateLimitManager } from '../middleware/rateLimiter.js';
import { TenantManager } from '../tenants/manager.js';
import { getRedisClient } from '../utils/redis.js';
import { RATE_LIMIT_TIERS } from '../tenants/models/tenant.js';
import type { RateLimitTier } from '../database/models/types.js';

/**
 * Rate limit alert thresholds
 */
interface AlertThresholds {
  warningPercentage: number;  // Warn when usage exceeds this percentage
  criticalPercentage: number; // Critical alert when usage exceeds this percentage
}

/**
 * Rate limit usage metrics
 */
export interface RateLimitMetrics {
  tenantId: string;
  tenantName: string;
  tier: RateLimitTier;
  usage: {
    minute: {
      current: number;
      limit: number;
      percentage: number;
    };
    hour: {
      current: number;
      limit: number;
      percentage: number;
    };
    day: {
      current: number;
      limit: number;
      percentage: number;
    };
  };
  alerts: {
    minute: 'normal' | 'warning' | 'critical';
    hour: 'normal' | 'warning' | 'critical';
    day: 'normal' | 'warning' | 'critical';
  };
  timestamp: Date;
}

/**
 * Rate limit monitor for tracking and alerting
 */
export class RateLimitMonitor extends EventEmitter {
  private readonly rateLimitManager: RateLimitManager;
  private readonly tenantManager: TenantManager;
  private readonly checkInterval: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private readonly thresholds: AlertThresholds;
  
  constructor(
    tenantManager: TenantManager,
    checkInterval: number = 60000, // 1 minute
    thresholds: AlertThresholds = {
      warningPercentage: 80,
      criticalPercentage: 95,
    }
  ) {
    super();
    this.tenantManager = tenantManager;
    this.rateLimitManager = new RateLimitManager();
    this.checkInterval = checkInterval;
    this.thresholds = thresholds;
  }
  
  /**
   * Start monitoring
   */
  start(): void {
    if (this.intervalHandle) {
      logger.warn('Rate limit monitor already running');
      return;
    }
    
    logger.info('Starting rate limit monitor', {
      checkInterval: this.checkInterval,
      thresholds: this.thresholds,
    });
    
    // Run initial check
    void this.checkAllTenants();
    
    // Schedule periodic checks
    this.intervalHandle = setInterval(() => {
      void this.checkAllTenants();
    }, this.checkInterval);
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Rate limit monitor stopped');
    }
  }
  
  /**
   * Check all active tenants
   */
  private async checkAllTenants(): Promise<void> {
    try {
      const tenants = await this.tenantManager.listActiveTenants();
      
      for (const tenant of tenants) {
        try {
          const metrics = await this.getTenantMetrics(tenant.id);
          
          // Check for alerts
          this.checkAlerts(metrics);
          
          // Emit metrics event
          this.emit('metrics', metrics);
          
        } catch (error) {
          logger.error('Failed to check tenant rate limits', {
            tenantId: tenant.id,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check rate limits', { error });
    }
  }
  
  /**
   * Get metrics for a specific tenant
   */
  async getTenantMetrics(tenantId: string): Promise<RateLimitMetrics> {
    const tenant = await this.tenantManager.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    const usage = await this.rateLimitManager.getTenantUsage(tenantId);
    const limits = RATE_LIMIT_TIERS[tenant.rateLimitTier];
    
    const metrics: RateLimitMetrics = {
      tenantId,
      tenantName: tenant.name,
      tier: tenant.rateLimitTier,
      usage: {
        minute: {
          current: usage.minute,
          limit: limits.requestsPerMinute,
          percentage: (usage.minute / limits.requestsPerMinute) * 100,
        },
        hour: {
          current: usage.hour,
          limit: limits.requestsPerHour,
          percentage: (usage.hour / limits.requestsPerHour) * 100,
        },
        day: {
          current: usage.day,
          limit: limits.requestsPerDay,
          percentage: (usage.day / limits.requestsPerDay) * 100,
        },
      },
      alerts: {
        minute: this.getAlertLevel(usage.minute, limits.requestsPerMinute),
        hour: this.getAlertLevel(usage.hour, limits.requestsPerHour),
        day: this.getAlertLevel(usage.day, limits.requestsPerDay),
      },
      timestamp: new Date(),
    };
    
    return metrics;
  }
  
  /**
   * Get alert level based on usage
   */
  private getAlertLevel(current: number, limit: number): 'normal' | 'warning' | 'critical' {
    const percentage = (current / limit) * 100;
    
    if (percentage >= this.thresholds.criticalPercentage) {
      return 'critical';
    } else if (percentage >= this.thresholds.warningPercentage) {
      return 'warning';
    }
    
    return 'normal';
  }
  
  /**
   * Check for alerts and emit events
   */
  private checkAlerts(metrics: RateLimitMetrics): void {
    // Check minute alerts
    if (metrics.alerts.minute === 'critical') {
      this.emit('critical', {
        tenantId: metrics.tenantId,
        tenantName: metrics.tenantName,
        window: 'minute',
        usage: metrics.usage.minute,
      });
    } else if (metrics.alerts.minute === 'warning') {
      this.emit('warning', {
        tenantId: metrics.tenantId,
        tenantName: metrics.tenantName,
        window: 'minute',
        usage: metrics.usage.minute,
      });
    }
    
    // Check hour alerts
    if (metrics.alerts.hour === 'critical') {
      this.emit('critical', {
        tenantId: metrics.tenantId,
        tenantName: metrics.tenantName,
        window: 'hour',
        usage: metrics.usage.hour,
      });
    } else if (metrics.alerts.hour === 'warning') {
      this.emit('warning', {
        tenantId: metrics.tenantId,
        tenantName: metrics.tenantName,
        window: 'hour',
        usage: metrics.usage.hour,
      });
    }
    
    // Check day alerts
    if (metrics.alerts.day === 'critical') {
      this.emit('critical', {
        tenantId: metrics.tenantId,
        tenantName: metrics.tenantName,
        window: 'day',
        usage: metrics.usage.day,
      });
    } else if (metrics.alerts.day === 'warning') {
      this.emit('warning', {
        tenantId: metrics.tenantId,
        tenantName: metrics.tenantName,
        window: 'day',
        usage: metrics.usage.day,
      });
    }
  }
  
  /**
   * Get aggregated metrics for all tenants
   */
  async getAggregatedMetrics(): Promise<{
    totalTenants: number;
    tenantsAtWarning: number;
    tenantsAtCritical: number;
    topConsumers: RateLimitMetrics[];
  }> {
    const tenants = await this.tenantManager.listActiveTenants();
    const allMetrics: RateLimitMetrics[] = [];
    let tenantsAtWarning = 0;
    let tenantsAtCritical = 0;
    
    for (const tenant of tenants) {
      try {
        const metrics = await this.getTenantMetrics(tenant.id);
        allMetrics.push(metrics);
        
        // Count warning/critical tenants
        const hasWarning = Object.values(metrics.alerts).includes('warning');
        const hasCritical = Object.values(metrics.alerts).includes('critical');
        
        if (hasCritical) {
          tenantsAtCritical++;
        } else if (hasWarning) {
          tenantsAtWarning++;
        }
      } catch (error) {
        logger.error('Failed to get tenant metrics', {
          tenantId: tenant.id,
          error,
        });
      }
    }
    
    // Sort by highest usage percentage
    const topConsumers = allMetrics
      .sort((a, b) => {
        const aMax = Math.max(
          a.usage.minute.percentage,
          a.usage.hour.percentage,
          a.usage.day.percentage
        );
        const bMax = Math.max(
          b.usage.minute.percentage,
          b.usage.hour.percentage,
          b.usage.day.percentage
        );
        return bMax - aMax;
      })
      .slice(0, 10); // Top 10 consumers
    
    return {
      totalTenants: tenants.length,
      tenantsAtWarning,
      tenantsAtCritical,
      topConsumers,
    };
  }
}

/**
 * Create rate limit monitor with alert handlers
 */
export function createRateLimitMonitor(
  tenantManager: TenantManager,
  options?: {
    checkInterval?: number;
    thresholds?: AlertThresholds;
    onWarning?: (alert: any) => void;
    onCritical?: (alert: any) => void;
  }
): RateLimitMonitor {
  const monitor = new RateLimitMonitor(
    tenantManager,
    options?.checkInterval,
    options?.thresholds
  );
  
  // Set up alert handlers
  if (options?.onWarning) {
    monitor.on('warning', options.onWarning);
  } else {
    monitor.on('warning', (alert) => {
      logger.warn('Rate limit warning', alert);
    });
  }
  
  if (options?.onCritical) {
    monitor.on('critical', options.onCritical);
  } else {
    monitor.on('critical', (alert) => {
      logger.error('Rate limit critical alert', alert);
    });
  }
  
  // Log metrics periodically
  monitor.on('metrics', (metrics: RateLimitMetrics) => {
    if (metrics.alerts.minute !== 'normal' ||
        metrics.alerts.hour !== 'normal' ||
        metrics.alerts.day !== 'normal') {
      logger.info('Rate limit metrics', {
        tenantId: metrics.tenantId,
        tenantName: metrics.tenantName,
        usage: metrics.usage,
        alerts: metrics.alerts,
      });
    }
  });
  
  return monitor;
}