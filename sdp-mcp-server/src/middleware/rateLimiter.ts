import type { Request, Response, NextFunction } from 'express';
import { getRedisClient, RedisKeys } from '../utils/redis.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger, AuditEventTypes } from '../monitoring/auditLogger.js';
import { getCurrentTenantId } from '../tenants/context.js';
import type { TenantRequest } from '../tenants/middleware.js';
import { RATE_LIMIT_TIERS, type RateLimitConfig } from '../tenants/models/tenant.js';

/**
 * Rate limit result
 */
interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private readonly redis = getRedisClient();
  
  /**
   * Check rate limit for a key
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const redisKey = `${key}:${window}`;
    
    try {
      // Increment counter
      const count = await this.redis.incr(redisKey);
      
      // Set expiry on first request in window
      if (count === 1) {
        await this.redis.expire(redisKey, Math.ceil(windowMs / 1000));
      }
      
      // Calculate result
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetAt = new Date((window + 1) * windowMs);
      const retryAfter = allowed ? undefined : Math.ceil((resetAt.getTime() - now) / 1000);
      
      return {
        allowed,
        count,
        limit,
        remaining,
        resetAt,
        retryAfter,
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error, key });
      // Fail open on Redis errors
      return {
        allowed: true,
        count: 0,
        limit,
        remaining: limit,
        resetAt: new Date(now + windowMs),
      };
    }
  }
  
  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string, windowMs: number): Promise<void> {
    const window = Math.floor(Date.now() / windowMs);
    const redisKey = `${key}:${window}`;
    
    try {
      await this.redis.del(redisKey);
      logger.debug('Rate limit reset', { key });
    } catch (error) {
      logger.error('Failed to reset rate limit', { error, key });
    }
  }
  
  /**
   * Get current usage for a key
   */
  async getCurrentUsage(key: string, windowMs: number): Promise<number> {
    const window = Math.floor(Date.now() / windowMs);
    const redisKey = `${key}:${window}`;
    
    try {
      const count = await this.redis.get(redisKey);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      logger.error('Failed to get rate limit usage', { error, key });
      return 0;
    }
  }
}

/**
 * Create per-tenant rate limiting middleware
 */
export function createRateLimitMiddleware(
  endpoint: string,
  rateLimiter: RateLimiter = new RateLimiter()
) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    // Skip rate limiting if no tenant context
    if (!req.tenant) {
      next();
      return;
    }
    
    const tenantId = req.tenantId!;
    const rateLimitConfig = req.tenant.rateLimits;
    
    // Check different rate limit windows
    const checks = [
      { 
        key: RedisKeys.rateLimit(tenantId, `${endpoint}:minute`),
        limit: rateLimitConfig.requestsPerMinute,
        window: 60 * 1000, // 1 minute
      },
      {
        key: RedisKeys.rateLimit(tenantId, `${endpoint}:hour`),
        limit: rateLimitConfig.requestsPerHour,
        window: 60 * 60 * 1000, // 1 hour
      },
      {
        key: RedisKeys.rateLimit(tenantId, `${endpoint}:day`),
        limit: rateLimitConfig.requestsPerDay,
        window: 24 * 60 * 60 * 1000, // 1 day
      },
    ];
    
    // Check all rate limits
    const results = await Promise.all(
      checks.map(check => 
        rateLimiter.checkRateLimit(check.key, check.limit, check.window)
      )
    );
    
    // Find the most restrictive limit that was exceeded
    const exceeded = results.find(r => !r.allowed);
    
    if (exceeded) {
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', exceeded.limit.toString());
      res.setHeader('X-RateLimit-Remaining', exceeded.remaining.toString());
      res.setHeader('X-RateLimit-Reset', exceeded.resetAt.toISOString());
      res.setHeader('Retry-After', exceeded.retryAfter!.toString());
      
      // Log rate limit exceeded
      await auditLogger.log({
        tenantId,
        eventType: AuditEventTypes.API_RATE_LIMITED,
        eventCategory: 'api',
        actorType: 'tenant',
        resourceType: 'endpoint',
        resourceId: endpoint,
        action: 'rate_limit_exceeded',
        result: 'failure',
        metadata: {
          endpoint,
          limit: exceeded.limit,
          count: exceeded.count,
          resetAt: exceeded.resetAt,
        },
      });
      
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: exceeded.retryAfter,
        resetAt: exceeded.resetAt,
      });
      return;
    }
    
    // Set rate limit headers for successful requests
    const minuteLimit = results[0]!;
    res.setHeader('X-RateLimit-Limit', minuteLimit.limit.toString());
    res.setHeader('X-RateLimit-Remaining', minuteLimit.remaining.toString());
    res.setHeader('X-RateLimit-Reset', minuteLimit.resetAt.toISOString());
    
    next();
  };
}

/**
 * Create burst rate limiting middleware
 */
export function createBurstLimitMiddleware(
  rateLimiter: RateLimiter = new RateLimiter()
) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenant) {
      next();
      return;
    }
    
    const tenantId = req.tenantId!;
    const burstLimit = req.tenant.rateLimits.burstLimit;
    const key = RedisKeys.rateLimit(tenantId, 'burst');
    
    // Check burst limit (10 second window)
    const result = await rateLimiter.checkRateLimit(key, burstLimit, 10000);
    
    if (!result.allowed) {
      res.status(429).json({
        error: 'Burst limit exceeded',
        code: 'BURST_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
      });
      return;
    }
    
    next();
  };
}

/**
 * Create concurrent request limiting middleware
 */
export function createConcurrentLimitMiddleware() {
  const activeRequests = new Map<string, number>();
  
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenant) {
      next();
      return;
    }
    
    const tenantId = req.tenantId!;
    const limit = req.tenant.rateLimits.concurrentRequests;
    const current = activeRequests.get(tenantId) || 0;
    
    if (current >= limit) {
      res.status(429).json({
        error: 'Concurrent request limit exceeded',
        code: 'CONCURRENT_LIMIT_EXCEEDED',
        limit,
        current,
      });
      return;
    }
    
    // Increment counter
    activeRequests.set(tenantId, current + 1);
    
    // Decrement on response finish
    res.on('finish', () => {
      const count = activeRequests.get(tenantId) || 0;
      if (count > 1) {
        activeRequests.set(tenantId, count - 1);
      } else {
        activeRequests.delete(tenantId);
      }
    });
    
    next();
  };
}

/**
 * Rate limit manager for programmatic control
 */
export class RateLimitManager {
  private readonly rateLimiter = new RateLimiter();
  
  /**
   * Get current usage for a tenant
   */
  async getTenantUsage(tenantId: string): Promise<{
    minute: number;
    hour: number;
    day: number;
  }> {
    const [minute, hour, day] = await Promise.all([
      this.rateLimiter.getCurrentUsage(
        RedisKeys.rateLimit(tenantId, 'api:minute'),
        60 * 1000
      ),
      this.rateLimiter.getCurrentUsage(
        RedisKeys.rateLimit(tenantId, 'api:hour'),
        60 * 60 * 1000
      ),
      this.rateLimiter.getCurrentUsage(
        RedisKeys.rateLimit(tenantId, 'api:day'),
        24 * 60 * 60 * 1000
      ),
    ]);
    
    return { minute, hour, day };
  }
  
  /**
   * Reset rate limits for a tenant
   */
  async resetTenantLimits(tenantId: string): Promise<void> {
    await Promise.all([
      this.rateLimiter.resetRateLimit(
        RedisKeys.rateLimit(tenantId, 'api:minute'),
        60 * 1000
      ),
      this.rateLimiter.resetRateLimit(
        RedisKeys.rateLimit(tenantId, 'api:hour'),
        60 * 60 * 1000
      ),
      this.rateLimiter.resetRateLimit(
        RedisKeys.rateLimit(tenantId, 'api:day'),
        24 * 60 * 60 * 1000
      ),
    ]);
    
    logger.info('Rate limits reset for tenant', { tenantId });
  }
}