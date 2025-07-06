import axios from 'axios';
import { TokenStore } from './tokenStore.js';
import { SDPConfig } from './types.js';
import { SDPAuthError } from '../utils/errors.js';
import { Mutex } from 'async-mutex';
import { getTokenStoreIntegration } from '../db/integration.js';
import { RateLimitCoordinator } from './rateLimitCoordinator.js';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Enhanced Authentication Manager that uses centralized rate limiting
 * This is a new version that integrates with RateLimitCoordinator
 */
export class AuthManagerV2 {
  private tokenStore: TokenStore;
  private refreshMutex: Mutex;
  private rateLimitCoordinator: RateLimitCoordinator;

  constructor(private config: SDPConfig) {
    this.tokenStore = TokenStore.getInstance();
    this.refreshMutex = new Mutex();
    this.rateLimitCoordinator = RateLimitCoordinator.getInstance();
  }

  /**
   * Get current access token, DO NOT refresh if expired
   * Token refresh is now handled by the background TokenManager
   */
  async getAccessToken(): Promise<string> {
    const { accessToken } = this.tokenStore.getTokens();
    
    if (!accessToken) {
      throw new SDPAuthError('No access token available. Please authenticate first.');
    }

    // Return token even if expired - let the TokenManager handle refresh
    return accessToken;
  }

  /**
   * Check if token is valid (not expired)
   */
  isTokenValid(): boolean {
    const { accessToken, tokenExpiry } = this.tokenStore.getTokens();
    
    if (!accessToken || !tokenExpiry) {
      return false;
    }
    
    return tokenExpiry.getTime() > Date.now();
  }

  /**
   * Authenticate using client credentials or refresh token
   * This should only be called during initial setup
   */
  async authenticate(): Promise<void> {
    // Check if we have a valid token already
    if (this.isTokenValid()) {
      console.log('Valid token already exists, skipping authentication');
      return;
    }

    // Try to load from database first
    const integration = getTokenStoreIntegration();
    if (integration) {
      const loaded = await integration.loadTokensFromDatabase();
      if (loaded && this.isTokenValid()) {
        console.log('Loaded valid token from database');
        return;
      }
    }

    // Check if we have a refresh token
    const { refreshToken } = this.tokenStore.getTokens();
    if (refreshToken) {
      console.log('Attempting to use refresh token');
      try {
        await this.refreshAccessToken();
        return;
      } catch (error) {
        console.error('Refresh token failed, falling back to client credentials:', error);
      }
    }

    // Use client credentials as last resort
    await this.authenticateWithClientCredentials();
  }

  /**
   * Authenticate using client credentials
   */
  private async authenticateWithClientCredentials(): Promise<void> {
    try {
      const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: this.config.authCode,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.tokenStore.setTokens(
        response.data.access_token,
        response.data.refresh_token,
        response.data.expires_in
      );
      
      // Store in database if available
      const integration = getTokenStoreIntegration();
      if (integration) {
        await integration.storeTokens(response.data);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SDPAuthError(
          `Authentication failed: ${error.response?.data?.error_description || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token
   * This should ONLY be called by the TokenManager
   */
  async refreshAccessToken(): Promise<void> {
    const { refreshToken } = this.tokenStore.getTokens();
    
    if (!refreshToken) {
      throw new SDPAuthError('No refresh token available');
    }

    // Use mutex to prevent concurrent refresh attempts
    await this.refreshMutex.runExclusive(async () => {
      // Double-check inside mutex
      if (this.isTokenValid()) {
        console.log('Token already refreshed by another process');
        return;
      }

      // Check rate limit using the coordinator
      const canRefresh = await this.rateLimitCoordinator.canRefreshToken();
      if (!canRefresh) {
        const waitTime = this.rateLimitCoordinator.getTimeUntilNextRefresh();
        const minutes = Math.ceil(waitTime / 60000);
        throw new SDPAuthError(
          `OAuth token refresh not allowed. Rate limit enforces no more than 1 refresh every 3 minutes. ` +
          `Next refresh allowed in ${minutes} minutes.`
        );
      }

      try {
        const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
        
        const params = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        });

        const response = await axios.post<TokenResponse>(tokenUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        // Update token store
        this.tokenStore.setTokens(
          response.data.access_token,
          response.data.refresh_token || refreshToken,
          response.data.expires_in
        );
        
        // Store in database if available
        const integration = getTokenStoreIntegration();
        if (integration) {
          await integration.storeTokens(response.data);
        }
        
        // Record successful refresh
        await this.rateLimitCoordinator.recordTokenRefresh(true);
        
        console.log('Token refreshed successfully');
      } catch (error) {
        // Record failed refresh
        const errorMessage = axios.isAxiosError(error) 
          ? error.response?.data?.error_description || error.response?.data?.error || error.message
          : error instanceof Error ? error.message : String(error);
        
        await this.rateLimitCoordinator.recordTokenRefresh(false, errorMessage);
        
        if (axios.isAxiosError(error)) {
          console.error('Token refresh error details:', {
            status: error.response?.status,
            data: error.response?.data
          });
          throw new SDPAuthError(
            `Token refresh failed: ${errorMessage}`
          );
        }
        throw error;
      }
    });
  }

  /**
   * Force refresh the token (should only be used in emergencies)
   */
  async forceRefresh(): Promise<void> {
    console.warn('Force refresh requested - this bypasses normal rate limiting');
    await this.refreshAccessToken();
  }
}