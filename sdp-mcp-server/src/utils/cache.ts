import { getRedisClient } from './redis.js';
import { logger } from '../monitoring/logging.js';
import { getCurrentTenantId } from '../tenants/context.js';
import crypto from 'crypto';

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttlSeconds: number;      // Time to live in seconds
  keyPrefix: string;       // Prefix for cache keys
  compress?: boolean;      // Compress large values
  namespace?: string;      // Additional namespace
}

/**
 * Default cache configurations
 */
export const CACHE_CONFIGS = {
  // 3-hour cache for read operations
  READ_OPERATIONS: {
    ttlSeconds: 10800, // 3 hours
    keyPrefix: 'cache:read',
  },
  
  // Short cache for list operations
  LIST_OPERATIONS: {
    ttlSeconds: 300, // 5 minutes
    keyPrefix: 'cache:list',
  },
  
  // Very short cache for counts
  COUNT_OPERATIONS: {
    ttlSeconds: 60, // 1 minute
    keyPrefix: 'cache:count',
  },
  
  // No cache for write operations
  WRITE_OPERATIONS: {
    ttlSeconds: 0,
    keyPrefix: 'cache:write',
  },
} as const;

/**
 * Cache entry metadata
 */
interface CacheMetadata {
  key: string;
  tenantId: string;
  cachedAt: string;
  expiresAt: string;
  module: string;
  operation: string;
  version: number;
}

/**
 * Cache manager for SDP responses
 */
export class CacheManager {
  private readonly redis = getRedisClient();
  private readonly version = 1; // Cache version for invalidation
  
  /**
   * Generate cache key
   */
  private generateKey(
    module: string,
    operation: string,
    params: Record<string, any>,
    config: CacheConfig
  ): string {
    const tenantId = getCurrentTenantId() || 'system';
    
    // Create stable hash of parameters
    const paramHash = this.hashParams(params);
    
    // Build key components
    const keyParts = [
      config.keyPrefix,
      tenantId,
      module,
      operation,
      paramHash,
    ];
    
    if (config.namespace) {
      keyParts.splice(2, 0, config.namespace);
    }
    
    return keyParts.join(':');
  }
  
  /**
   * Hash parameters for cache key
   */
  private hashParams(params: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);
    
    const paramString = JSON.stringify(sortedParams);
    return crypto
      .createHash('sha256')
      .update(paramString)
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Get cached value
   */
  async get<T>(
    module: string,
    operation: string,
    params: Record<string, any>,
    config: CacheConfig
  ): Promise<T | null> {
    if (config.ttlSeconds === 0) {
      return null; // No caching
    }
    
    const key = this.generateKey(module, operation, params, config);
    
    try {
      const cached = await this.redis.get(key);
      
      if (!cached) {
        logger.debug('Cache miss', { key, module, operation });
        return null;
      }
      
      const data = JSON.parse(cached);
      
      // Check version
      if (data.metadata?.version !== this.version) {
        logger.debug('Cache version mismatch', { 
          key, 
          cachedVersion: data.metadata?.version,
          currentVersion: this.version,
        });
        await this.redis.del(key);
        return null;
      }
      
      logger.debug('Cache hit', {
        key,
        module,
        operation,
        cachedAt: data.metadata?.cachedAt,
        expiresAt: data.metadata?.expiresAt,
      });
      
      return data.value as T;
      
    } catch (error) {
      logger.error('Cache get error', { error, key });
      return null;
    }
  }
  
  /**
   * Set cached value
   */
  async set<T>(
    module: string,
    operation: string,
    params: Record<string, any>,
    value: T,
    config: CacheConfig
  ): Promise<void> {
    if (config.ttlSeconds === 0) {
      return; // No caching
    }
    
    const key = this.generateKey(module, operation, params, config);
    const tenantId = getCurrentTenantId() || 'system';
    
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (config.ttlSeconds * 1000));
      
      const metadata: CacheMetadata = {
        key,
        tenantId,
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        module,
        operation,
        version: this.version,
      };
      
      const cacheData = {
        value,
        metadata,
      };
      
      let dataString = JSON.stringify(cacheData);
      
      // Compress if needed and enabled
      if (config.compress && dataString.length > 1024) {
        // In production, you'd use a compression library like zlib
        logger.debug('Large cache value, compression recommended', {
          key,
          size: dataString.length,
        });
      }
      
      await this.redis.setex(key, config.ttlSeconds, dataString);
      
      logger.debug('Cache set', {
        key,
        module,
        operation,
        ttl: config.ttlSeconds,
        expiresAt: metadata.expiresAt,
      });
      
    } catch (error) {
      logger.error('Cache set error', { error, key });
      // Don't throw - caching errors shouldn't break the application
    }
  }
  
  /**
   * Invalidate cache entries
   */
  async invalidate(patterns: {
    module?: string;
    operation?: string;
    tenantId?: string;
  }): Promise<number> {
    const keyPattern = this.buildInvalidationPattern(patterns);
    
    try {
      // Use SCAN to find matching keys
      const keys = await this.scanKeys(keyPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete in batches
      const batchSize = 100;
      let deleted = 0;
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        deleted += await this.redis.del(...batch);
      }
      
      logger.info('Cache invalidated', {
        pattern: keyPattern,
        keysFound: keys.length,
        keysDeleted: deleted,
      });
      
      return deleted;
      
    } catch (error) {
      logger.error('Cache invalidation error', { error, pattern: keyPattern });
      return 0;
    }
  }
  
  /**
   * Build invalidation pattern
   */
  private buildInvalidationPattern(patterns: {
    module?: string;
    operation?: string;
    tenantId?: string;
  }): string {
    const parts = ['cache', '*']; // Start with cache prefix
    
    if (patterns.tenantId) {
      parts.push(patterns.tenantId);
    } else {
      parts.push('*');
    }
    
    if (patterns.module) {
      parts.push(patterns.module);
    } else {
      parts.push('*');
    }
    
    if (patterns.operation) {
      parts.push(patterns.operation);
    } else {
      parts.push('*');
    }
    
    parts.push('*'); // Parameter hash
    
    return parts.join(':');
  }
  
  /**
   * Scan for keys matching pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    
    do {
      const result = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      
      cursor = result[0];
      keys.push(...result[1]);
      
    } while (cursor !== '0');
    
    return keys;
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const dbSize = await this.redis.dbSize();
      
      // Parse memory usage from INFO command
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      // Calculate approximate hit rate (would need proper tracking)
      const hits = await this.redis.get('cache:stats:hits') || '0';
      const misses = await this.redis.get('cache:stats:misses') || '0';
      const totalRequests = parseInt(hits) + parseInt(misses);
      const hitRate = totalRequests > 0 ? parseInt(hits) / totalRequests : 0;
      
      return {
        totalKeys: dbSize,
        memoryUsage,
        hitRate,
      };
      
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
      };
    }
  }
}

/**
 * Cache decorator for methods
 */
export function cacheable(
  module: string,
  operation: string,
  config: CacheConfig = CACHE_CONFIGS.READ_OPERATIONS
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cacheManager = new CacheManager();
    
    descriptor.value = async function (...args: any[]) {
      // Build cache params from arguments
      const params = args[0] || {};
      
      // Try to get from cache
      const cached = await cacheManager.get(
        module,
        operation,
        params,
        config
      );
      
      if (cached !== null) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      await cacheManager.set(
        module,
        operation,
        params,
        result,
        config
      );
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Create cache invalidation helper
 */
export function createCacheInvalidator(module: string) {
  const cacheManager = new CacheManager();
  
  return {
    /**
     * Invalidate all cache for the module
     */
    async invalidateAll(): Promise<void> {
      await cacheManager.invalidate({ module });
    },
    
    /**
     * Invalidate specific operation
     */
    async invalidateOperation(operation: string): Promise<void> {
      await cacheManager.invalidate({ module, operation });
    },
    
    /**
     * Invalidate for current tenant
     */
    async invalidateTenant(): Promise<void> {
      const tenantId = getCurrentTenantId();
      if (tenantId) {
        await cacheManager.invalidate({ module, tenantId });
      }
    },
  };
}