import { query, queryOne, transaction } from './config.js';

export interface TokenRefreshRecord {
  id?: number;
  refreshTime: Date;
  success: boolean;
  errorMessage?: string;
}

export interface ApiRequestRecord {
  id?: number;
  requestTime: Date;
  endpoint: string;
  statusCode: number;
  duration: number;
}

/**
 * Database store for rate limit tracking
 * Provides persistent storage for rate limiting across instances
 */
export class RateLimitStore {
  /**
   * Get recent token refresh attempts
   */
  async getRecentTokenRefreshes(minutes: number = 10): Promise<TokenRefreshRecord[]> {
    const result = await query<TokenRefreshRecord>(
      `SELECT 
        id,
        requested_at as "refreshTime",
        success,
        error_message as "errorMessage"
       FROM token_requests
       WHERE request_type = 'refresh'
       AND requested_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'
       ORDER BY requested_at DESC`
    );
    
    return result;
  }
  
  /**
   * Get last successful token refresh
   */
  async getLastSuccessfulRefresh(): Promise<Date | null> {
    const result = await queryOne<{ requested_at: Date }>(
      `SELECT requested_at
       FROM token_requests
       WHERE request_type = 'refresh'
       AND success = true
       ORDER BY requested_at DESC
       LIMIT 1`
    );
    
    return result?.requested_at || null;
  }
  
  /**
   * Check if token refresh is allowed based on database state
   */
  async canRefreshToken(): Promise<{
    allowed: boolean;
    reason?: string;
    nextAllowedTime?: Date;
  }> {
    // Check last refresh time (no more than 1 every 3 minutes)
    const lastRefresh = await this.getLastSuccessfulRefresh();
    if (lastRefresh) {
      const timeSinceLastRefresh = Date.now() - lastRefresh.getTime();
      const threeMinutes = 3 * 60 * 1000;
      
      if (timeSinceLastRefresh < threeMinutes) {
        const nextAllowed = new Date(lastRefresh.getTime() + threeMinutes);
        return {
          allowed: false,
          reason: 'Rate limit: No more than 1 refresh every 3 minutes',
          nextAllowedTime: nextAllowed
        };
      }
    }
    
    // Check 10 tokens per 10 minutes limit
    const recentRefreshes = await this.getRecentTokenRefreshes(10);
    const successfulRefreshes = recentRefreshes.filter(r => r.success).length;
    
    if (successfulRefreshes >= 10) {
      // Find when the oldest refresh will expire from the window
      const oldestInWindow = recentRefreshes
        .filter(r => r.success)
        .sort((a, b) => a.refreshTime.getTime() - b.refreshTime.getTime())[0];
      
      if (oldestInWindow) {
        const nextAllowed = new Date(oldestInWindow.refreshTime.getTime() + 10 * 60 * 1000);
        return {
          allowed: false,
          reason: 'Rate limit: Maximum 10 tokens per 10 minutes reached',
          nextAllowedTime: nextAllowed
        };
      }
    }
    
    return { allowed: true };
  }
  
  /**
   * Record a token refresh attempt
   */
  async recordTokenRefresh(
    success: boolean,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await query(
      `INSERT INTO token_requests 
       (request_type, success, error_message, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'refresh',
        success,
        errorMessage || null,
        metadata?.ipAddress || null,
        metadata?.userAgent || 'SDP MCP Server',
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  }
  
  /**
   * Get API request statistics for rate limiting
   */
  async getApiRequestStats(minutes: number = 60): Promise<{
    totalRequests: number;
    requestsByEndpoint: Record<string, number>;
    averageResponseTime: number;
    errorRate: number;
  }> {
    const stats = await queryOne<{
      total_requests: string;
      avg_duration: string;
      error_count: string;
    }>(
      `SELECT 
        COUNT(*) as total_requests,
        AVG(duration_ms) as avg_duration,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as error_count
       FROM api_audit_log
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'`
    );
    
    const byEndpoint = await query<{
      endpoint: string;
      count: string;
    }>(
      `SELECT 
        endpoint,
        COUNT(*) as count
       FROM api_audit_log
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'
       GROUP BY endpoint
       ORDER BY count DESC`
    );
    
    const totalRequests = parseInt(stats?.total_requests || '0');
    const errorCount = parseInt(stats?.error_count || '0');
    
    return {
      totalRequests,
      requestsByEndpoint: byEndpoint.reduce((acc, row) => {
        acc[row.endpoint] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      averageResponseTime: parseFloat(stats?.avg_duration || '0'),
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
  }
  
  /**
   * Acquire a distributed lock for token refresh
   * Prevents multiple instances from refreshing simultaneously
   */
  async acquireRefreshLock(instanceId: string, timeoutMs: number = 30000): Promise<boolean> {
    try {
      // Try to insert a lock record
      await query(
        `INSERT INTO distributed_locks 
         (lock_name, locked_by, locked_at, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '${timeoutMs} milliseconds')
         ON CONFLICT (lock_name) DO NOTHING`,
        ['token_refresh', instanceId]
      );
      
      // Check if we got the lock
      const lock = await queryOne<{ locked_by: string }>(
        `SELECT locked_by 
         FROM distributed_locks 
         WHERE lock_name = $1 
         AND expires_at > CURRENT_TIMESTAMP`,
        ['token_refresh']
      );
      
      return lock?.locked_by === instanceId;
    } catch (error) {
      console.error('Failed to acquire refresh lock:', error);
      return false;
    }
  }
  
  /**
   * Release a distributed lock
   */
  async releaseRefreshLock(instanceId: string): Promise<void> {
    await query(
      `DELETE FROM distributed_locks 
       WHERE lock_name = $1 AND locked_by = $2`,
      ['token_refresh', instanceId]
    );
  }
  
  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks(): Promise<void> {
    await query(
      `DELETE FROM distributed_locks 
       WHERE expires_at < CURRENT_TIMESTAMP`
    );
  }
  
  /**
   * Get circuit breaker state from database
   */
  async getCircuitBreakerState(name: string): Promise<{
    state: 'closed' | 'open' | 'half_open';
    failures: number;
    lastFailure: Date | null;
    lastStateChange: Date | null;
  } | null> {
    const result = await queryOne<{
      state: string;
      failure_count: number;
      last_failure_at: Date | null;
      state_changed_at: Date;
    }>(
      `SELECT 
        state,
        failure_count,
        last_failure_at,
        state_changed_at
       FROM circuit_breakers
       WHERE name = $1`,
      [name]
    );
    
    if (!result) return null;
    
    return {
      state: result.state as 'closed' | 'open' | 'half_open',
      failures: result.failure_count,
      lastFailure: result.last_failure_at,
      lastStateChange: result.state_changed_at
    };
  }
  
  /**
   * Update circuit breaker state
   */
  async updateCircuitBreakerState(
    name: string,
    state: 'closed' | 'open' | 'half_open',
    failures: number
  ): Promise<void> {
    await query(
      `INSERT INTO circuit_breakers 
       (name, state, failure_count, last_failure_at, state_changed_at)
       VALUES ($1, $2, $3, CASE WHEN $3 > 0 THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
       ON CONFLICT (name) DO UPDATE SET
         state = EXCLUDED.state,
         failure_count = EXCLUDED.failure_count,
         last_failure_at = CASE WHEN EXCLUDED.failure_count > circuit_breakers.failure_count 
                          THEN CURRENT_TIMESTAMP 
                          ELSE circuit_breakers.last_failure_at END,
         state_changed_at = CASE WHEN EXCLUDED.state != circuit_breakers.state 
                           THEN CURRENT_TIMESTAMP 
                           ELSE circuit_breakers.state_changed_at END`,
      [name, state, failures]
    );
  }
  
  /**
   * Create necessary tables if they don't exist
   */
  async ensureTables(): Promise<void> {
    await transaction(async (client) => {
      // Distributed locks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS distributed_locks (
          lock_name VARCHAR(255) PRIMARY KEY,
          locked_by VARCHAR(255) NOT NULL,
          locked_at TIMESTAMP NOT NULL,
          expires_at TIMESTAMP NOT NULL
        )
      `);
      
      // Circuit breakers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS circuit_breakers (
          name VARCHAR(255) PRIMARY KEY,
          state VARCHAR(20) NOT NULL,
          failure_count INTEGER DEFAULT 0,
          last_failure_at TIMESTAMP,
          state_changed_at TIMESTAMP NOT NULL,
          metadata JSONB
        )
      `);
      
      // Add index for token requests if not exists
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_token_requests_type_time 
        ON token_requests(request_type, requested_at DESC)
      `);
    });
  }
}