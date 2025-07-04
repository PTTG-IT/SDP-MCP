import axios from 'axios';
import { SDPAuthError } from '../utils/errors.js';

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
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    if (this.isTokenValid()) {
      return this.accessToken!;
    }

    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return this.accessToken!;
      } catch (error) {
        // If refresh fails, try to get a new token
      }
    }

    await this.authenticate();
    return this.accessToken!;
  }

  /**
   * Perform initial authentication
   */
  private async authenticate(): Promise<void> {
    try {
      const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'SDPOnDemand.requests.ALL SDPOnDemand.assets.ALL SDPOnDemand.problems.ALL SDPOnDemand.changes.ALL SDPOnDemand.users.READ SDPOnDemand.projects.ALL',
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.handleTokenResponse(response.data);
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
    if (!this.refreshToken) {
      throw new SDPAuthError('No refresh token available');
    }

    try {
      const tokenUrl = `https://accounts.zoho.com/oauth/v2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await axios.post<TokenResponse>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.handleTokenResponse(response.data);
    } catch (error) {
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      
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
    if (this.refreshToken) {
      await this.refreshAccessToken();
    } else {
      await this.authenticate();
    }
  }

  /**
   * Handle token response and store tokens
   */
  private handleTokenResponse(response: TokenResponse): void {
    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token || this.refreshToken;
    
    // Calculate token expiry (subtract 60 seconds for safety margin)
    const expiresIn = response.expires_in - 60;
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Check if the current token is still valid
   */
  private isTokenValid(): boolean {
    return !!(
      this.accessToken &&
      this.tokenExpiry &&
      this.tokenExpiry > new Date()
    );
  }
}