import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';
import { logger } from '../../monitoring/logging.js';
import { getDatabase } from '../../database/connection.js';
import { getRedisClient } from '../../utils/redis.js';

/**
 * Health check result for a component
 */
interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: Record<string, any>;
  latency?: number;
}

/**
 * System health status
 */
interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheckResult[];
  tenant?: {
    id: string;
    tokensValid: boolean;
    rateLimitStatus: string;
    lastActivity?: string;
  };
}

/**
 * Perform health checks on system components
 */
export class HealthMonitor {
  /**
   * Check database health
   */
  static async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const db = await getDatabase();
      await db.query('SELECT 1');
      
      return {
        component: 'PostgreSQL Database',
        status: 'healthy',
        message: 'Database connection is active',
        latency: Date.now() - start,
      };
    } catch (error) {
      logger.error('Database health check failed', { error });
      return {
        component: 'PostgreSQL Database',
        status: 'unhealthy',
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Check Redis health
   */
  static async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const redis = getRedisClient();
      await redis.ping();
      
      const info = await redis.info('memory');
      const memoryUsage = this.parseRedisMemory(info);
      
      return {
        component: 'Redis Cache',
        status: 'healthy',
        message: 'Redis connection is active',
        details: { memoryUsage },
        latency: Date.now() - start,
      };
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return {
        component: 'Redis Cache',
        status: 'unhealthy',
        message: 'Redis connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Check Service Desk Plus API health
   */
  static async checkSDPAPI(client: any): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Try a simple API call
      const response = await client.get('/api/v3/requests', {
        params: { 
          input_data: JSON.stringify({ 
            list_info: { row_count: 1 } 
          }) 
        },
      });
      
      if (response.status === 200) {
        return {
          component: 'Service Desk Plus API',
          status: 'healthy',
          message: 'API is responding normally',
          latency: Date.now() - start,
        };
      } else {
        return {
          component: 'Service Desk Plus API',
          status: 'degraded',
          message: `API returned status ${response.status}`,
          latency: Date.now() - start,
        };
      }
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        return {
          component: 'Service Desk Plus API',
          status: 'unhealthy',
          message: 'Authentication failed - token may be expired',
          details: { statusCode: 401 },
          latency: Date.now() - start,
        };
      } else if (status === 429) {
        return {
          component: 'Service Desk Plus API',
          status: 'degraded',
          message: 'Rate limit exceeded',
          details: { statusCode: 429 },
          latency: Date.now() - start,
        };
      } else {
        return {
          component: 'Service Desk Plus API',
          status: 'unhealthy',
          message: 'API connection failed',
          details: { 
            error: error.message,
            statusCode: status,
          },
          latency: Date.now() - start,
        };
      }
    }
  }

  /**
   * Check tenant-specific health
   */
  static async checkTenantHealth(
    tenantId: string,
    sdpClient: any
  ): Promise<SystemHealth['tenant']> {
    try {
      const db = await getDatabase();
      
      // Check token validity
      const tokenResult = await db.query(
        `SELECT expires_at, last_refreshed 
         FROM oauth_tokens 
         WHERE tenant_id = $1`,
        [tenantId]
      );
      
      const tokensValid = tokenResult.rows.length > 0 && 
        new Date(tokenResult.rows[0].expires_at) > new Date();
      
      // Check rate limit status
      const redis = getRedisClient();
      const rateLimitKey = `rate_limit:${tenantId}:requests`;
      const currentCount = await redis.get(rateLimitKey);
      
      // Get last activity
      const activityResult = await db.query(
        `SELECT MAX(timestamp) as last_activity 
         FROM audit_logs 
         WHERE tenant_id = $1`,
        [tenantId]
      );
      
      return {
        id: tenantId,
        tokensValid,
        rateLimitStatus: currentCount ? `${currentCount} requests in current window` : 'No recent requests',
        lastActivity: activityResult.rows[0]?.last_activity,
      };
    } catch (error) {
      logger.error('Tenant health check failed', { error, tenantId });
      return {
        id: tenantId,
        tokensValid: false,
        rateLimitStatus: 'Unknown',
      };
    }
  }

  /**
   * Parse Redis memory info
   */
  private static parseRedisMemory(info: string): Record<string, string> {
    const lines = info.split('\r\n');
    const memory: Record<string, string> = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.startsWith('used_memory')) {
          memory[key] = value;
        }
      }
    }
    
    return memory;
  }

  /**
   * Determine overall system health
   */
  static determineOverallHealth(checks: HealthCheckResult[]): SystemHealth['overall'] {
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    
    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

/**
 * Register health monitoring tools
 */
export function registerHealthTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // System Health Check Tool
  registry.registerTool({
    tool: createTool(
      'check_system_health',
      'Check the health status of all system components',
      z.object({
        include_tenant_details: z.boolean().default(true).optional(),
      }),
      [], // No special scopes required
      'health',
      'check'
    ),
    module: 'health',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const checks: HealthCheckResult[] = [];
      
      // Check core components
      checks.push(await HealthMonitor.checkDatabase());
      checks.push(await HealthMonitor.checkRedis());
      
      // Check SDP API for this tenant
      try {
        const client = sdpClientFactory.getClient(context.tenantId);
        checks.push(await HealthMonitor.checkSDPAPI(client));
      } catch (error) {
        checks.push({
          component: 'Service Desk Plus API',
          status: 'unhealthy',
          message: 'Unable to create API client',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
      
      // Build health report
      const health: SystemHealth = {
        overall: HealthMonitor.determineOverallHealth(checks),
        timestamp: new Date().toISOString(),
        checks,
      };
      
      // Add tenant details if requested
      if (args.include_tenant_details) {
        try {
          const client = sdpClientFactory.getClient(context.tenantId);
          health.tenant = await HealthMonitor.checkTenantHealth(context.tenantId, client);
        } catch (error) {
          logger.error('Failed to get tenant health details', { error });
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(health, null, 2),
        }],
      };
    },
  });

  // Performance Metrics Tool
  registry.registerTool({
    tool: createTool(
      'get_performance_metrics',
      'Get performance metrics for the MCP server',
      z.object({
        period: z.enum(['1h', '24h', '7d']).default('24h').optional(),
      }),
      [], // No special scopes required
      'health',
      'metrics'
    ),
    module: 'health',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      try {
        const db = await getDatabase();
        const period = args.period || '24h';
        
        // Calculate time range
        const intervals: Record<string, string> = {
          '1h': '1 hour',
          '24h': '24 hours',
          '7d': '7 days',
        };
        
        // Get tool usage metrics
        const usageResult = await db.query(
          `SELECT 
             tool_name,
             COUNT(*) as call_count,
             AVG(execution_time_ms) as avg_latency,
             MIN(execution_time_ms) as min_latency,
             MAX(execution_time_ms) as max_latency,
             COUNT(CASE WHEN success = true THEN 1 END) as success_count,
             COUNT(CASE WHEN success = false THEN 1 END) as error_count
           FROM tool_usage_stats
           WHERE tenant_id = $1 
             AND timestamp > NOW() - INTERVAL '${intervals[period]}'
           GROUP BY tool_name
           ORDER BY call_count DESC`,
          [context.tenantId]
        );
        
        // Get error trends
        const errorResult = await db.query(
          `SELECT 
             error_code,
             COUNT(*) as count
           FROM tool_usage_stats
           WHERE tenant_id = $1 
             AND success = false
             AND timestamp > NOW() - INTERVAL '${intervals[period]}'
           GROUP BY error_code
           ORDER BY count DESC
           LIMIT 10`,
          [context.tenantId]
        );
        
        const metrics = {
          period,
          timestamp: new Date().toISOString(),
          toolUsage: usageResult.rows.map(row => ({
            tool: row.tool_name,
            calls: parseInt(row.call_count),
            avgLatency: Math.round(parseFloat(row.avg_latency)),
            minLatency: Math.round(parseFloat(row.min_latency)),
            maxLatency: Math.round(parseFloat(row.max_latency)),
            successRate: (parseInt(row.success_count) / parseInt(row.call_count) * 100).toFixed(2) + '%',
          })),
          topErrors: errorResult.rows.map(row => ({
            errorCode: row.error_code,
            count: parseInt(row.count),
          })),
          summary: {
            totalCalls: usageResult.rows.reduce((sum, row) => sum + parseInt(row.call_count), 0),
            averageLatency: Math.round(
              usageResult.rows.reduce((sum, row) => sum + parseFloat(row.avg_latency) * parseInt(row.call_count), 0) /
              usageResult.rows.reduce((sum, row) => sum + parseInt(row.call_count), 0) || 0
            ),
            overallSuccessRate: (
              usageResult.rows.reduce((sum, row) => sum + parseInt(row.success_count), 0) /
              usageResult.rows.reduce((sum, row) => sum + parseInt(row.call_count), 0) * 100 || 0
            ).toFixed(2) + '%',
          },
        };
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(metrics, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to get performance metrics', { error });
        return {
          content: [{
            type: 'text',
            text: `Error retrieving performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    },
  });

  // Diagnose Issues Tool
  registry.registerTool({
    tool: createTool(
      'diagnose_issues',
      'Diagnose common issues and provide troubleshooting guidance',
      z.object({}),
      [], // No special scopes required
      'health',
      'diagnose'
    ),
    module: 'health',
    handler: async (_args: any, context: ToolContext): Promise<ToolResult> => {
      const issues: Array<{
        issue: string;
        severity: 'critical' | 'warning' | 'info';
        diagnosis: string;
        solution: string[];
      }> = [];
      
      try {
        const db = await getDatabase();
        
        // Check for expired tokens
        const tokenResult = await db.query(
          `SELECT COUNT(*) as expired_count
           FROM oauth_tokens
           WHERE tenant_id = $1 AND expires_at < NOW()`,
          [context.tenantId]
        );
        
        if (parseInt(tokenResult.rows[0].expired_count) > 0) {
          issues.push({
            issue: 'Expired OAuth Token',
            severity: 'critical',
            diagnosis: 'Your OAuth token has expired and needs to be refreshed',
            solution: [
              'The system should automatically refresh tokens',
              'If automatic refresh fails, check your refresh token validity',
              'Verify your self-client certificate is still active',
            ],
          });
        }
        
        // Check for high error rates
        const errorRateResult = await db.query(
          `SELECT 
             COUNT(CASE WHEN success = false THEN 1 END)::float / 
             COUNT(*)::float * 100 as error_rate
           FROM tool_usage_stats
           WHERE tenant_id = $1 
             AND timestamp > NOW() - INTERVAL '1 hour'
           HAVING COUNT(*) > 10`,
          [context.tenantId]
        );
        
        if (errorRateResult.rows.length > 0) {
          const errorRate = parseFloat(errorRateResult.rows[0].error_rate);
          if (errorRate > 10) {
            issues.push({
              issue: 'High Error Rate',
              severity: 'warning',
              diagnosis: `${errorRate.toFixed(2)}% of requests are failing`,
              solution: [
                'Check the error logs for specific failure reasons',
                'Verify your OAuth scopes are correctly configured',
                'Ensure Service Desk Plus API is accessible',
                'Check if you\'re hitting rate limits',
              ],
            });
          }
        }
        
        // Check for rate limit issues
        const redis = getRedisClient();
        const rateLimitKey = `rate_limit:${context.tenantId}:requests`;
        const currentCount = await redis.get(rateLimitKey);
        
        if (currentCount && parseInt(currentCount) > 80) {
          issues.push({
            issue: 'Approaching Rate Limit',
            severity: 'warning',
            diagnosis: `You've made ${currentCount} requests in the current window`,
            solution: [
              'Consider using batch operations to reduce API calls',
              'Spread operations over time',
              'Implement caching for frequently accessed data',
            ],
          });
        }
        
        // Check for connectivity issues
        try {
          const client = sdpClientFactory.getClient(context.tenantId);
          await client.get('/api/v3/requests', {
            params: { input_data: JSON.stringify({ list_info: { row_count: 1 } }) },
          });
        } catch (error: any) {
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            issues.push({
              issue: 'API Connectivity Problem',
              severity: 'critical',
              diagnosis: 'Cannot connect to Service Desk Plus API',
              solution: [
                'Verify your network connection',
                'Check if Service Desk Plus is accessible',
                'Ensure firewall rules allow HTTPS connections',
                'Verify the API URL is correct for your data center',
              ],
            });
          }
        }
        
        if (issues.length === 0) {
          issues.push({
            issue: 'No Issues Detected',
            severity: 'info',
            diagnosis: 'All systems appear to be functioning normally',
            solution: ['Continue monitoring system health regularly'],
          });
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              timestamp: new Date().toISOString(),
              tenantId: context.tenantId,
              issuesFound: issues.length > 0 ? issues.filter(i => i.severity !== 'info').length : 0,
              diagnostics: issues,
            }, null, 2),
          }],
        };
      } catch (error) {
        logger.error('Failed to diagnose issues', { error });
        return {
          content: [{
            type: 'text',
            text: `Error running diagnostics: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    },
  });
}