import axios from 'axios';
import { SDPAuthError } from '../utils/errors.js';
import { TokenStore } from './tokenStore.js';

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  instanceName: string;
  refreshToken?: string; // Optional: for Self Client auth
  authBaseUrl?: string;  // Optional: data center specific auth URL
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class AuthManagerV2 {
  private config: AuthConfig;
  private tokenStore: TokenStore;
  private authMode: 'self-client' | 'client-credentials';

  constructor(config: AuthConfig) {
    this.config = config;
    this.tokenStore = TokenStore.getInstance();
    
    // Determine auth mode based on presence of refresh token
    this.authMode = config.refreshToken ? 'self-client' : 'client-credentials';
    
    if (this.authMode === 'self-client') {
      console.log('Using Self Client authentication (full API access)');
      // Store the refresh token for use
      const tokenData: TokenResponse = {
        access_token: '',
        refresh_token: config.refreshToken,
        token_type: 'Bearer',
        expires_in: 0
      };
      this.tokenStore.storeTokens(tokenData);
    } else {
      console.log('Using Client Credentials authentication (limited to requests API)');
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

    // Check if we can request a new token (rate limit)
    if (!this.tokenStore.canRequestToken()) {
      const waitTime = this.tokenStore.getTimeUntilTokenRequestAllowed();
      const minutes = Math.ceil(waitTime / 60000);
      throw new SDPAuthError(
        `OAuth token request limit reached. Please wait ${minutes} minutes before trying again.`
      );
    }

    // Try to refresh or authenticate based on mode
    if (this.authMode === 'self-client') {
      const { refreshToken } = this.tokenStore.getTokens();
      if (refreshToken) {
        await this.refreshAccessToken();
        return this.tokenStore.getTokens().accessToken!;
      } else {
        throw new SDPAuthError('No refresh token available for Self Client mode');
      }
    } else {
      // Client credentials mode
      await this.authenticate();
      return this.tokenStore.getTokens().accessToken!;
    }
  }

  /**
   * Perform client credentials authentication (limited scope)
   */
  private async authenticate(): Promise<void> {
    try {
      const tokenUrl = this.getTokenUrl();
      
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        // Limited scope for client_credentials
        scope: 'SDPOnDemand.requests.ALL',
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.data.access_token) {
        throw new SDPAuthError('No access token in response. Check if client_credentials is supported.');
      }

      this.tokenStore.recordTokenRequest();
      this.tokenStore.storeTokens(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        if (errorData?.error === 'invalid_scope') {
          throw new SDPAuthError(
            'Invalid scope for client_credentials. This grant type only supports limited scopes like SDPOnDemand.requests.ALL'
          );
        }
        throw new SDPAuthError(
          `Authentication failed: ${errorData?.error_description || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Refresh the access token using the refresh token (Self Client mode)
   */
  async refreshAccessToken(): Promise<void> {
    const { refreshToken } = this.tokenStore.getTokens();
    
    if (!refreshToken) {
      throw new SDPAuthError('No refresh token available');
    }

    try {
      const tokenUrl = this.getTokenUrl();
      
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

      if (!response.data.access_token) {
        throw new SDPAuthError('No access token in refresh response');
      }

      this.tokenStore.recordTokenRequest();
      this.tokenStore.storeTokens(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        
        // Don't clear tokens on failure - we might still be able to use them
        if (errorData?.error === 'invalid_refresh_token') {
          throw new SDPAuthError(
            'Refresh token is invalid or expired. Please run setup-self-client.js to generate a new one.'
          );
        }
        
        throw new SDPAuthError(
          `Token refresh failed: ${errorData?.error_description || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Force refresh the token
   */
  async forceRefresh(): Promise<void> {
    if (this.authMode === 'self-client') {
      await this.refreshAccessToken();
    } else {
      await this.authenticate();
    }
  }

  /**
   * Get the appropriate token URL based on configuration
   */
  private getTokenUrl(): string {
    if (this.config.authBaseUrl) {
      return `${this.config.authBaseUrl}/oauth/v2/token`;
    }
    
    // Default to US data center
    return 'https://accounts.zoho.com/oauth/v2/token';
  }

  /**
   * Get current auth mode
   */
  getAuthMode(): string {
    return this.authMode;
  }

  /**
   * Check if using limited scope mode
   */
  isLimitedScope(): boolean {
    return this.authMode === 'client-credentials';
  }
}