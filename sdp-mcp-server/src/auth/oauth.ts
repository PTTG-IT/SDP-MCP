import axios, { AxiosError } from 'axios';
import { logger } from '../monitoring/logging.js';
import { auditLogger, AuditEventTypes } from '../monitoring/auditLogger.js';
import { getSDPBaseUrl } from '../tenants/models/tenant.js';
import type { DataCenter } from '../database/models/types.js';

/**
 * OAuth token response from SDP
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * OAuth error response
 */
export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * OAuth client for Service Desk Plus
 */
export class OAuthClient {
  private readonly tokenEndpoint: string;
  
  constructor(dataCenter: DataCenter) {
    const baseUrl = getSDPBaseUrl(dataCenter);
    this.tokenEndpoint = `${baseUrl}/oauth/v2/token`;
  }
  
  /**
   * Exchange refresh token for access token
   */
  async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    tenantId: string
  ): Promise<OAuthTokenResponse> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });
      
      logger.debug('Refreshing OAuth token', { tenantId, clientId });
      
      const response = await axios.post<OAuthTokenResponse>(
        this.tokenEndpoint,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          timeout: 30000,
          validateStatus: () => true, // Handle all status codes
        }
      );
      
      if (response.status !== 200) {
        const error = response.data as OAuthErrorResponse;
        throw new OAuthError(
          error.error_description || `OAuth error: ${error.error}`,
          error.error,
          response.status
        );
      }
      
      // Validate response
      const tokenData = response.data;
      if (!tokenData.access_token || !tokenData.refresh_token) {
        throw new OAuthError('Invalid token response', 'invalid_response', 500);
      }
      
      // Log successful refresh
      await auditLogger.logAuth(tenantId, clientId, {
        action: 'token_refresh',
        expiresIn: tokenData.expires_in,
      });
      
      logger.info('OAuth token refreshed successfully', {
        tenantId,
        expiresIn: tokenData.expires_in,
        scopes: tokenData.scope,
      });
      
      return tokenData;
      
    } catch (error) {
      logger.error('OAuth token refresh failed', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Log failed refresh
      await auditLogger.log({
        tenantId,
        eventType: AuditEventTypes.AUTH_FAILED,
        eventCategory: 'auth',
        actorType: 'tenant',
        actorId: clientId,
        action: 'token_refresh',
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (error instanceof OAuthError) {
        throw error;
      }
      
      if (axios.isAxiosError(error)) {
        throw new OAuthError(
          'Network error during token refresh',
          'network_error',
          error.response?.status || 0
        );
      }
      
      throw new OAuthError(
        'Unexpected error during token refresh',
        'unknown_error',
        500
      );
    }
  }
  
  /**
   * Validate access token (introspection)
   */
  async validateToken(
    accessToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<{
    active: boolean;
    scope?: string;
    exp?: number;
  }> {
    try {
      // SDP doesn't have a standard introspection endpoint
      // We'll make a simple API call to validate the token
      const baseUrl = this.tokenEndpoint.replace('/oauth/v2/token', '');
      const testUrl = `${baseUrl}/api/v3/requests?limit=1`;
      
      const response = await axios.get(testUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.manageengine.sdp.v3+json',
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      
      if (response.status === 401) {
        return { active: false };
      }
      
      if (response.status === 200) {
        // Token is valid
        // Try to extract expiry from token (if JWT)
        const exp = this.extractTokenExpiry(accessToken);
        return {
          active: true,
          exp,
        };
      }
      
      // Other status codes indicate potential issues
      logger.warn('Unexpected status during token validation', {
        status: response.status,
      });
      
      return { active: false };
      
    } catch (error) {
      logger.error('Token validation error', { error });
      return { active: false };
    }
  }
  
  /**
   * Extract expiry from JWT token (if applicable)
   */
  private extractTokenExpiry(token: string): number | undefined {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return undefined;
      }
      
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64').toString());
      return payload.exp;
    } catch {
      return undefined;
    }
  }
}

/**
 * OAuth-specific error class
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'OAuthError';
  }
  
  /**
   * Check if error is due to invalid refresh token
   */
  isInvalidRefreshToken(): boolean {
    return this.code === 'invalid_grant' || 
           this.code === 'invalid_token' ||
           this.statusCode === 401;
  }
  
  /**
   * Check if error is temporary (can be retried)
   */
  isTemporary(): boolean {
    return this.statusCode >= 500 || 
           this.code === 'temporarily_unavailable' ||
           this.code === 'network_error';
  }
}