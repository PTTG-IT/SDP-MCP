import { DatabaseTokenStore } from '../db/tokenStore.js';
import { TokenStore } from './tokenStore.js';
import { getTokenStoreIntegration } from '../db/integration.js';

/**
 * Rate limit rules for Service Desk Plus API
 */
export interface RateLimitRules {
  // OAuth Token Limits
  tokenRefreshMinInterval: number; // Minimum milliseconds between token refreshes
  maxTokensPerWindow: number; // Maximum tokens per time window
  tokenWindowDuration: number; // Time window in milliseconds
  
  // API Request Limits
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  
  // Circuit Breaker Settings
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeout: number; // Time before attempting to close circuit
  halfOpenRequests: number; // Number of test requests in half-open state
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Rejecting requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

/**
 * Rate limit status for monitoring
 */
export interface RateLimitStatus {
  tokenRefresh: {
    lastRefreshTime: Date | null;
    nextAllowedRefresh: Date | null;
    refreshesInWindow: number;
    canRefreshNow: boolean;
  };
  apiRequests: {
    requestsLastMinute: number;
    requestsLastHour: number;
    remainingMinute: number;
    remainingHour: number;
  };
  circuitBreaker: {
    state: CircuitState;
    failures: number;
    lastFailureTime: Date | null;
    nextRetryTime: Date | null;
  };
}

/**
 * Centralized rate limit coordinator
 * Manages all rate limiting logic for OAuth tokens and API requests
 */
export class RateLimitCoordinator {
  private static instance: RateLimitCoordinator | null = null;
  private rules: RateLimitRules;
  private tokenStore: TokenStore;
  private dbStore: DatabaseTokenStore | null = null;
  
  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures: number = 0;
  private lastFailureTime: Date | null = null;
  private circuitOpenedAt: Date | null = null;
  private halfOpenTestCount: number = 0;
  
  // Token refresh tracking
  private lastTokenRefreshTime: Date | null = null;
  private tokenRefreshHistory: Date[] = [];
  
  // API request tracking
  private apiRequestHistory: Date[] = [];

  private constructor() {
    // Default rules based on discovered limits
    this.rules = {
      // Token refresh: no more than 1 every 3 minutes
      tokenRefreshMinInterval: 3 * 60 * 1000, // 3 minutes in milliseconds
      maxTokensPerWindow: 10,
      tokenWindowDuration: 10 * 60 * 1000, // 10 minutes
      
      // API limits (conservative estimates)
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      
      // Circuit breaker
      failureThreshold: 3,
      resetTimeout: 30 * 1000, // 30 seconds
      halfOpenRequests: 3
    };
    
    this.tokenStore = TokenStore.getInstance();
    
    // Initialize database store if available
    const integration = getTokenStoreIntegration();
    if (integration) {
      this.dbStore = integration.getDbStore();
    }
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): RateLimitCoordinator {
    if (!RateLimitCoordinator.instance) {
      RateLimitCoordinator.instance = new RateLimitCoordinator();
    }
    return RateLimitCoordinator.instance;
  }
  
  /**
   * Update rate limit rules
   */
  updateRules(rules: Partial<RateLimitRules>): void {
    this.rules = { ...this.rules, ...rules };
  }
  
  /**
   * Check if token refresh is allowed
   */
  async canRefreshToken(): Promise<boolean> {
    // Check circuit breaker first
    if (this.circuitState === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.halfOpenTestCount = 0;
      } else {
        return false;
      }
    }
    
    // Check database if available for cross-instance coordination
    if (this.dbStore) {
      const dbCanRefresh = await this.dbStore.canRefreshNow();
      if (!dbCanRefresh) {
        return false;
      }
    }
    
    // Check minimum interval between refreshes (no more than 1 every 3 minutes)
    if (this.lastTokenRefreshTime) {
      const timeSinceLastRefresh = Date.now() - this.lastTokenRefreshTime.getTime();
      if (timeSinceLastRefresh < this.rules.tokenRefreshMinInterval) {
        return false;
      }
    }
    
    // Check sliding window limit (10 tokens per 10 minutes)
    this.cleanupTokenHistory();
    if (this.tokenRefreshHistory.length >= this.rules.maxTokensPerWindow) {
      return false;
    }
    
    // Check in-memory token store limits
    return this.tokenStore.canRequestToken();
  }
  
  /**
   * Record a token refresh attempt
   */
  async recordTokenRefresh(success: boolean, errorMessage?: string): Promise<void> {
    if (success) {
      this.lastTokenRefreshTime = new Date();
      this.tokenRefreshHistory.push(new Date());
      this.consecutiveFailures = 0;
      
      // Reset circuit breaker on success
      if (this.circuitState === CircuitState.HALF_OPEN) {
        this.circuitState = CircuitState.CLOSED;
        this.halfOpenTestCount = 0;
      }
    } else {
      this.consecutiveFailures++;
      this.lastFailureTime = new Date();
      
      // Open circuit breaker if threshold reached
      if (this.consecutiveFailures >= this.rules.failureThreshold) {
        this.circuitState = CircuitState.OPEN;
        this.circuitOpenedAt = new Date();
      }
      
      // If in half-open state, reopen circuit
      if (this.circuitState === CircuitState.HALF_OPEN) {
        this.halfOpenTestCount++;
        if (this.halfOpenTestCount >= this.rules.halfOpenRequests) {
          this.circuitState = CircuitState.OPEN;
          this.circuitOpenedAt = new Date();
        }
      }
    }
    
    // Record in database if available
    if (this.dbStore) {
      await this.dbStore.recordTokenRequest('refresh', success, errorMessage);
    }
    
    // Record in memory store
    this.tokenStore.recordRefreshAttempt();
  }
  
  /**
   * Check if API request is allowed
   */
  canMakeApiRequest(): boolean {
    // Circuit breaker check
    if (this.circuitState === CircuitState.OPEN && !this.shouldAttemptReset()) {
      return false;
    }
    
    this.cleanupApiHistory();
    
    // Check per-minute limit
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const requestsLastMinute = this.apiRequestHistory.filter(
      time => time > oneMinuteAgo
    ).length;
    
    if (requestsLastMinute >= this.rules.maxRequestsPerMinute) {
      return false;
    }
    
    // Check per-hour limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const requestsLastHour = this.apiRequestHistory.filter(
      time => time > oneHourAgo
    ).length;
    
    return requestsLastHour < this.rules.maxRequestsPerHour;
  }
  
  /**
   * Record an API request
   */
  recordApiRequest(): void {
    this.apiRequestHistory.push(new Date());
  }
  
  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.cleanupTokenHistory();
    this.cleanupApiHistory();
    
    const now = Date.now();
    const oneMinuteAgo = new Date(now - 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    
    const requestsLastMinute = this.apiRequestHistory.filter(
      time => time > oneMinuteAgo
    ).length;
    
    const requestsLastHour = this.apiRequestHistory.filter(
      time => time > oneHourAgo
    ).length;
    
    let nextAllowedRefresh: Date | null = null;
    if (this.lastTokenRefreshTime) {
      nextAllowedRefresh = new Date(
        this.lastTokenRefreshTime.getTime() + this.rules.tokenRefreshMinInterval
      );
    }
    
    let nextRetryTime: Date | null = null;
    if (this.circuitOpenedAt) {
      nextRetryTime = new Date(
        this.circuitOpenedAt.getTime() + this.rules.resetTimeout
      );
    }
    
    return {
      tokenRefresh: {
        lastRefreshTime: this.lastTokenRefreshTime,
        nextAllowedRefresh,
        refreshesInWindow: this.tokenRefreshHistory.length,
        canRefreshNow: this.canRefreshToken().then(r => r).catch(() => false) as any
      },
      apiRequests: {
        requestsLastMinute,
        requestsLastHour,
        remainingMinute: Math.max(0, this.rules.maxRequestsPerMinute - requestsLastMinute),
        remainingHour: Math.max(0, this.rules.maxRequestsPerHour - requestsLastHour)
      },
      circuitBreaker: {
        state: this.circuitState,
        failures: this.consecutiveFailures,
        lastFailureTime: this.lastFailureTime,
        nextRetryTime
      }
    };
  }
  
  /**
   * Reset circuit breaker (for testing or manual intervention)
   */
  resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.circuitOpenedAt = null;
    this.halfOpenTestCount = 0;
  }
  
  /**
   * Clean up old token refresh history
   */
  private cleanupTokenHistory(): void {
    const windowStart = new Date(Date.now() - this.rules.tokenWindowDuration);
    this.tokenRefreshHistory = this.tokenRefreshHistory.filter(
      time => time > windowStart
    );
  }
  
  /**
   * Clean up old API request history
   */
  private cleanupApiHistory(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.apiRequestHistory = this.apiRequestHistory.filter(
      time => time > oneHourAgo
    );
  }
  
  /**
   * Check if circuit breaker should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.circuitOpenedAt) return false;
    
    const timeSinceOpen = Date.now() - this.circuitOpenedAt.getTime();
    return timeSinceOpen >= this.rules.resetTimeout;
  }
  
  /**
   * Get time until next allowed token refresh
   */
  getTimeUntilNextRefresh(): number {
    if (!this.lastTokenRefreshTime) return 0;
    
    const nextAllowed = this.lastTokenRefreshTime.getTime() + this.rules.tokenRefreshMinInterval;
    const remaining = nextAllowed - Date.now();
    
    return Math.max(0, remaining);
  }
  
  /**
   * Initialize from database state (if available)
   */
  async initializeFromDatabase(): Promise<void> {
    if (!this.dbStore) return;
    
    try {
      // Load recent token refresh history from database
      const debugInfo = await this.dbStore.getDebugInfo() as any;
      if (debugInfo.recentRequests) {
        const recentRefreshes = debugInfo.recentRequests
          .filter((req: any) => req.request_type === 'refresh' && req.success)
          .map((req: any) => new Date(req.requested_at));
        
        // Only keep refreshes within our window
        const windowStart = new Date(Date.now() - this.rules.tokenWindowDuration);
        this.tokenRefreshHistory = recentRefreshes.filter(
          (time: Date) => time > windowStart
        );
        
        // Set last refresh time
        if (this.tokenRefreshHistory.length > 0) {
          this.lastTokenRefreshTime = this.tokenRefreshHistory[
            this.tokenRefreshHistory.length - 1
          ];
        }
      }
    } catch (error) {
      console.error('Failed to initialize from database:', error);
    }
  }
}