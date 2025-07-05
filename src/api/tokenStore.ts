import { TokenResponse } from './auth.js';
import { Mutex } from '../utils/mutex.js';

/**
 * Singleton token store to share tokens across all client instances
 * This prevents requesting new tokens for each operation
 * 
 * OAuth Limits:
 * - Access tokens expire after 1 hour (3600 seconds)
 * - Maximum 5 refresh token requests per minute
 * - Maximum 10 access tokens per 10 minutes per refresh token
 */
export class TokenStore {
  private static instance: TokenStore;
  
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private tokenRequestCount = 0;
  private tokenRequestResetTime: Date = new Date();
  private refreshMutex = new Mutex();
  private lastRefreshTime: Date | null = null;

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
    
    // Calculate token expiry (subtract 5 minutes for safety margin)
    // Tokens expire after 1 hour (3600 seconds)
    const safetyMarginSeconds = 300; // 5 minutes
    const expiresIn = response.expires_in - safetyMarginSeconds;
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
    
    console.log(`Token stored. Expires at: ${this.tokenExpiry.toISOString()} (${expiresIn} seconds from now)`);
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

  /**
   * Get the refresh mutex for preventing concurrent refresh attempts
   */
  getRefreshMutex(): Mutex {
    return this.refreshMutex;
  }

  /**
   * Check if enough time has passed since last refresh (prevent rapid refreshes)
   */
  canRefreshNow(): boolean {
    if (!this.lastRefreshTime) return true;
    
    const now = new Date();
    const timeSinceLastRefresh = now.getTime() - this.lastRefreshTime.getTime();
    const minimumRefreshInterval = 5000; // 5 seconds minimum between refreshes
    
    return timeSinceLastRefresh >= minimumRefreshInterval;
  }

  /**
   * Record that a refresh was attempted
   */
  recordRefreshAttempt(): void {
    this.lastRefreshTime = new Date();
  }

  /**
   * Get debug information about token state
   */
  getDebugInfo(): object {
    return {
      hasAccessToken: !!this.accessToken,
      hasRefreshToken: !!this.refreshToken,
      tokenExpiry: this.tokenExpiry?.toISOString() || null,
      isTokenValid: this.isTokenValid(),
      tokenRequestCount: this.tokenRequestCount,
      tokenRequestResetTime: this.tokenRequestResetTime.toISOString(),
      lastRefreshTime: this.lastRefreshTime?.toISOString() || null,
      canRequestToken: this.canRequestToken(),
      canRefreshNow: this.canRefreshNow(),
      refreshMutexLocked: this.refreshMutex.isLocked()
    };
  }
}