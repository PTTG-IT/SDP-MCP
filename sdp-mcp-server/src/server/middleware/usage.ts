import type { Response, NextFunction } from 'express';
import { logger } from '../../monitoring/logging.js';
import { getDatabase } from '../../database/connection.js';
import type { MCPRequest } from '../types.js';

/**
 * Track usage middleware
 * Records tool usage statistics for analytics
 */
export function trackUsage() {
  return async (req: MCPRequest, res: Response, next: NextFunction): Promise<void> => {
    // Skip if no context
    if (!req.context) {
      next();
      return;
    }

    const startTime = Date.now();
    const { tenantId, clientId, sessionId } = req.context;

    // Override res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log usage asynchronously (don't block response)
      recordUsage({
        tenantId,
        clientId: clientId || 'unknown',
        sessionId: sessionId || 'unknown',
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        timestamp: new Date(),
        userAgent: req.get('user-agent'),
        ip: req.ip,
      }).catch(error => {
        logger.error('Failed to record usage', { error });
      });

      return originalJson(data);
    };

    next();
  };
}

/**
 * Record usage data
 */
async function recordUsage(data: {
  tenantId: string;
  clientId: string;
  sessionId: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}): Promise<void> {
  try {
    const db = await getDatabase();
    
    // Extract tool name from path if it's a tool call
    let toolName: string | null = null;
    if (data.path.includes('/tools/call')) {
      // Tool name would be in request body
      // For now, we'll set it as 'unknown'
      toolName = 'unknown';
    }

    // Insert usage record
    await db.query(
      `INSERT INTO tool_usage_stats (
        tenant_id,
        tool_name,
        success,
        execution_time_ms,
        error_code,
        timestamp,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.tenantId,
        toolName || data.path,
        data.statusCode < 400,
        data.duration,
        data.statusCode >= 400 ? data.statusCode.toString() : null,
        data.timestamp,
        JSON.stringify({
          clientId: data.clientId,
          sessionId: data.sessionId,
          method: data.method,
          statusCode: data.statusCode,
          userAgent: data.userAgent,
          ip: data.ip,
        }),
      ]
    );

    logger.debug('Usage recorded', {
      tenantId: data.tenantId,
      path: data.path,
      duration: data.duration,
      success: data.statusCode < 400,
    });
  } catch (error) {
    logger.error('Failed to record usage in database', { error, data });
  }
}

/**
 * Get usage statistics for a tenant
 */
export async function getUsageStats(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  toolUsage: Record<string, number>;
  errorCodes: Record<string, number>;
}> {
  try {
    const db = await getDatabase();
    
    // Build date filter
    let dateFilter = '';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (startDate) {
      dateFilter += ` AND timestamp >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      dateFilter += ` AND timestamp <= $${paramIndex}`;
      params.push(endDate);
    }

    // Get overall statistics
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_requests,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_requests,
        AVG(execution_time_ms) as avg_response_time
      FROM tool_usage_stats
      WHERE tenant_id = $1 ${dateFilter}`,
      params
    );

    const stats = statsResult.rows[0];

    // Get tool usage breakdown
    const toolUsageResult = await db.query(
      `SELECT 
        tool_name,
        COUNT(*) as usage_count
      FROM tool_usage_stats
      WHERE tenant_id = $1 ${dateFilter}
      GROUP BY tool_name
      ORDER BY usage_count DESC`,
      params
    );

    const toolUsage: Record<string, number> = {};
    for (const row of toolUsageResult.rows) {
      toolUsage[row.tool_name] = parseInt(row.usage_count);
    }

    // Get error code breakdown
    const errorResult = await db.query(
      `SELECT 
        error_code,
        COUNT(*) as error_count
      FROM tool_usage_stats
      WHERE tenant_id = $1 
        AND error_code IS NOT NULL
        ${dateFilter}
      GROUP BY error_code
      ORDER BY error_count DESC`,
      params
    );

    const errorCodes: Record<string, number> = {};
    for (const row of errorResult.rows) {
      errorCodes[row.error_code] = parseInt(row.error_count);
    }

    return {
      totalRequests: parseInt(stats.total_requests),
      successfulRequests: parseInt(stats.successful_requests),
      failedRequests: parseInt(stats.failed_requests),
      averageResponseTime: parseFloat(stats.avg_response_time) || 0,
      toolUsage,
      errorCodes,
    };
  } catch (error) {
    logger.error('Failed to get usage statistics', { error, tenantId });
    throw error;
  }
}

/**
 * Usage analytics middleware
 * Provides detailed analytics endpoints
 */
export function usageAnalytics() {
  return async (req: MCPRequest, res: Response, next: NextFunction): Promise<void> => {
    // Add analytics endpoints
    if (req.path === '/analytics/usage' && req.method === 'GET') {
      if (!req.context) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        const { startDate, endDate } = req.query;
        const stats = await getUsageStats(
          req.context.tenantId,
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );

        res.json(stats);
      } catch (error) {
        logger.error('Failed to get usage analytics', { error });
        res.status(500).json({ error: 'Failed to retrieve usage statistics' });
      }
      return;
    }

    next();
  };
}