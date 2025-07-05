import { query, queryOne, transaction } from './config.js';
import { TokenResponse } from '../api/auth.js';

/**
 * Database-backed token storage implementation
 */
export class DatabaseTokenStore {
  /**
   * Store tokens in the database
   */
  async storeTokens(response: TokenResponse): Promise<void> {
    // Deactivate any existing active tokens
    await query(
      'UPDATE oauth_tokens SET is_active = false WHERE is_active = true'
    );
    
    // Calculate expiry time
    const expiresAt = new Date(Date.now() + response.expires_in * 1000);
    
    // Insert new token
    await query(
      `INSERT INTO oauth_tokens 
       (access_token, refresh_token, token_type, expires_at, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        response.access_token,
        response.refresh_token || null,
        response.token_type || 'Bearer',
        expiresAt,
        JSON.stringify({
          scope: response.scope,
          stored_at: new Date().toISOString()
        })
      ]
    );
    
    console.log(`Token stored in database. Expires at: ${expiresAt.toISOString()}`);
  }
  
  /**
   * Get the current active token from database
   */
  async getActiveToken(): Promise<{
    accessToken: string;
    refreshToken: string | null;
    tokenExpiry: Date;
    tokenId: number;
  } | null> {
    const token = await queryOne<{
      id: number;
      access_token: string;
      refresh_token: string | null;
      expires_at: Date;
    }>(
      `SELECT id, access_token, refresh_token, expires_at 
       FROM oauth_tokens 
       WHERE is_active = true 
       AND expires_at > NOW() 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    if (!token) return null;
    
    // Update last used timestamp
    await query(
      'UPDATE oauth_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
      [token.id]
    );
    
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiry: token.expires_at,
      tokenId: token.id
    };
  }
  
  /**
   * Get refresh token from database
   */
  async getRefreshToken(): Promise<string | null> {
    const result = await queryOne<{ refresh_token: string }>(
      `SELECT refresh_token 
       FROM oauth_tokens 
       WHERE refresh_token IS NOT NULL 
       AND is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    return result?.refresh_token || null;
  }
  
  /**
   * Check if we can request a new token (rate limiting)
   */
  async canRequestToken(): Promise<boolean> {
    const recentRequests = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM token_requests 
       WHERE requested_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes' 
       AND request_type = 'refresh'`
    );
    
    const count = parseInt(recentRequests?.count || '0');
    return count < 10; // Max 10 refresh requests per 10 minutes
  }
  
  /**
   * Record a token request for rate limiting
   */
  async recordTokenRequest(
    requestType: 'access' | 'refresh',
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await query(
      `INSERT INTO token_requests 
       (request_type, success, error_message, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        requestType,
        success,
        errorMessage || null,
        null, // IP address would come from request context
        'SDP MCP Server'
      ]
    );
  }
  
  /**
   * Update refresh count for a token
   */
  async incrementRefreshCount(tokenId: number): Promise<void> {
    await query(
      'UPDATE oauth_tokens SET refresh_count = refresh_count + 1 WHERE id = $1',
      [tokenId]
    );
  }
  
  /**
   * Check if enough time has passed since last refresh
   */
  async canRefreshNow(): Promise<boolean> {
    const lastRefresh = await queryOne<{ requested_at: Date }>(
      `SELECT requested_at 
       FROM token_requests 
       WHERE request_type = 'refresh' 
       AND success = true 
       ORDER BY requested_at DESC 
       LIMIT 1`
    );
    
    if (!lastRefresh) return true;
    
    const timeSinceLastRefresh = Date.now() - lastRefresh.requested_at.getTime();
    return timeSinceLastRefresh >= 5000; // 5 seconds minimum
  }
  
  /**
   * Get debug information about token state
   */
  async getDebugInfo(): Promise<object> {
    const activeToken = await queryOne<any>(
      `SELECT 
        id,
        token_type,
        expires_at,
        created_at,
        last_used_at,
        refresh_count,
        CASE 
          WHEN expires_at > CURRENT_TIMESTAMP THEN 'valid'
          ELSE 'expired'
        END as status
       FROM oauth_tokens 
       WHERE is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    const recentRequests = await query<any>(
      `SELECT request_type, requested_at, success, error_message 
       FROM token_requests 
       ORDER BY requested_at DESC 
       LIMIT 10`
    );
    
    return {
      activeToken,
      recentRequests,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Clean up old tokens and requests
   */
  async cleanup(): Promise<void> {
    await transaction(async (client) => {
      // Delete old inactive tokens
      await client.query(
        `DELETE FROM oauth_tokens 
         WHERE is_active = false 
         AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'`
      );
      
      // Delete old token requests
      await client.query(
        `DELETE FROM token_requests 
         WHERE requested_at < CURRENT_TIMESTAMP - INTERVAL '7 days'`
      );
      
      console.log('Database cleanup completed');
    });
  }
}