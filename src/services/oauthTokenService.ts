import { Pool } from 'pg';
import crypto from 'crypto';
import { encryptData, decryptData, hashApiKey } from '../utils/encryption.js';
import { SDPAuthError } from '../utils/errors.js';
import axios from 'axios';

export interface OAuthTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Service for managing OAuth tokens with Self Client authentication
 */
export class OAuthTokenService {
  private cache: Map<string, { data: OAuthTokenData; cachedAt: Date }> = new Map();
  private cacheTTL = 300000; // 5 minutes

  constructor(
    private pool: Pool,
    private baseUrl: string,
    private instanceName: string
  ) {}

  /**
   * Initialize database schema
   */
  static async initializeSchema(pool: Pool): Promise<void> {
    const migration = await import('fs').then(fs => 
      fs.promises.readFile('./src/db/migrations/002_oauth_tokens.sql', 'utf-8')
    );
    
    await pool.query(migration);
    console.log('✅ OAuth tokens schema initialized');
  }

  /**
   * Get or create OAuth tokens for a client
   */
  async getTokensForClient(clientId: string, clientSecret: string): Promise<OAuthTokenData> {
    const clientIdHash = hashApiKey(clientId);
    
    // Check cache first
    const cached = this.cache.get(clientIdHash);
    if (cached && new Date().getTime() - cached.cachedAt.getTime() < this.cacheTTL) {
      // Check if token is still valid
      if (cached.data.expiresAt > new Date()) {
        return cached.data;
      }
    }

    // Check database
    const result = await this.pool.query(
      'SELECT * FROM oauth_tokens WHERE client_id_hash = $1',
      [clientIdHash]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const decrypted = decryptData(row.encrypted_tokens);
      const tokenData: OAuthTokenData = JSON.parse(decrypted);
      
      // Convert expires_at string to Date
      tokenData.expiresAt = new Date(tokenData.expiresAt);
      
      // Check if token needs refresh (refresh if less than 5 minutes remaining)
      const now = new Date();
      const fiveMinutes = 5 * 60 * 1000;
      if (tokenData.expiresAt.getTime() - now.getTime() < fiveMinutes) {
        // Refresh the token
        return await this.refreshToken(clientId, clientSecret, tokenData.refreshToken);
      }
      
      // Cache and return
      this.cache.set(clientIdHash, { data: tokenData, cachedAt: new Date() });
      return tokenData;
    }

    // No tokens found - this client needs initial authorization
    throw new SDPAuthError(
      'No OAuth tokens found for this client. Initial authorization required. ' +
      'Please contact your administrator to complete the OAuth setup.'
    );
  }

  /**
   * Store OAuth tokens for a client
   */
  async storeTokens(
    clientId: string, 
    clientSecret: string, 
    tokens: TokenResponse
  ): Promise<OAuthTokenData> {
    const clientIdHash = hashApiKey(clientId);
    
    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);
    
    const tokenData: OAuthTokenData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt
    };
    
    // Encrypt token data
    const encryptedTokens = encryptData(JSON.stringify(tokenData));
    
    // Upsert into database
    await this.pool.query(`
      INSERT INTO oauth_tokens (client_id, client_id_hash, encrypted_tokens)
      VALUES ($1, $2, $3)
      ON CONFLICT (client_id_hash) 
      DO UPDATE SET 
        encrypted_tokens = $3,
        updated_at = CURRENT_TIMESTAMP
    `, [clientId, clientIdHash, encryptedTokens]);
    
    // Clear cache
    this.cache.delete(clientIdHash);
    
    // Track usage
    await this.trackUsage(clientId, 'auth_code', true);
    
    return tokenData;
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(
    clientId: string, 
    clientSecret: string, 
    refreshToken: string
  ): Promise<OAuthTokenData> {
    try {
      const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // Store updated tokens
      const tokenData = await this.storeTokens(clientId, clientSecret, {
        ...response.data,
        refresh_token: response.data.refresh_token || refreshToken
      });
      
      // Update refresh metadata
      const clientIdHash = hashApiKey(clientId);
      await this.pool.query(`
        UPDATE oauth_tokens 
        SET last_refreshed_at = CURRENT_TIMESTAMP,
            refresh_count = refresh_count + 1
        WHERE client_id_hash = $1
      `, [clientIdHash]);
      
      // Track successful refresh
      await this.trackUsage(clientId, 'refresh', true);
      
      return tokenData;
    } catch (error) {
      // Track failed refresh
      await this.trackUsage(clientId, 'refresh', false, error instanceof Error ? error.message : 'Unknown error');
      
      if (axios.isAxiosError(error)) {
        throw new SDPAuthError(
          `Token refresh failed: ${error.response?.data?.error_description || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens (for initial setup)
   */
  async exchangeAuthCode(
    clientId: string, 
    clientSecret: string, 
    authCode: string
  ): Promise<OAuthTokenData> {
    try {
      const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.data.refresh_token) {
        throw new SDPAuthError('No refresh token received. Make sure to use offline access type.');
      }

      // Store tokens
      return await this.storeTokens(clientId, clientSecret, response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SDPAuthError(
          `Authorization code exchange failed: ${error.response?.data?.error_description || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Track token usage
   */
  private async trackUsage(
    clientId: string, 
    action: string, 
    success: boolean, 
    errorMessage?: string
  ): Promise<void> {
    const clientIdHash = hashApiKey(clientId);
    
    // Get token ID
    const result = await this.pool.query(
      'SELECT id FROM oauth_tokens WHERE client_id_hash = $1',
      [clientIdHash]
    );
    
    if (result.rows.length > 0) {
      await this.pool.query(`
        INSERT INTO oauth_token_usage (oauth_token_id, action, success, error_message)
        VALUES ($1, $2, $3, $4)
      `, [result.rows[0].id, action, success, errorMessage]);
    }
  }

  /**
   * List all stored clients (for admin purposes)
   */
  async listClients(): Promise<Array<{
    clientId: string;
    lastRefreshed: Date | null;
    refreshCount: number;
    createdAt: Date;
  }>> {
    const result = await this.pool.query(`
      SELECT client_id, last_refreshed_at, refresh_count, created_at
      FROM oauth_tokens
      ORDER BY created_at DESC
    `);
    
    return result.rows.map(row => ({
      clientId: row.client_id.substring(0, 20) + '...',
      lastRefreshed: row.last_refreshed_at,
      refreshCount: row.refresh_count,
      createdAt: row.created_at
    }));
  }
}