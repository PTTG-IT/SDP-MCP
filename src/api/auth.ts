import axios from 'axios';
import { SDPAuthError } from '../utils/errors.js';
import { TokenStore } from './tokenStore.js';
import { initializeTokenStoreIntegration, getTokenStoreIntegration } from '../db/integration.js';

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  instanceName: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class AuthManager {
  private config: AuthConfig;
  private tokenStore: TokenStore;

  constructor(config: AuthConfig) {
    this.config = config;
    this.tokenStore = TokenStore.getInstance();
    
    // Initialize database integration asynchronously
    this.initializeDb();
    
    // Check if we have a refresh token from environment
    const refreshToken = process.env.SDP_REFRESH_TOKEN;
    if (refreshToken) {
      console.log('Using refresh token authentication (full API access)');
      // Pre-populate the token store with the refresh token
      this.tokenStore.storeTokens({
        access_token: '',
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 0
      });
    }
  }
  
  /**
   * Initialize database integration
   */
  private async initializeDb(): Promise<void> {
    try {
      await initializeTokenStoreIntegration(this.tokenStore);
      console.log('Database token integration initialized');
    } catch (error) {
      console.error('Failed to initialize database integration:', error);
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token in the store
    if (this.tokenStore.isTokenValid()) {
      return this.tokenStore.getTokens().accessToken!;
    }

    console.log('Token expired or missing, need to refresh. Debug info:', this.tokenStore.getDebugInfo());

    const { refreshToken } = this.tokenStore.getTokens();
    
    if (refreshToken) {
      // Use mutex to prevent concurrent refresh attempts
      const mutex = this.tokenStore.getRefreshMutex();
      
      return await mutex.runExclusive(async () => {
        // Double-check token validity inside mutex (another request might have refreshed it)
        if (this.tokenStore.isTokenValid()) {
          console.log('Token was refreshed by another request');
          return this.tokenStore.getTokens().accessToken!;
        }

        // Check if we're refreshing too rapidly
        if (!this.tokenStore.canRefreshNow()) {
          throw new SDPAuthError(
            'Token refresh attempted too rapidly. Please wait a few seconds.'
          );
        }

        try {
          await this.refreshAccessToken();
          return this.tokenStore.getTokens().accessToken!;
        } catch (error) {
          // Don't fall back to client credentials if we have a refresh token
          console.error('Token refresh failed:', error);
          throw error;
        }
      });
    }

    // Check if we can request a new token (rate limit)
    if (!this.tokenStore.canRequestToken()) {
      const waitTime = this.tokenStore.getTimeUntilTokenRequestAllowed();
      const minutes = Math.ceil(waitTime / 60000);
      throw new SDPAuthError(
        `OAuth token request limit reached. Please wait ${minutes} minutes before trying again.`
      );
    }

    await this.authenticate();
    return this.tokenStore.getTokens().accessToken!;
  }

  /**
   * Perform initial authentication
   * 
   * Note: SDP Cloud primarily uses authorization_code grant type.
   * The client_credentials grant type may have limited support.
   * For production use, consider implementing the full OAuth 2.0 
   * authorization code flow with user consent.
   */
  private async authenticate(): Promise<void> {
    try {
      const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        // Note: client_credentials grant type has limited scope support
        // For full access, use refresh token from Self Client
        scope: 'SDPOnDemand.requests.ALL',
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.tokenStore.recordTokenRequest();
      this.tokenStore.storeTokens(response.data);
      
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
   */
  async refreshAccessToken(): Promise<void> {
    const { refreshToken } = this.tokenStore.getTokens();
    
    if (!refreshToken) {
      throw new SDPAuthError('No refresh token available');
    }

    // Check rate limit before refreshing
    if (!this.tokenStore.canRequestToken()) {
      const waitTime = this.tokenStore.getTimeUntilTokenRequestAllowed();
      const minutes = Math.ceil(waitTime / 60000);
      throw new SDPAuthError(
        `OAuth token request limit reached. Please wait ${minutes} minutes before trying again.`
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

      this.tokenStore.recordTokenRequest();
      this.tokenStore.recordRefreshAttempt();
      this.tokenStore.storeTokens(response.data);
      
      // Store in database if available
      const integration = getTokenStoreIntegration();
      if (integration) {
        await integration.storeTokens(response.data);
        await integration.recordTokenRequest('refresh', true);
      }
      
      console.log('Token refreshed successfully');
    } catch (error) {
      this.tokenStore.recordRefreshAttempt(); // Record failed attempt too
      
      // Record failed request in database
      const integration = getTokenStoreIntegration();
      if (integration) {
        const errorMessage = axios.isAxiosError(error) 
          ? error.response?.data?.error_description || error.response?.data?.error || error.message
          : error instanceof Error ? error.message : String(error);
        await integration.recordTokenRequest('refresh', false, errorMessage);
      }
      
      // Don't clear tokens on failure - we might still be able to use them
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error_description || error.response?.data?.error || error.message;
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
  }

  /**
   * Force refresh the token
   */
  async forceRefresh(): Promise<void> {
    const { refreshToken } = this.tokenStore.getTokens();
    
    if (refreshToken) {
      await this.refreshAccessToken();
    } else {
      await this.authenticate();
    }
  }

}