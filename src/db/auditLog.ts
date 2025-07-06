import { query, queryOne } from './config.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Audit Logger for tracking all Service Desk Plus API calls
 */
export class AuditLogger {
  private correlationId: string | null = null;
  
  /**
   * Set correlation ID for tracking related operations
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }
  
  /**
   * Generate new correlation ID
   */
  generateCorrelationId(): string {
    this.correlationId = uuidv4();
    return this.correlationId;
  }
  
  /**
   * Log an API request/response
   */
  async logApiCall(params: {
    endpoint: string;
    method: string;
    requestData?: any;
    responseData?: any;
    statusCode?: number;
    errorMessage?: string;
    durationMs: number;
    tokenId?: number;
    userContext?: any;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO api_audit_log 
         (request_id, endpoint, method, request_data, response_data, 
          status_code, error_message, duration_ms, token_id, user_context)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          params.endpoint,
          params.method,
          params.requestData ? JSON.stringify(params.requestData) : null,
          params.responseData ? JSON.stringify(params.responseData) : null,
          params.statusCode || null,
          params.errorMessage || null,
          params.durationMs,
          params.tokenId || null,
          params.userContext ? JSON.stringify(params.userContext) : null
        ]
      );
    } catch (error) {
      // Don't let audit logging failures break the application
      console.error('Audit logging failed:', error);
    }
  }
  
  /**
   * Log MCP tool usage
   */
  async logToolUsage(params: {
    toolName: string;
    arguments: any;
    result?: any;
    success: boolean;
    errorMessage?: string;
    executionTimeMs: number;
    userContext?: any;
  }): Promise<number> {
    try {
      const result = await queryOne<{ id: number }>(
        `INSERT INTO mcp_tool_usage 
         (tool_name, arguments, result, success, error_message, 
          execution_time_ms, user_context, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          params.toolName,
          JSON.stringify(params.arguments),
          params.result ? JSON.stringify(params.result) : null,
          params.success,
          params.errorMessage || null,
          params.executionTimeMs,
          params.userContext ? JSON.stringify(params.userContext) : null,
          this.correlationId
        ]
      );
      
      return result?.id || 0;
    } catch (error) {
      console.error('Tool usage logging failed:', error);
      return 0;
    }
  }
  
  /**
   * Get recent API calls
   */
  async getRecentApiCalls(limit: number = 100): Promise<any[]> {
    return await query(
      `SELECT 
        request_id,
        timestamp,
        endpoint,
        method,
        status_code,
        error_message,
        duration_ms
       FROM api_audit_log
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );
  }
  
  /**
   * Get API call details
   */
  async getApiCallDetails(requestId: string): Promise<any> {
    return await queryOne(
      `SELECT *
       FROM api_audit_log
       WHERE request_id = $1`,
      [requestId]
    );
  }
  
  /**
   * Get tool usage history
   */
  async getToolUsageHistory(
    toolName?: string,
    limit: number = 100
  ): Promise<any[]> {
    if (toolName) {
      return await query(
        `SELECT *
         FROM mcp_tool_usage
         WHERE tool_name = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [toolName, limit]
      );
    } else {
      return await query(
        `SELECT *
         FROM mcp_tool_usage
         ORDER BY timestamp DESC
         LIMIT $1`,
        [limit]
      );
    }
  }
  
  /**
   * Get API performance statistics
   */
  async getApiStats(hours: number = 24): Promise<any> {
    const stats = await query(
      `SELECT 
        endpoint,
        method,
        COUNT(*) as call_count,
        AVG(duration_ms) as avg_duration,
        MAX(duration_ms) as max_duration,
        MIN(duration_ms) as min_duration,
        COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count
       FROM api_audit_log
       WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
       GROUP BY endpoint, method
       ORDER BY call_count DESC`,
      []
    );
    
    return stats;
  }
  
  /**
   * Get tool usage statistics
   */
  async getToolStats(hours: number = 24): Promise<any> {
    const stats = await query(
      `SELECT 
        tool_name,
        COUNT(*) as usage_count,
        AVG(execution_time_ms) as avg_execution_time,
        COUNT(CASE WHEN success = false THEN 1 END) as failure_count,
        COUNT(CASE WHEN success = true THEN 1 END) as success_count
       FROM mcp_tool_usage
       WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
       GROUP BY tool_name
       ORDER BY usage_count DESC`,
      []
    );
    
    return stats;
  }
  
  /**
   * Clean up old audit logs
   */
  async cleanup(daysToKeep: number = 30): Promise<void> {
    try {
      await query(
        `DELETE FROM api_audit_log 
         WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'`,
        []
      );
      
      await query(
        `DELETE FROM mcp_tool_usage 
         WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'`,
        []
      );
      
      console.log(`Cleaned up audit logs older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Audit log cleanup failed:', error);
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

/**
 * Add audit interceptors to axios instance
 */
export function addAuditInterceptors(axiosInstance: any): void {
  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config: any) => {
      // Add request timestamp
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error: any) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor
  axiosInstance.interceptors.response.use(
    async (response: any) => {
      // Calculate duration
      const duration = Date.now() - response.config.metadata?.startTime || 0;
      
      // Log successful request
      if (process.env.SDP_USE_AUDIT_LOG === 'true') {
        await auditLogger.logApiCall({
          endpoint: response.config.url,
          method: response.config.method?.toUpperCase() || 'GET',
          requestData: response.config.data,
          responseData: response.data,
          statusCode: response.status,
          durationMs: duration
        }).catch(err => console.error('Audit log failed:', err));
      }
      
      return response;
    },
    async (error: any) => {
      // Calculate duration
      const duration = Date.now() - error.config?.metadata?.startTime || 0;
      
      // Log failed request
      if (process.env.SDP_USE_AUDIT_LOG === 'true' && error.config) {
        await auditLogger.logApiCall({
          endpoint: error.config.url,
          method: error.config.method?.toUpperCase() || 'GET',
          requestData: error.config.data,
          responseData: error.response?.data,
          statusCode: error.response?.status,
          errorMessage: error.message,
          durationMs: duration
        }).catch(err => console.error('Audit log failed:', err));
      }
      
      return Promise.reject(error);
    }
  );
}