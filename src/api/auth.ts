import axios from 'axios';
import { SDPAuthError } from '../utils/errors.js';
import { TokenStore } from './tokenStore.js';

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
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token in the store
    if (this.tokenStore.isTokenValid()) {
      return this.tokenStore.getTokens().accessToken!;
    }

    const { refreshToken } = this.tokenStore.getTokens();
    
    if (refreshToken) {
      try {
        await this.refreshAccessToken();
        return this.tokenStore.getTokens().accessToken!;
      } catch (error) {
        // If refresh fails, try to get a new token
        console.error('Token refresh failed:', error);
      }
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
        // For full access, implement authorization_code flow
        scope: 'SDPOnDemand.requests.ALL',
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.tokenStore.recordTokenRequest();
      this.tokenStore.storeTokens(response.data);
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
      this.tokenStore.storeTokens(response.data);
    } catch (error) {
      // Don't clear tokens on failure - we might still be able to use them
      if (axios.isAxiosError(error)) {
        throw new SDPAuthError(
          `Token refresh failed: ${error.response?.data?.error_description || error.message}`
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