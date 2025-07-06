import { AuthManager } from './auth.js';
import { AuthManagerV2 } from './authV2.js';
import { TokenStore } from './tokenStore.js';
import { RateLimitCoordinator } from './rateLimitCoordinator.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { TokenValidator } from './tokenValidator.js';
import { SDPAuthError } from '../utils/errors.js';
// import { getTokenStoreIntegration } from '../db/integration.js';
import { SDPConfig } from './types.js';

export interface TokenManagerOptions {
  checkInterval?: number; // How often to check token expiry (ms)
  refreshMargin?: number; // How long before expiry to refresh (ms)
  maxRetries?: number; // Maximum retry attempts
  retryDelay?: number; // Initial retry delay (ms)
}

/**
 * Background token manager that handles token refresh independently of API requests
 * Ensures no more than 1 token refresh every 3 minutes
 */
export class TokenManager {
  private static instance: TokenManager | null = null;
  private authManager: AuthManager | AuthManagerV2;
  private tokenStore: TokenStore;
  private rateLimitCoordinator: RateLimitCoordinator;
  private tokenValidator: TokenValidator;
  private circuitBreaker: CircuitBreaker;
  private intervalId: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private options: Required<TokenManagerOptions>;
  // private config: SDPConfig;
  
  private constructor(authManager: AuthManager | AuthManagerV2, config: SDPConfig, options?: TokenManagerOptions) {
    this.authManager = authManager;
    // this.config = config;
    this.tokenStore = TokenStore.getInstance();
    this.rateLimitCoordinator = RateLimitCoordinator.getInstance();
    this.tokenValidator = new TokenValidator(config);
    
    this.options = {
      checkInterval: options?.checkInterval ?? 60000, // Check every minute
      refreshMargin: options?.refreshMargin ?? 5 * 60 * 1000, // 5 minutes before expiry
      maxRetries: options?.maxRetries ?? 3,
      retryDelay: options?.retryDelay ?? 5000 // 5 seconds
    };
    
    // Circuit breaker for token refresh operations
    this.circuitBreaker = new CircuitBreaker('token-refresh', {
      failureThreshold: 3,
      resetTimeout: 5 * 60 * 1000, // 5 minutes
      successThreshold: 1
    });
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(authManager: AuthManager | AuthManagerV2, config: SDPConfig, options?: TokenManagerOptions): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager(authManager, config, options);
    }
    return TokenManager.instance;
  }
  
  /**
   * Start the background token management process
   */
  async start(): Promise<void> {
    console.log('Starting background token manager');
    
    // Initialize rate limit coordinator from database
    await this.rateLimitCoordinator.initializeFromDatabase();
    
    // Perform initial token check
    await this.checkAndRefreshToken();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkAndRefreshToken().catch(error => {
        console.error('Token check failed:', error);
      });
    }, this.options.checkInterval);
  }
  
  /**
   * Stop the background token management process
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Stopped background token manager');
  }
  
  /**
   * Check token expiry and refresh if needed
   */
  private async checkAndRefreshToken(): Promise<void> {
    // Skip if already refreshing
    if (this.isRefreshing) {
      console.log('Token refresh already in progress, skipping');
      return;
    }
    
    try {
      // Use token validator to check token status
      const validation = await this.tokenValidator.validateToken(true); // Skip API check for performance
      
      if (!validation.isValid) {
        console.log(`Token invalid: ${validation.reason}`);
        if (validation.canRefreshNow) {
          await this.refreshToken();
        } else {
          console.log('Cannot refresh now due to rate limits');
        }
        return;
      }
      
      // Get refresh recommendation
      const recommendation = await this.tokenValidator.getRefreshRecommendation();
      
      if (recommendation.shouldRefresh) {
        console.log(`Token refresh recommended: ${recommendation.reason}`);
        if (recommendation.canRefreshNow) {
          await this.refreshToken();
        } else {
          const minutes = Math.ceil((recommendation.timeUntilRefresh || 0) / 60000);
          console.log(`Cannot refresh now, must wait ${minutes} minutes`);
        }
      } else {
        console.log(`Token status: ${recommendation.reason}`);
      }
    } catch (error) {
      console.error('Error checking token:', error);
    }
  }
  
  /**
   * Refresh token with rate limiting and circuit breaker protection
   */
  private async refreshToken(): Promise<void> {
    this.isRefreshing = true;
    
    try {
      // Check if refresh is allowed by rate limiter
      const canRefresh = await this.rateLimitCoordinator.canRefreshToken();
      if (!canRefresh) {
        const timeUntilNext = this.rateLimitCoordinator.getTimeUntilNextRefresh();
        console.log(`Rate limit prevents token refresh. Next allowed in ${Math.round(timeUntilNext / 1000)}s`);
        return;
      }
      
      // Use circuit breaker to protect against repeated failures
      await this.circuitBreaker.execute(
        async () => {
          await this.performTokenRefresh();
        },
        () => {
          console.log('Circuit breaker is open, skipping token refresh');
        }
      );
      
    } finally {
      this.isRefreshing = false;
    }
  }
  
  /**
   * Perform the actual token refresh
   */
  private async performTokenRefresh(): Promise<void> {
    const { refreshToken } = this.tokenStore.getTokens();
    
    if (!refreshToken) {
      throw new SDPAuthError('No refresh token available');
    }
    
    let lastError: Error | null = null;
    
    // Retry with exponential backoff
    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        // Attempt refresh
        await this.authManager.refreshAccessToken();
        
        // Record success
        await this.rateLimitCoordinator.recordTokenRefresh(true);
        
        console.log('Token refreshed successfully');
        return;
        
      } catch (error) {
        lastError = error as Error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        console.error(`Token refresh attempt ${attempt + 1} failed:`, errorMessage);
        
        // Record failure
        await this.rateLimitCoordinator.recordTokenRefresh(false, errorMessage);
        
        // Check if this is a permanent error (e.g., invalid refresh token)
        if (this.isPermanentError(error)) {
          console.error('Permanent error detected, stopping retries');
          throw error;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < this.options.maxRetries - 1) {
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          console.log(`Waiting ${delay}ms before retry`);
          await this.sleep(delay);
        }
      }
    }
    
    // All retries failed
    throw lastError || new SDPAuthError('Token refresh failed after all retries');
  }
  
  /**
   * Check if error is permanent and should not be retried
   */
  private isPermanentError(error: unknown): boolean {
    if (error instanceof SDPAuthError) {
      const message = error.message.toLowerCase();
      return message.includes('invalid_grant') ||
             message.includes('invalid_refresh_token') ||
             message.includes('token_revoked');
    }
    return false;
  }
  
  /**
   * Force a token refresh (for manual intervention)
   */
  async forceRefresh(): Promise<void> {
    console.log('Force refresh requested');
    
    // Reset circuit breaker for manual refresh
    this.circuitBreaker.reset();
    
    // Clear rate limit tracking for emergency refresh
    // This should be used sparingly
    await this.refreshToken();
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    isRefreshing: boolean;
    nextCheckTime: Date | null;
    circuitBreakerState: any;
    rateLimitStatus: any;
  } {
    const rateLimitStatus = this.rateLimitCoordinator.getStatus();
    const circuitBreakerState = this.circuitBreaker.getState();
    
    let nextCheckTime: Date | null = null;
    if (this.intervalId) {
      nextCheckTime = new Date(Date.now() + this.options.checkInterval);
    }
    
    return {
      isRunning: this.intervalId !== null,
      isRefreshing: this.isRefreshing,
      nextCheckTime,
      circuitBreakerState,
      rateLimitStatus
    };
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}