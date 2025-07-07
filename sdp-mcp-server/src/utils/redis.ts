import { createClient, RedisClientType } from 'redis';
import type { RedisConfig } from './config.js';
import { logger } from '../monitoring/logging.js';

let redisClient: RedisClientType | null = null;

/**
 * Connect to Redis
 */
export async function connectRedis(config: RedisConfig): Promise<RedisClientType> {
  if (redisClient) {
    logger.warn('Redis client already exists, returning existing client');
    return redisClient;
  }

  const url = config.password
    ? `redis://:${config.password}@${config.host}:${config.port}/${config.db}`
    : `redis://${config.host}:${config.port}/${config.db}`;

  redisClient = createClient({
    url,
    socket: {
      tls: config.tls,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection limit reached');
          return new Error('Redis reconnection limit reached');
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`Reconnecting to Redis in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  });

  // Handle Redis events
  redisClient.on('error', (err) => {
    logger.error('Redis error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client ready');
  });

  redisClient.on('end', () => {
    logger.info('Redis client disconnected');
  });

  // Connect to Redis
  try {
    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    
    logger.info('Redis connected successfully', {
      host: config.host,
      port: config.port,
      db: config.db,
    });
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the Redis client
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (!redisClient) {
    logger.warn('No Redis client to close');
    return;
  }

  try {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
    throw error;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

/**
 * Redis key prefixes for different data types
 */
export const RedisKeys = {
  // Rate limiting
  rateLimit: (tenantId: string, endpoint: string) => `rl:${tenantId}:${endpoint}`,
  
  // Session management
  session: (sessionId: string) => `session:${sessionId}`,
  
  // Token cache
  token: (tenantId: string) => `token:${tenantId}`,
  
  // Tenant cache
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  
  // Circuit breaker state
  circuitBreaker: (tenantId: string, service: string) => `cb:${tenantId}:${service}`,
  
  // Distributed locks
  lock: (resource: string) => `lock:${resource}`,
  
  // Cache invalidation
  cacheVersion: (type: string) => `cache:version:${type}`,
} as const;

/**
 * Distributed lock implementation
 */
export class RedisLock {
  private client: RedisClientType;
  private readonly defaultTtl = 30000; // 30 seconds

  constructor() {
    this.client = getRedisClient();
  }

  /**
   * Acquire a lock
   */
  async acquire(
    key: string,
    ttlMs: number = this.defaultTtl
  ): Promise<{ success: boolean; token?: string }> {
    const token = crypto.randomUUID();
    const lockKey = RedisKeys.lock(key);

    try {
      const result = await this.client.set(lockKey, token, {
        NX: true,
        PX: ttlMs,
      });

      return {
        success: result === 'OK',
        token: result === 'OK' ? token : undefined,
      };
    } catch (error) {
      logger.error('Failed to acquire lock', { key, error });
      return { success: false };
    }
  }

  /**
   * Release a lock
   */
  async release(key: string, token: string): Promise<boolean> {
    const lockKey = RedisKeys.lock(key);

    // Lua script to ensure we only delete if we own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.client.eval(script, {
        keys: [lockKey],
        arguments: [token],
      });

      return result === 1;
    } catch (error) {
      logger.error('Failed to release lock', { key, error });
      return false;
    }
  }

  /**
   * Extend a lock's TTL
   */
  async extend(key: string, token: string, ttlMs: number): Promise<boolean> {
    const lockKey = RedisKeys.lock(key);

    // Lua script to ensure we only extend if we own the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await this.client.eval(script, {
        keys: [lockKey],
        arguments: [token, ttlMs.toString()],
      });

      return result === 1;
    } catch (error) {
      logger.error('Failed to extend lock', { key, error });
      return false;
    }
  }
}

// Import crypto for lock token generation
import crypto from 'crypto';