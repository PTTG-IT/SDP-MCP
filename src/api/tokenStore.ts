import { TokenResponse } from './auth.js';

/**
 * Singleton token store to share tokens across all client instances
 * This prevents requesting new tokens for each operation
 */
export class TokenStore {
  private static instance: TokenStore;
  
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private tokenRequestCount = 0;
  private tokenRequestResetTime: Date = new Date();

  private constructor() {}

  static getInstance(): TokenStore {
    if (!TokenStore.instance) {
      TokenStore.instance = new TokenStore();
    }
    return TokenStore.instance;
  }

  /**
   * Check if we can request a new token (max 10 per 10 minutes)
   */
  canRequestToken(): boolean {
    const now = new Date();
    
    // Reset counter if 10 minutes have passed
    if (this.tokenRequestResetTime < now) {
      this.tokenRequestCount = 0;
      this.tokenRequestResetTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now
    }
    
    return this.tokenRequestCount < 10;
  }

  /**
   * Record a token request
   */
  recordTokenRequest(): void {
    this.tokenRequestCount++;
  }

  /**
   * Get stored tokens
   */
  getTokens(): { accessToken: string | null; refreshToken: string | null; tokenExpiry: Date | null } {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenExpiry: this.tokenExpiry,
    };
  }

  /**
   * Store tokens from response
   */
  storeTokens(response: TokenResponse): void {
    this.accessToken = response.access_token;
    if (response.refresh_token) {
      this.refreshToken = response.refresh_token;
    }
    
    // Calculate token expiry (subtract 60 seconds for safety margin)
    const expiresIn = response.expires_in - 60;
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Check if the current token is still valid
   */
  isTokenValid(): boolean {
    return !!(
      this.accessToken &&
      this.tokenExpiry &&
      this.tokenExpiry > new Date()
    );
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get time until we can request tokens again
   */
  getTimeUntilTokenRequestAllowed(): number {
    if (this.canRequestToken()) return 0;
    
    const now = new Date();
    return Math.max(0, this.tokenRequestResetTime.getTime() - now.getTime());
  }
}