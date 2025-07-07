import { TokenRepository } from '../database/repositories/TokenRepository.js';
import { TokenManager } from './tokenManager.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger, AuditEventTypes } from '../monitoring/auditLogger.js';

/**
 * Token refresh scheduler for automatic token renewal
 */
export class TokenRefreshScheduler {
  private readonly tokenRepo: TokenRepository;
  private readonly tokenManager: TokenManager;
  private readonly checkIntervalMs: number;
  private readonly refreshBufferSeconds: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  constructor(
    tokenManager: TokenManager,
    checkIntervalMs: number = 60000, // 1 minute
    refreshBufferSeconds: number = 300 // 5 minutes
  ) {
    this.tokenRepo = new TokenRepository();
    this.tokenManager = tokenManager;
    this.checkIntervalMs = checkIntervalMs;
    this.refreshBufferSeconds = refreshBufferSeconds;
  }
  
  /**
   * Start the refresh scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Token refresh scheduler already running');
      return;
    }
    
    this.isRunning = true;
    logger.info('Starting token refresh scheduler', {
      checkIntervalMs: this.checkIntervalMs,
      refreshBufferSeconds: this.refreshBufferSeconds,
    });
    
    // Run immediately on start
    void this.checkAndRefreshTokens();
    
    // Schedule periodic checks
    this.intervalHandle = setInterval(() => {
      void this.checkAndRefreshTokens();
    }, this.checkIntervalMs);
  }
  
  /**
   * Stop the refresh scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    
    logger.info('Token refresh scheduler stopped');
  }
  
  /**
   * Check and refresh expiring tokens
   */
  private async checkAndRefreshTokens(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Find tokens expiring soon
      const expiringTokens = await this.tokenRepo.findExpiringTokens(
        this.refreshBufferSeconds
      );
      
      if (expiringTokens.length === 0) {
        logger.debug('No tokens need refreshing');
        return;
      }
      
      logger.info('Found tokens needing refresh', {
        count: expiringTokens.length,
      });
      
      // Refresh tokens in parallel (with concurrency limit)
      const concurrencyLimit = 5;
      const results = await this.refreshTokensConcurrently(
        expiringTokens,
        concurrencyLimit
      );
      
      // Log results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      logger.info('Token refresh cycle completed', {
        totalTokens: expiringTokens.length,
        successCount,
        failureCount,
        durationMs: Date.now() - startTime,
      });
      
      // Log system event
      await auditLogger.log({
        eventType: AuditEventTypes.SYSTEM_HEALTH_CHECK,
        eventCategory: 'system',
        actorType: 'system',
        action: 'token_refresh_cycle',
        result: failureCount === 0 ? 'success' : 'partial',
        metadata: {
          totalTokens: expiringTokens.length,
          successCount,
          failureCount,
        },
      });
      
    } catch (error) {
      logger.error('Error in token refresh cycle', { error });
      
      await auditLogger.log({
        eventType: AuditEventTypes.SYSTEM_ERROR,
        eventCategory: 'system',
        actorType: 'system',
        action: 'token_refresh_cycle',
        result: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  /**
   * Refresh tokens with concurrency control
   */
  private async refreshTokensConcurrently(
    tokens: any[],
    concurrencyLimit: number
  ): Promise<{ tenantId: string; success: boolean; error?: string }[]> {
    const results: { tenantId: string; success: boolean; error?: string }[] = [];
    const queue = [...tokens];
    const inProgress = new Set<Promise<void>>();
    
    while (queue.length > 0 || inProgress.size > 0) {
      // Start new refreshes up to concurrency limit
      while (inProgress.size < concurrencyLimit && queue.length > 0) {
        const token = queue.shift()!;
        
        const refreshPromise = this.refreshSingleToken(token.tenantId)
          .then(() => {
            results.push({ tenantId: token.tenantId, success: true });
          })
          .catch((error) => {
            logger.error('Failed to refresh token', {
              tenantId: token.tenantId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            
            results.push({
              tenantId: token.tenantId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          })
          .finally(() => {
            inProgress.delete(refreshPromise);
          });
        
        inProgress.add(refreshPromise);
      }
      
      // Wait for at least one to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }
    
    return results;
  }
  
  /**
   * Refresh a single token with error handling
   */
  private async refreshSingleToken(tenantId: string): Promise<void> {
    try {
      logger.debug('Refreshing token for tenant', { tenantId });
      await this.tokenManager.refreshToken(tenantId);
      
    } catch (error) {
      // Check if it's a permanent error
      if (this.isPermanentError(error)) {
        logger.error('Permanent token refresh error', {
          tenantId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        await auditLogger.log({
          tenantId,
          eventType: AuditEventTypes.AUTH_TOKEN_EXPIRED,
          eventCategory: 'auth',
          actorType: 'system',
          action: 'token_refresh',
          result: 'failure',
          errorMessage: 'Permanent refresh failure - manual intervention required',
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Check if error is permanent (not retryable)
   */
  private isPermanentError(error: any): boolean {
    if (!error) {
      return false;
    }
    
    // Check for specific error codes
    if (error.code === 'invalid_grant' || 
        error.code === 'invalid_client' ||
        error.statusCode === 401) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Manually trigger token refresh for a tenant
   */
  async refreshTenantToken(tenantId: string): Promise<void> {
    await this.refreshSingleToken(tenantId);
  }
  
  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    checkIntervalMs: number;
    refreshBufferSeconds: number;
  } {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
      refreshBufferSeconds: this.refreshBufferSeconds,
    };
  }
}