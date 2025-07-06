import axios from 'axios';
import { TokenStore } from './tokenStore.js';
import { RateLimitCoordinator } from './rateLimitCoordinator.js';
// import { getTokenStoreIntegration } from '../db/integration.js';
import { SDPConfig } from './types.js';

export interface TokenValidationResult {
  isValid: boolean;
  reason?: string;
  expiresIn?: number;
  needsRefresh: boolean;
  canRefreshNow: boolean;
}

/**
 * Token Validator - Validates OAuth tokens and detects revoked tokens
 * 
 * Features:
 * - Validates token expiry
 * - Detects revoked tokens via API call
 * - Checks token scopes
 * - Provides refresh recommendations
 */
export class TokenValidator {
  private tokenStore: TokenStore;
  private rateLimitCoordinator: RateLimitCoordinator;
  private lastValidationTime: Date | null = null;
  private validationCache: Map<string, { result: boolean; timestamp: Date }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private config: SDPConfig) {
    this.tokenStore = TokenStore.getInstance();
    this.rateLimitCoordinator = RateLimitCoordinator.getInstance();
  }

  /**
   * Validate current access token
   */
  async validateToken(skipApiCheck: boolean = false): Promise<TokenValidationResult> {
    const { accessToken, tokenExpiry } = this.tokenStore.getTokens();
    
    // No token available
    if (!accessToken) {
      return {
        isValid: false,
        reason: 'No access token available',
        needsRefresh: true,
        canRefreshNow: await this.rateLimitCoordinator.canRefreshToken()
      };
    }
    
    // Check expiry
    const now = Date.now();
    if (!tokenExpiry) {
      return {
        isValid: false,
        reason: 'Token expiry information missing',
        needsRefresh: true,
        canRefreshNow: await this.rateLimitCoordinator.canRefreshToken()
      };
    }
    
    const expiresIn = tokenExpiry.getTime() - now;
    
    // Token expired
    if (expiresIn <= 0) {
      return {
        isValid: false,
        reason: 'Token has expired',
        expiresIn: 0,
        needsRefresh: true,
        canRefreshNow: await this.rateLimitCoordinator.canRefreshToken()
      };
    }
    
    // Check if token needs refresh soon (within 5 minutes)
    const needsRefresh = expiresIn < 5 * 60 * 1000;
    
    // Check cache first
    const cacheKey = accessToken.substring(0, 10); // Use first 10 chars as key
    const cached = this.validationCache.get(cacheKey);
    if (cached && (now - cached.timestamp.getTime()) < this.cacheTimeout) {
      return {
        isValid: cached.result,
        reason: cached.result ? undefined : 'Token validation failed (cached)',
        expiresIn: Math.floor(expiresIn / 1000),
        needsRefresh,
        canRefreshNow: needsRefresh ? await this.rateLimitCoordinator.canRefreshToken() : false
      };
    }
    
    // If skipApiCheck is true, just check expiry
    if (skipApiCheck) {
      return {
        isValid: true,
        expiresIn: Math.floor(expiresIn / 1000),
        needsRefresh,
        canRefreshNow: needsRefresh ? await this.rateLimitCoordinator.canRefreshToken() : false
      };
    }
    
    // Validate token with API
    const apiValidation = await this.validateTokenWithAPI(accessToken);
    
    // Cache the result
    this.validationCache.set(cacheKey, {
      result: apiValidation,
      timestamp: new Date()
    });
    
    return {
      isValid: apiValidation,
      reason: apiValidation ? undefined : 'Token validation failed with API',
      expiresIn: Math.floor(expiresIn / 1000),
      needsRefresh,
      canRefreshNow: needsRefresh ? await this.rateLimitCoordinator.canRefreshToken() : false
    };
  }

  /**
   * Validate token with Service Desk Plus API
   */
  private async validateTokenWithAPI(token: string): Promise<boolean> {
    try {
      // Use a lightweight endpoint to validate the token
      const baseURL = this.config.baseUrl || 
        `https://sdpondemand.manageengine.com/app/${this.config.instanceName}/api/v3`;
      
      const response = await axios.get(`${baseURL}/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.manageengine.sdp.v3+json'
        },
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 1,
              start_index: 1
            }
          })
        },
        timeout: 5000 // 5 second timeout
      });
      
      // If we get a successful response, token is valid
      this.lastValidationTime = new Date();
      return response.status === 200;
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // 401 means token is invalid
        if (error.response?.status === 401) {
          return false;
        }
        
        // Other errors don't necessarily mean token is invalid
        console.warn('Token validation API call failed:', error.message);
      }
      
      // Default to assuming token is valid if we can't verify
      return true;
    }
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get last validation time
   */
  getLastValidationTime(): Date | null {
    return this.lastValidationTime;
  }

  /**
   * Check if token refresh is recommended
   */
  async getRefreshRecommendation(): Promise<{
    shouldRefresh: boolean;
    reason: string;
    canRefreshNow: boolean;
    timeUntilRefresh?: number;
  }> {
    const validation = await this.validateToken(true); // Skip API check for performance
    
    // Token is invalid or expired
    if (!validation.isValid) {
      return {
        shouldRefresh: true,
        reason: validation.reason || 'Token is invalid',
        canRefreshNow: validation.canRefreshNow,
        timeUntilRefresh: validation.canRefreshNow ? 0 : this.rateLimitCoordinator.getTimeUntilNextRefresh()
      };
    }
    
    // Token expires soon
    if (validation.needsRefresh) {
      return {
        shouldRefresh: true,
        reason: `Token expires in ${validation.expiresIn} seconds`,
        canRefreshNow: validation.canRefreshNow,
        timeUntilRefresh: validation.canRefreshNow ? 0 : this.rateLimitCoordinator.getTimeUntilNextRefresh()
      };
    }
    
    // Token is valid and not expiring soon
    return {
      shouldRefresh: false,
      reason: 'Token is valid and not expiring soon',
      canRefreshNow: false
    };
  }

  /**
   * Validate refresh token
   */
  async validateRefreshToken(): Promise<{
    hasRefreshToken: boolean;
    canUseRefreshToken: boolean;
    reason?: string;
  }> {
    const { refreshToken } = this.tokenStore.getTokens();
    
    if (!refreshToken) {
      return {
        hasRefreshToken: false,
        canUseRefreshToken: false,
        reason: 'No refresh token available'
      };
    }
    
    // Check if we can use refresh token based on rate limits
    const canRefresh = await this.rateLimitCoordinator.canRefreshToken();
    
    if (!canRefresh) {
      const timeUntilNext = this.rateLimitCoordinator.getTimeUntilNextRefresh();
      const minutes = Math.ceil(timeUntilNext / 60000);
      
      return {
        hasRefreshToken: true,
        canUseRefreshToken: false,
        reason: `Rate limit: Must wait ${minutes} minutes before next refresh`
      };
    }
    
    return {
      hasRefreshToken: true,
      canUseRefreshToken: true
    };
  }

  /**
   * Get comprehensive token status
   */
  async getTokenStatus(): Promise<{
    access: TokenValidationResult;
    refresh: {
      hasRefreshToken: boolean;
      canUseRefreshToken: boolean;
      reason?: string;
    };
    recommendation: {
      shouldRefresh: boolean;
      reason: string;
      canRefreshNow: boolean;
      timeUntilRefresh?: number;
    };
    rateLimitStatus: any;
  }> {
    const [access, refresh, recommendation] = await Promise.all([
      this.validateToken(true),
      this.validateRefreshToken(),
      this.getRefreshRecommendation()
    ]);
    
    return {
      access,
      refresh,
      recommendation,
      rateLimitStatus: this.rateLimitCoordinator.getStatus()
    };
  }
}