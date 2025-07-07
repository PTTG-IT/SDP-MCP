import { TokenRepository } from '../database/repositories/TokenRepository.js';
import { TenantManager } from '../tenants/manager.js';
import { OAuthClient, OAuthError } from './oauth.js';
import { EncryptionService } from './encryption.js';
import { RedisLock, getRedisClient, RedisKeys } from '../utils/redis.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger, AuditEventTypes } from '../monitoring/auditLogger.js';
import type { StoredTokenModel } from '../database/models/types.js';

/**
 * Token manager for handling OAuth tokens
 */
export class TokenManager {
  private readonly tokenRepo: TokenRepository;
  private readonly tenantManager: TenantManager;
  private readonly encryption: EncryptionService;
  private readonly redisLock: RedisLock;
  private readonly tokenCacheTtlSeconds: number;
  
  constructor(
    tenantManager: TenantManager,
    encryptionKey: string,
    tokenCacheTtlSeconds: number = 300
  ) {
    this.tokenRepo = new TokenRepository();
    this.tenantManager = tenantManager;
    this.encryption = new EncryptionService(encryptionKey);
    this.redisLock = new RedisLock();
    this.tokenCacheTtlSeconds = tokenCacheTtlSeconds;
  }
  
  /**
   * Get valid access token for tenant
   */
  async getAccessToken(tenantId: string): Promise<string> {
    // Check cache first
    const cached = await this.getCachedToken(tenantId);
    if (cached) {
      return cached;
    }
    
    // Get stored token
    const storedToken = await this.tokenRepo.findByTenantId(tenantId);
    
    if (!storedToken) {
      throw new Error(`No token found for tenant ${tenantId}`);
    }
    
    // Check if token is expired or expiring soon
    const now = new Date();
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    const tokenExpiringSoon = storedToken.expiresAt.getTime() - now.getTime() < expiryBuffer;
    
    if (tokenExpiringSoon) {
      // Refresh the token
      return this.refreshToken(tenantId);
    }
    
    // Decrypt and cache the token
    const tenant = await this.tenantManager.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    const decryptedToken = this.encryption.decryptString(
      storedToken.accessTokenEncrypted,
      tenant.name
    );
    
    // Cache the token
    await this.cacheToken(tenantId, decryptedToken, storedToken.expiresAt);
    
    return decryptedToken;
  }
  
  /**
   * Refresh token for tenant
   */
  async refreshToken(tenantId: string): Promise<string> {
    // Acquire lock to prevent concurrent refreshes
    const lockKey = `token-refresh:${tenantId}`;
    const lock = await this.redisLock.acquire(lockKey, 30000); // 30 seconds
    
    if (!lock.success) {
      // Another process is refreshing, wait and retry
      logger.debug('Token refresh already in progress', { tenantId });
      await new Promise(resolve => setTimeout(resolve, 2000));
      return this.getAccessToken(tenantId);
    }
    
    try {
      // Double-check if token was refreshed while waiting for lock
      const cached = await this.getCachedToken(tenantId);
      if (cached) {
        return cached;
      }
      
      // Load tenant configuration
      const tenant = await this.tenantManager.getTenant(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }
      
      // Get current stored token for refresh token
      const storedToken = await this.tokenRepo.findByTenantId(tenantId);
      if (!storedToken) {
        throw new Error(`No stored token for tenant ${tenantId}`);
      }
      
      const decryptedRefreshToken = this.encryption.decryptString(
        storedToken.refreshTokenEncrypted,
        tenant.name
      );
      
      // Create OAuth client for tenant's data center
      const oauthClient = new OAuthClient(tenant.dataCenter);
      
      // Refresh the token
      logger.info('Refreshing OAuth token', { tenantId, name: tenant.name });
      
      const tokenResponse = await oauthClient.refreshAccessToken(
        tenant.oauthConfig.clientId,
        tenant.oauthConfig.clientSecret,
        decryptedRefreshToken,
        tenantId
      );
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (tokenResponse.expires_in * 1000));
      
      // Encrypt new tokens
      const encryptedAccessToken = this.encryption.encryptString(
        tokenResponse.access_token,
        tenant.name
      );
      const encryptedRefreshToken = this.encryption.encryptString(
        tokenResponse.refresh_token,
        tenant.name
      );
      
      // Store updated tokens
      await this.tokenRepo.upsert({
        tenantId,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        expiresAt,
        scopes: tokenResponse.scope.split(' '),
        tokenType: tokenResponse.token_type,
      });
      
      // Cache the new token
      await this.cacheToken(tenantId, tokenResponse.access_token, expiresAt);
      
      // Log successful refresh
      await auditLogger.log({
        tenantId,
        eventType: AuditEventTypes.AUTH_TOKEN_REFRESH,
        eventCategory: 'auth',
        actorType: 'system',
        action: 'token_refresh',
        result: 'success',
        metadata: {
          expiresIn: tokenResponse.expires_in,
          scopes: tokenResponse.scope,
        },
      });
      
      logger.info('OAuth token refreshed successfully', {
        tenantId,
        name: tenant.name,
        expiresAt,
      });
      
      return tokenResponse.access_token;
      
    } catch (error) {
      logger.error('Failed to refresh token', { tenantId, error });
      
      // Log failed refresh
      await auditLogger.log({
        tenantId,
        eventType: AuditEventTypes.AUTH_FAILED,
        eventCategory: 'auth',
        actorType: 'system',
        action: 'token_refresh',
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (error instanceof OAuthError && error.isInvalidRefreshToken()) {
        // Mark tenant as needing re-authentication
        await this.tenantManager.updateTenantStatus(
          tenantId,
          'suspended',
          'Invalid refresh token'
        );
      }
      
      throw error;
      
    } finally {
      // Release the lock
      if (lock.token) {
        await this.redisLock.release(lockKey, lock.token);
      }
    }
  }
  
  /**
   * Store initial tokens for a new tenant
   */
  async storeInitialTokens(
    tenantId: string,
    tenantName: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    scopes: string[]
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    
    // Encrypt tokens
    const encryptedAccessToken = this.encryption.encryptString(accessToken, tenantName);
    const encryptedRefreshToken = this.encryption.encryptString(refreshToken, tenantName);
    
    // Store tokens
    await this.tokenRepo.upsert({
      tenantId,
      accessTokenEncrypted: encryptedAccessToken,
      refreshTokenEncrypted: encryptedRefreshToken,
      expiresAt,
      scopes,
      tokenType: 'Bearer',
    });
    
    // Cache the token
    await this.cacheToken(tenantId, accessToken, expiresAt);
    
    logger.info('Initial tokens stored', { tenantId, expiresAt });
  }
  
  /**
   * Get cached token
   */
  private async getCachedToken(tenantId: string): Promise<string | null> {
    const redis = getRedisClient();
    const cacheKey = RedisKeys.token(tenantId);
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('Token found in cache', { tenantId });
      return cached;
    }
    
    return null;
  }
  
  /**
   * Cache token
   */
  private async cacheToken(
    tenantId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = RedisKeys.token(tenantId);
    
    // Calculate TTL (with buffer)
    const now = new Date();
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000) - 300 // 5 minute buffer
    );
    
    // Don't cache if TTL is too short
    if (ttlSeconds < 60) {
      return;
    }
    
    // Cache with TTL
    await redis.setex(
      cacheKey,
      Math.min(ttlSeconds, this.tokenCacheTtlSeconds),
      token
    );
    
    logger.debug('Token cached', { tenantId, ttlSeconds });
  }
  
  /**
   * Invalidate cached token
   */
  async invalidateToken(tenantId: string): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = RedisKeys.token(tenantId);
    await redis.del(cacheKey);
    logger.debug('Token cache invalidated', { tenantId });
  }
  
  /**
   * Get token statistics for monitoring
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    avgRefreshCount: number;
  }> {
    return this.tokenRepo.getStatistics();
  }
}