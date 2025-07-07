import { Pool } from 'pg';
import { encryptData, decryptData, hashApiKey } from '../utils/encryption.js';
import { SDPAuthError } from '../utils/errors.js';
import axios from 'axios';

export interface TokenData {
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  scope?: string;
}

export interface RefreshTokenData {
  refreshToken: string;
  expiresAt?: Date;
  generation: number;
  maxUsageCount: number;
  usageCount: number;
}

export interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Secure Token Service implementing OAuth 2.0 best practices
 * - AES-256-GCM encryption for all tokens
 * - Token rotation with single-use refresh tokens
 * - Rate limiting awareness (Zoho: 10 tokens per 10 minutes)
 * - Comprehensive audit logging
 * - Token revocation and reuse detection
 */
export class SecureTokenService {
  private cache: Map<string, { accessToken: TokenData; cachedAt: Date }> = new Map();
  private cacheTTL = 60000; // 1 minute cache for access tokens

  constructor(
    private pool: Pool,
    private baseUrl: string = 'https://accounts.zoho.com',
    private instanceName?: string // Used for future instance-specific token management
  ) {}

  /**
   * Initialize database schema
   */
  static async initializeSchema(pool: Pool): Promise<void> {
    const fs = await import('fs');
    const migration = await fs.promises.readFile(
      './src/db/migrations/003_token_storage.sql', 
      'utf-8'
    );
    
    await pool.query(migration);
    console.log('✅ Secure token storage schema initialized');
  }

  /**
   * Get valid access token for client
   */
  async getAccessToken(clientId: string, clientSecret: string): Promise<TokenData> {
    const clientIdHash = hashApiKey(clientId);
    
    // Check cache first
    const cached = this.cache.get(clientIdHash);
    if (cached && new Date().getTime() - cached.cachedAt.getTime() < this.cacheTTL) {
      if (cached.accessToken.expiresAt > new Date()) {
        await this.logTokenUsage(clientIdHash, 'use', 'access', true);
        return cached.accessToken;
      }
    }

    // Check database for valid access token
    const accessToken = await this.getValidAccessTokenFromDB(clientIdHash);
    if (accessToken) {
      this.cache.set(clientIdHash, { accessToken, cachedAt: new Date() });
      await this.logTokenUsage(clientIdHash, 'use', 'access', true);
      return accessToken;
    }

    // Need to refresh - get refresh token and create new access token
    return await this.refreshAccessToken(clientId, clientSecret);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(clientId: string, clientSecret: string): Promise<TokenData> {
    const clientIdHash = hashApiKey(clientId);

    try {
      // Check rate limits first
      const canCreateToken = await this.checkRateLimit(clientIdHash);
      if (!canCreateToken) {
        throw new SDPAuthError(
          'Rate limit exceeded. Zoho allows maximum 10 tokens per 10 minutes. Please wait before creating new tokens.'
        );
      }

      // Get active refresh token
      const refreshTokenData = await this.getActiveRefreshToken(clientIdHash);
      if (!refreshTokenData) {
        throw new SDPAuthError(
          'No active refresh token found. Re-authorization required.'
        );
      }

      // Check if refresh token has reached usage limit
      if (refreshTokenData.usageCount >= refreshTokenData.maxUsageCount) {
        await this.revokeRefreshToken(clientIdHash, refreshTokenData.refreshToken, 'usage_limit_exceeded');
        throw new SDPAuthError(
          'Refresh token usage limit exceeded. Re-authorization required.'
        );
      }

      // Attempt token refresh
      const response = await this.performTokenRefresh(
        clientId, 
        clientSecret, 
        refreshTokenData.refreshToken
      );

      // Store new tokens
      const accessToken = await this.storeAccessToken(clientIdHash, response);
      
      // Handle refresh token rotation
      if (response.refresh_token && response.refresh_token !== refreshTokenData.refreshToken) {
        // New refresh token issued - store it and revoke old one
        await this.storeRefreshToken(clientIdHash, response.refresh_token, refreshTokenData.generation + 1);
        await this.revokeRefreshToken(clientIdHash, refreshTokenData.refreshToken, 'rotated');
      } else {
        // Update usage count for existing refresh token
        await this.updateRefreshTokenUsage(clientIdHash, refreshTokenData.refreshToken);
      }

      // Record rate limit usage
      await this.recordRateLimitUsage(clientIdHash);
      
      // Clear cache and set new token
      this.cache.delete(clientIdHash);
      this.cache.set(clientIdHash, { accessToken, cachedAt: new Date() });

      await this.logTokenUsage(clientIdHash, 'refresh', 'access', true);
      
      return accessToken;

    } catch (error) {
      await this.logTokenUsage(
        clientIdHash, 
        'refresh', 
        'access', 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Store initial refresh token (from auth code exchange)
   */
  async storeInitialTokens(
    clientId: string, 
    clientSecret: string, // Reserved for future validation use
    tokenResponse: TokenRefreshResponse
  ): Promise<{ accessToken: TokenData; refreshToken?: RefreshTokenData }> {
    const clientIdHash = hashApiKey(clientId);

    try {
      // Store access token
      const accessToken = await this.storeAccessToken(clientIdHash, tokenResponse);
      
      let refreshTokenData: RefreshTokenData | undefined;
      
      // Store refresh token if provided
      if (tokenResponse.refresh_token) {
        refreshTokenData = await this.storeRefreshToken(
          clientIdHash, 
          tokenResponse.refresh_token, 
          1 // Initial generation
        );
      }

      await this.logTokenUsage(clientIdHash, 'create', 'access', true);
      if (refreshTokenData) {
        await this.logTokenUsage(clientIdHash, 'create', 'refresh', true);
      }

      return { accessToken, refreshToken: refreshTokenData };

    } catch (error) {
      await this.logTokenUsage(
        clientIdHash, 
        'create', 
        'access', 
        false, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Revoke all tokens for a client
   */
  async revokeAllTokens(clientId: string, reason: string = 'manual_revocation'): Promise<void> {
    const clientIdHash = hashApiKey(clientId);

    await this.pool.query(`
      UPDATE oauth_refresh_tokens 
      SET is_active = false, is_revoked = true, revoked_at = CURRENT_TIMESTAMP, revocation_reason = $2
      WHERE client_id_hash = $1 AND is_active = true
    `, [clientIdHash, reason]);

    await this.pool.query(`
      DELETE FROM oauth_access_tokens WHERE client_id_hash = $1
    `, [clientIdHash]);

    this.cache.delete(clientIdHash);
    
    await this.logTokenUsage(clientIdHash, 'revoke', 'refresh', true);
  }

  // Private methods

  private async getValidAccessTokenFromDB(clientIdHash: string): Promise<TokenData | null> {
    const result = await this.pool.query(`
      SELECT encrypted_access_token, token_type, expires_at, scope
      FROM oauth_access_tokens
      WHERE client_id_hash = $1 AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `, [clientIdHash]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const accessToken = decryptData(row.encrypted_access_token);
    
    return {
      accessToken,
      tokenType: row.token_type,
      expiresAt: new Date(row.expires_at),
      scope: row.scope
    };
  }

  private async getActiveRefreshToken(clientIdHash: string): Promise<RefreshTokenData | null> {
    const result = await this.pool.query(`
      SELECT encrypted_refresh_token, expires_at, generation, max_usage_count, usage_count
      FROM oauth_refresh_tokens
      WHERE client_id_hash = $1 AND is_active = true AND is_revoked = false
      ORDER BY generation DESC
      LIMIT 1
    `, [clientIdHash]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const refreshToken = decryptData(row.encrypted_refresh_token);
    
    return {
      refreshToken,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      generation: row.generation,
      maxUsageCount: row.max_usage_count,
      usageCount: row.usage_count
    };
  }

  private async performTokenRefresh(
    clientId: string, 
    clientSecret: string, 
    refreshToken: string
  ): Promise<TokenRefreshResponse> {
    const response = await axios.post(`${this.baseUrl}/oauth/v2/token`, 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  }

  private async storeAccessToken(
    clientIdHash: string, 
    tokenResponse: TokenRefreshResponse
  ): Promise<TokenData> {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

    const encryptedToken = encryptData(tokenResponse.access_token);

    await this.pool.query(`
      INSERT INTO oauth_access_tokens 
      (client_id_hash, encrypted_access_token, token_type, expires_at, scope, source)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      clientIdHash,
      encryptedToken,
      tokenResponse.token_type || 'Bearer',
      expiresAt,
      tokenResponse.scope,
      'refresh'
    ]);

    return {
      accessToken: tokenResponse.access_token,
      tokenType: tokenResponse.token_type || 'Bearer',
      expiresAt,
      scope: tokenResponse.scope
    };
  }

  private async storeRefreshToken(
    clientIdHash: string, 
    refreshToken: string, 
    generation: number
  ): Promise<RefreshTokenData> {
    const encryptedToken = encryptData(refreshToken);

    await this.pool.query(`
      INSERT INTO oauth_refresh_tokens 
      (client_id_hash, encrypted_refresh_token, generation, max_usage_count)
      VALUES ($1, $2, $3, $4)
    `, [clientIdHash, encryptedToken, generation, 1]); // Single-use by default

    return {
      refreshToken,
      generation,
      maxUsageCount: 1,
      usageCount: 0
    };
  }

  private async updateRefreshTokenUsage(clientIdHash: string, refreshToken: string): Promise<void> {
    const encryptedToken = encryptData(refreshToken);
    
    await this.pool.query(`
      UPDATE oauth_refresh_tokens 
      SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP
      WHERE client_id_hash = $1 AND encrypted_refresh_token = $2
    `, [clientIdHash, encryptedToken]);
  }

  private async revokeRefreshToken(
    clientIdHash: string, 
    refreshToken: string, 
    reason: string
  ): Promise<void> {
    const encryptedToken = encryptData(refreshToken);
    
    await this.pool.query(`
      UPDATE oauth_refresh_tokens 
      SET is_active = false, is_revoked = true, revoked_at = CURRENT_TIMESTAMP, revocation_reason = $3
      WHERE client_id_hash = $1 AND encrypted_refresh_token = $2
    `, [clientIdHash, encryptedToken, reason]);
  }

  private async checkRateLimit(clientIdHash: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT check_rate_limit($1) as can_create',
      [clientIdHash]
    );
    
    return result.rows[0].can_create;
  }

  private async recordRateLimitUsage(clientIdHash: string): Promise<void> {
    await this.pool.query(`
      INSERT INTO token_rate_limits (client_id_hash) VALUES ($1)
    `, [clientIdHash]);
  }

  private async logTokenUsage(
    clientIdHash: string,
    action: string,
    tokenType: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.pool.query(`
      INSERT INTO token_audit_log 
      (client_id_hash, action, token_type, success, error_message)
      VALUES ($1, $2, $3, $4, $5)
    `, [clientIdHash, action, tokenType, success, errorMessage]);
  }

  /**
   * Cleanup expired tokens and old audit logs
   */
  async cleanup(): Promise<number> {
    const result = await this.pool.query('SELECT cleanup_expired_tokens()');
    return result.rows[0].cleanup_expired_tokens;
  }
}