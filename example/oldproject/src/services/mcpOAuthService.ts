/**
 * MCP OAuth Service
 * 
 * Handles OAuth authentication for MCP clients connecting to this server.
 * This is SEPARATE from the SDP API OAuth tokens.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { z } from 'zod';

// Dynamic Client Registration Request (RFC 7591)
export const ClientRegistrationSchema = z.object({
  redirect_uris: z.array(z.string().url()).min(1),
  client_name: z.string(),
  grant_types: z.array(z.string()).default(['authorization_code']),
  response_types: z.array(z.string()).default(['code']),
  scope: z.string().optional().default('mcp:tools'),
  contacts: z.array(z.string().email()).optional(),
  logo_uri: z.string().url().optional(),
  client_uri: z.string().url().optional(),
  policy_uri: z.string().url().optional(),
  tos_uri: z.string().url().optional(),
});

export type ClientRegistration = z.infer<typeof ClientRegistrationSchema>;

// OAuth Authorization Request
export const AuthorizationRequestSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string().optional(),
  scope: z.string().optional().default('mcp:tools'),
  code_challenge: z.string(), // Required for PKCE
  code_challenge_method: z.enum(['S256', 'plain']).default('S256'),
});

export type AuthorizationRequest = z.infer<typeof AuthorizationRequestSchema>;

// OAuth Token Request
export const TokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string(),
  client_secret: z.string().optional(),
  code_verifier: z.string().optional(), // For PKCE
  refresh_token: z.string().optional(),
});

export type TokenRequest = z.infer<typeof TokenRequestSchema>;

export class MCPOAuthService {
  constructor(private pool: Pool) {}

  /**
   * Initialize the MCP OAuth schema
   */
  static async initializeSchema(pool: Pool): Promise<void> {
    const client = await pool.connect();
    try {
      // Read and execute the migration
      const fs = await import('fs/promises');
      const path = await import('path');
      const migrationPath = path.join(process.cwd(), 'src/db/migrations/004_mcp_oauth_clients.sql');
      const migration = await fs.readFile(migrationPath, 'utf-8');
      
      await client.query(migration);
      console.log('✅ MCP OAuth schema initialized');
    } catch (error) {
      console.error('Failed to initialize MCP OAuth schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Register a new OAuth client (Dynamic Client Registration)
   */
  async registerClient(registration: ClientRegistration): Promise<{
    client_id: string;
    client_secret?: string;
    client_name: string;
    redirect_uris: string[];
    grant_types: string[];
    response_types: string[];
    scope: string;
  }> {
    const client = await this.pool.connect();
    try {
      // Generate client credentials
      const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
      const clientSecret = crypto.randomBytes(32).toString('hex');
      
      // Store client registration
      const result = await client.query(
        `INSERT INTO mcp_oauth_clients 
         (client_id, client_secret, client_name, redirect_uris, grant_types, 
          response_types, scope, contacts, logo_uri, client_uri, policy_uri, tos_uri)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          clientId,
          clientSecret,
          registration.client_name,
          registration.redirect_uris,
          registration.grant_types,
          registration.response_types,
          registration.scope,
          registration.contacts || null,
          registration.logo_uri || null,
          registration.client_uri || null,
          registration.policy_uri || null,
          registration.tos_uri || null,
        ]
      );
      
      const newClient = result.rows[0];
      
      return {
        client_id: newClient.client_id,
        client_secret: newClient.client_secret,
        client_name: newClient.client_name,
        redirect_uris: newClient.redirect_uris,
        grant_types: newClient.grant_types,
        response_types: newClient.response_types,
        scope: newClient.scope,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate client credentials
   */
  async validateClient(clientId: string, clientSecret?: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT client_secret FROM mcp_oauth_clients WHERE client_id = $1',
        [clientId]
      );
      
      if (result.rows.length === 0) {
        return false;
      }
      
      const storedSecret = result.rows[0].client_secret;
      
      // Public clients don't have a secret
      if (!storedSecret) {
        return !clientSecret;
      }
      
      return storedSecret === clientSecret;
    } finally {
      client.release();
    }
  }

  /**
   * Generate authorization code
   */
  async generateAuthorizationCode(
    clientId: string,
    redirectUri: string,
    scope: string,
    codeChallenge?: string,
    codeChallengeMethod?: string
  ): Promise<string> {
    const client = await this.pool.connect();
    try {
      const code = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await client.query(
        `INSERT INTO mcp_authorization_codes 
         (code, client_id, redirect_uri, scope, code_challenge, 
          code_challenge_method, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          code,
          clientId,
          redirectUri,
          scope,
          codeChallenge || null,
          codeChallengeMethod || null,
          expiresAt,
        ]
      );
      
      return code;
    } finally {
      client.release();
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
  }> {
    const client = await this.pool.connect();
    try {
      // Validate authorization code
      const codeResult = await client.query(
        `SELECT * FROM mcp_authorization_codes 
         WHERE code = $1 AND client_id = $2 AND redirect_uri = $3 
         AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL`,
        [code, clientId, redirectUri]
      );
      
      if (codeResult.rows.length === 0) {
        throw new Error('Invalid or expired authorization code');
      }
      
      const authCode = codeResult.rows[0];
      
      // Validate PKCE if present
      if (authCode.code_challenge) {
        if (!codeVerifier) {
          throw new Error('Code verifier required');
        }
        
        let challenge: string;
        if (authCode.code_challenge_method === 'S256') {
          challenge = crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');
        } else {
          challenge = codeVerifier;
        }
        
        if (challenge !== authCode.code_challenge) {
          throw new Error('Invalid code verifier');
        }
      }
      
      // Mark code as used
      await client.query(
        'UPDATE mcp_authorization_codes SET used_at = CURRENT_TIMESTAMP WHERE code = $1',
        [code]
      );
      
      // Generate tokens
      const accessToken = crypto.randomBytes(32).toString('hex');
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const expiresIn = 3600; // 1 hour
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      
      // Store tokens
      await client.query(
        `INSERT INTO mcp_access_tokens (token, client_id, scope, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [accessToken, clientId, authCode.scope, expiresAt]
      );
      
      await client.query(
        `INSERT INTO mcp_refresh_tokens (token, client_id, scope) 
         VALUES ($1, $2, $3)`,
        [refreshToken, clientId, authCode.scope]
      );
      
      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        refresh_token: refreshToken,
        scope: authCode.scope,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<{
    valid: boolean;
    client_id?: string;
    scope?: string;
  }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT client_id, scope FROM mcp_access_tokens 
         WHERE token = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [token]
      );
      
      if (result.rows.length === 0) {
        return { valid: false };
      }
      
      return {
        valid: true,
        client_id: result.rows[0].client_id,
        scope: result.rows[0].scope,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string
  ): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
  }> {
    const client = await this.pool.connect();
    try {
      // Validate refresh token
      const tokenResult = await client.query(
        `SELECT * FROM mcp_refresh_tokens 
         WHERE token = $1 AND client_id = $2`,
        [refreshToken, clientId]
      );
      
      if (tokenResult.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }
      
      const oldToken = tokenResult.rows[0];
      
      // Generate new tokens
      const accessToken = crypto.randomBytes(32).toString('hex');
      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      const expiresIn = 3600; // 1 hour
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      
      // Store new tokens
      await client.query(
        `INSERT INTO mcp_access_tokens (token, client_id, scope, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [accessToken, clientId, oldToken.scope, expiresAt]
      );
      
      await client.query(
        `INSERT INTO mcp_refresh_tokens (token, client_id, scope) 
         VALUES ($1, $2, $3)`,
        [newRefreshToken, clientId, oldToken.scope]
      );
      
      // Optionally invalidate old refresh token
      await client.query(
        'DELETE FROM mcp_refresh_tokens WHERE token = $1',
        [refreshToken]
      );
      
      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        refresh_token: newRefreshToken,
        scope: oldToken.scope,
      };
    } finally {
      client.release();
    }
  }
}