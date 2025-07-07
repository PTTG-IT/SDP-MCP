import { query, queryOne } from '../db/config.js';
import { RateLimitStore } from '../db/rateLimitStore.js';

export interface TokenRefreshAnalytics {
  totalRefreshes: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  successRate: number;
  averageRefreshInterval: number;
  refreshesByHour: Record<number, number>;
  refreshesByDay: Record<string, number>;
  commonErrors: Array<{ error: string; count: number }>;
  peakUsageHours: number[];
  toolUsage: Record<string, number>;
}

export interface TokenHealthMetrics {
  currentHealth: 'healthy' | 'warning' | 'critical';
  healthScore: number; // 0-100
  issues: string[];
  recommendations: string[];
  predictedRefreshTime?: Date;
  riskFactors: string[];
}

/**
 * Advanced analytics for token usage and health monitoring
 */
export class TokenAnalytics {
  private rateLimitStore: RateLimitStore;

  constructor() {
    this.rateLimitStore = new RateLimitStore();
  }

  /**
   * Get comprehensive token refresh analytics
   */
  async getRefreshAnalytics(days: number = 7): Promise<TokenRefreshAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all refresh attempts
    const refreshAttempts = await query<{
      requested_at: Date;
      success: boolean;
      error_message: string | null;
      metadata: any;
    }>(
      `SELECT requested_at, success, error_message, metadata
       FROM token_requests
       WHERE request_type = 'refresh'
       AND requested_at >= $1
       ORDER BY requested_at DESC`,
      [startDate]
    );

    // Calculate basic stats
    const totalRefreshes = refreshAttempts.length;
    const successfulRefreshes = refreshAttempts.filter(r => r.success).length;
    const failedRefreshes = totalRefreshes - successfulRefreshes;
    const successRate = totalRefreshes > 0 ? (successfulRefreshes / totalRefreshes) * 100 : 0;

    // Calculate average interval between successful refreshes
    const successfulAttempts = refreshAttempts
      .filter(r => r.success)
      .sort((a, b) => a.requested_at.getTime() - b.requested_at.getTime());
    
    let totalInterval = 0;
    let intervalCount = 0;
    for (let i = 1; i < successfulAttempts.length; i++) {
      const interval = successfulAttempts[i].requested_at.getTime() - 
                      successfulAttempts[i-1].requested_at.getTime();
      totalInterval += interval;
      intervalCount++;
    }
    const averageRefreshInterval = intervalCount > 0 ? totalInterval / intervalCount : 0;

    // Analyze refresh patterns by hour
    const refreshesByHour: Record<number, number> = {};
    const refreshesByDay: Record<string, number> = {};
    
    refreshAttempts.forEach(attempt => {
      const hour = attempt.requested_at.getHours();
      const day = attempt.requested_at.toISOString().split('T')[0];
      
      refreshesByHour[hour] = (refreshesByHour[hour] || 0) + 1;
      refreshesByDay[day] = (refreshesByDay[day] || 0) + 1;
    });

    // Find peak usage hours (top 3)
    const peakUsageHours = Object.entries(refreshesByHour)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Analyze common errors
    const errorCounts = new Map<string, number>();
    refreshAttempts
      .filter(r => !r.success && r.error_message)
      .forEach(r => {
        const error = r.error_message!;
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      });
    
    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Analyze tool usage from metadata
    const toolUsage: Record<string, number> = {};
    refreshAttempts.forEach(attempt => {
      if (attempt.metadata?.source) {
        const source = attempt.metadata.source;
        toolUsage[source] = (toolUsage[source] || 0) + 1;
      }
    });

    return {
      totalRefreshes,
      successfulRefreshes,
      failedRefreshes,
      successRate,
      averageRefreshInterval,
      refreshesByHour,
      refreshesByDay,
      commonErrors,
      peakUsageHours,
      toolUsage
    };
  }

  /**
   * Calculate token health metrics
   */
  async calculateTokenHealth(): Promise<TokenHealthMetrics> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: string[] = [];
    
    // Get recent analytics
    const recentAnalytics = await this.getRefreshAnalytics(1); // Last 24 hours
    const weeklyAnalytics = await this.getRefreshAnalytics(7);

    // Calculate health score (0-100)
    let healthScore = 100;

    // Check success rate
    if (recentAnalytics.successRate < 50) {
      healthScore -= 40;
      issues.push('High token refresh failure rate');
      recommendations.push('Check OAuth credentials and network connectivity');
      riskFactors.push('authentication_failures');
    } else if (recentAnalytics.successRate < 80) {
      healthScore -= 20;
      issues.push('Moderate token refresh failure rate');
    }

    // Check refresh frequency
    const avgIntervalMinutes = recentAnalytics.averageRefreshInterval / 60000;
    if (avgIntervalMinutes < 3.5 && recentAnalytics.totalRefreshes > 5) {
      healthScore -= 30;
      issues.push('Token refreshes too frequent (approaching rate limit)');
      recommendations.push('Investigate why tokens are expiring early');
      riskFactors.push('rate_limit_risk');
    }

    // Check for recent failures
    const recentFailures = await this.getRecentFailures(60); // Last hour
    if (recentFailures > 2) {
      healthScore -= 20;
      issues.push(`${recentFailures} token refresh failures in the last hour`);
      riskFactors.push('recent_failures');
    }

    // Check for patterns
    if (weeklyAnalytics.commonErrors.length > 0) {
      const topError = weeklyAnalytics.commonErrors[0];
      if (topError.count > 10) {
        issues.push(`Recurring error: ${topError.error} (${topError.count} times)`);
        recommendations.push('Address recurring authentication errors');
      }
    }

    // Predict next refresh time
    const lastRefresh = await this.rateLimitStore.getLastSuccessfulRefresh();
    let predictedRefreshTime: Date | undefined;
    if (lastRefresh && avgIntervalMinutes > 0) {
      predictedRefreshTime = new Date(lastRefresh.getTime() + recentAnalytics.averageRefreshInterval);
    }

    // Determine health status
    let currentHealth: 'healthy' | 'warning' | 'critical';
    if (healthScore >= 80) {
      currentHealth = 'healthy';
    } else if (healthScore >= 50) {
      currentHealth = 'warning';
    } else {
      currentHealth = 'critical';
    }

    // Add recommendations based on health
    if (currentHealth === 'critical') {
      recommendations.push('Immediate attention required for token management');
      recommendations.push('Consider manual intervention or service restart');
    } else if (currentHealth === 'warning') {
      recommendations.push('Monitor token refresh patterns closely');
    }

    return {
      currentHealth,
      healthScore: Math.max(0, healthScore),
      issues,
      recommendations,
      predictedRefreshTime,
      riskFactors
    };
  }

  /**
   * Get recent failure count
   */
  private async getRecentFailures(minutes: number): Promise<number> {
    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM token_requests
       WHERE request_type = 'refresh'
       AND success = false
       AND requested_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'`
    );
    
    return parseInt(result?.count || '0');
  }

  /**
   * Generate token usage report
   */
  async generateUsageReport(days: number = 30): Promise<string> {
    const analytics = await this.getRefreshAnalytics(days);
    const health = await this.calculateTokenHealth();
    
    const report = [
      '# Token Usage Report',
      `Report Period: Last ${days} days`,
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Executive Summary',
      `- Health Status: ${health.currentHealth.toUpperCase()} (Score: ${health.healthScore}/100)`,
      `- Total Refreshes: ${analytics.totalRefreshes}`,
      `- Success Rate: ${analytics.successRate.toFixed(1)}%`,
      `- Average Interval: ${Math.round(analytics.averageRefreshInterval / 60000)} minutes`,
      '',
      '## Health Analysis',
      health.issues.length > 0 ? '### Issues:' : '### No issues detected',
      ...health.issues.map(issue => `- ${issue}`),
      '',
      health.recommendations.length > 0 ? '### Recommendations:' : '',
      ...health.recommendations.map(rec => `- ${rec}`),
      '',
      '## Usage Patterns',
      `### Peak Usage Hours: ${analytics.peakUsageHours.join(', ')}`,
      '',
      '### Daily Distribution:',
      ...Object.entries(analytics.refreshesByDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 7)
        .map(([day, count]) => `- ${day}: ${count} refreshes`),
      '',
      '## Error Analysis',
      analytics.commonErrors.length > 0 ? '### Common Errors:' : '### No errors recorded',
      ...analytics.commonErrors.map((err, idx) => 
        `${idx + 1}. ${err.error} (${err.count} occurrences)`
      ),
      '',
      '## Tool Usage',
      Object.keys(analytics.toolUsage).length > 0 ? '### Refreshes by Source:' : '### No tool-specific data available',
      ...Object.entries(analytics.toolUsage)
        .sort(([, a], [, b]) => b - a)
        .map(([tool, count]) => `- ${tool}: ${count} refreshes`),
      '',
      '## Risk Assessment',
      health.riskFactors.length > 0 
        ? `### Risk Factors: ${health.riskFactors.join(', ')}`
        : '### No significant risks detected',
      '',
      health.predictedRefreshTime
        ? `### Next Predicted Refresh: ${health.predictedRefreshTime.toISOString()}`
        : '### Unable to predict next refresh time'
    ];
    
    return report.join('\n');
  }

  /**
   * Get token refresh forecast
   */
  async getRefreshForecast(hours: number = 24): Promise<{
    expectedRefreshes: number;
    peakHours: number[];
    riskPeriods: Array<{ start: Date; end: Date; reason: string }>;
  }> {
    const analytics = await this.getRefreshAnalytics(7);
    
    // Calculate expected refreshes based on average interval
    const avgInterval = analytics.averageRefreshInterval;
    const expectedRefreshes = avgInterval > 0 
      ? Math.floor((hours * 60 * 60 * 1000) / avgInterval)
      : 0;
    
    // Identify peak hours from historical data
    const peakHours = analytics.peakUsageHours;
    
    // Identify risk periods
    const riskPeriods: Array<{ start: Date; end: Date; reason: string }> = [];
    const now = new Date();
    
    // Risk period: approaching rate limit window
    const lastRefresh = await this.rateLimitStore.getLastSuccessfulRefresh();
    if (lastRefresh) {
      const nextLimitWindow = new Date(lastRefresh.getTime() + 10 * 60 * 1000); // 10 minutes
      if (nextLimitWindow > now) {
        riskPeriods.push({
          start: new Date(nextLimitWindow.getTime() - 60000), // 1 minute before
          end: nextLimitWindow,
          reason: 'Approaching 10 token per 10 minutes limit'
        });
      }
    }
    
    // Risk period: peak usage hours
    peakHours.forEach(hour => {
      const riskStart = new Date(now);
      riskStart.setHours(hour, 0, 0, 0);
      if (riskStart < now) {
        riskStart.setDate(riskStart.getDate() + 1);
      }
      
      const riskEnd = new Date(riskStart);
      riskEnd.setHours(hour + 1, 0, 0, 0);
      
      if (riskStart.getTime() - now.getTime() <= hours * 60 * 60 * 1000) {
        riskPeriods.push({
          start: riskStart,
          end: riskEnd,
          reason: 'Peak usage hour based on historical data'
        });
      }
    });
    
    return {
      expectedRefreshes,
      peakHours,
      riskPeriods: riskPeriods.sort((a, b) => a.start.getTime() - b.start.getTime())
    };
  }
}