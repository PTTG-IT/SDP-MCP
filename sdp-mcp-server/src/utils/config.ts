import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../monitoring/logging.js';

// Load environment variables
dotenv.config();

/**
 * Environment configuration schema
 */
const configSchema = z.object({
  // Server configuration
  server: z.object({
    env: z.enum(['development', 'test', 'production']).default('development'),
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default('0.0.0.0'),
    endpoints: z.array(z.string()).min(1),
  }),
  
  // Security configuration
  security: z.object({
    encryptionKey: z.string().min(32),
    jwtSecret: z.string().min(32),
    sessionSecret: z.string().min(32),
  }),
  
  // Database configuration
  database: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    name: z.string(),
    user: z.string(),
    password: z.string(),
    ssl: z.boolean().default(false),
    poolMin: z.number().min(1).default(2),
    poolMax: z.number().min(1).default(10),
  }),
  
  // Redis configuration
  redis: z.object({
    host: z.string(),
    port: z.number().min(1).max(65535),
    password: z.string().optional(),
    tls: z.boolean().default(false),
    db: z.number().min(0).max(15).default(0),
  }),
  
  // Service Desk Plus configuration
  sdp: z.object({
    apiVersion: z.string().default('v3'),
    defaultPageSize: z.number().min(1).max(500).default(100),
    maxPageSize: z.number().min(1).max(1000).default(500),
    timeoutMs: z.number().min(1000).default(30000),
    retryAttempts: z.number().min(0).max(5).default(3),
    retryDelayMs: z.number().min(100).default(1000),
  }),
  
  // Rate limiting configuration
  rateLimit: z.object({
    windowMs: z.number().min(1000).default(60000),
    maxRequests: z.number().min(1).default(100),
    perTenant: z.boolean().default(true),
  }),
  
  // Logging configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    filePath: z.string().optional(),
    maxSize: z.string().default('10m'),
    maxFiles: z.number().min(1).default(5),
    compress: z.boolean().default(true),
  }),
  
  // Monitoring configuration
  monitoring: z.object({
    metricsEnabled: z.boolean().default(true),
    metricsPort: z.number().min(1).max(65535).default(9090),
    healthCheckIntervalMs: z.number().min(1000).default(30000),
    tracingEnabled: z.boolean().default(true),
    tracingEndpoint: z.string().optional(),
  }),
  
  // Multi-tenant configuration
  multiTenant: z.object({
    maxTenants: z.number().min(1).default(100),
    tenantCacheTtlSeconds: z.number().min(60).default(300),
    tokenRefreshBufferSeconds: z.number().min(60).default(300),
    scopeValidationEnabled: z.boolean().default(true),
  }),
  
  // Admin configuration
  admin: z.object({
    enabled: z.boolean().default(true),
    apiKey: z.string().min(32),
    port: z.number().min(1).max(65535).default(3001),
  }),
  
  // Development configuration
  dev: z.object({
    debug: z.boolean().default(false),
    enableSwagger: z.boolean().default(true),
    enablePlayground: z.boolean().default(true),
  }),
});

export type Config = z.infer<typeof configSchema>;
export type DatabaseConfig = Config['database'];
export type RedisConfig = Config['redis'];
export type ServerConfig = Config['server'];

/**
 * Parse and validate environment variables
 */
export function validateEnvironment(): Config {
  const rawConfig = {
    server: {
      env: process.env.NODE_ENV,
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST,
      endpoints: process.env.SERVER_ENDPOINTS?.split(',') || [],
    },
    security: {
      encryptionKey: process.env.ENCRYPTION_KEY,
      jwtSecret: process.env.JWT_SECRET,
      sessionSecret: process.env.SESSION_SECRET,
    },
    database: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
      poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === 'true',
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    sdp: {
      apiVersion: process.env.SDP_API_VERSION,
      defaultPageSize: parseInt(process.env.SDP_DEFAULT_PAGE_SIZE || '100', 10),
      maxPageSize: parseInt(process.env.SDP_MAX_PAGE_SIZE || '500', 10),
      timeoutMs: parseInt(process.env.SDP_TIMEOUT_MS || '30000', 10),
      retryAttempts: parseInt(process.env.SDP_RETRY_ATTEMPTS || '3', 10),
      retryDelayMs: parseInt(process.env.SDP_RETRY_DELAY_MS || '1000', 10),
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      perTenant: process.env.RATE_LIMIT_PER_TENANT !== 'false',
    },
    logging: {
      level: process.env.LOG_LEVEL,
      format: process.env.LOG_FORMAT,
      filePath: process.env.LOG_FILE_PATH,
      maxSize: process.env.LOG_MAX_SIZE,
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
      compress: process.env.LOG_COMPRESS !== 'false',
    },
    monitoring: {
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
      healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '30000', 10),
      tracingEnabled: process.env.ENABLE_TRACING === 'true',
      tracingEndpoint: process.env.TRACING_ENDPOINT,
    },
    multiTenant: {
      maxTenants: parseInt(process.env.MAX_TENANTS || '100', 10),
      tenantCacheTtlSeconds: parseInt(process.env.TENANT_CACHE_TTL_SECONDS || '300', 10),
      tokenRefreshBufferSeconds: parseInt(process.env.TOKEN_REFRESH_BUFFER_SECONDS || '300', 10),
      scopeValidationEnabled: process.env.SCOPE_VALIDATION_ENABLED !== 'false',
    },
    admin: {
      enabled: process.env.ADMIN_API_ENABLED !== 'false',
      apiKey: process.env.ADMIN_API_KEY,
      port: parseInt(process.env.ADMIN_PORT || '3001', 10),
    },
    dev: {
      debug: process.env.DEBUG === 'true',
      enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
      enablePlayground: process.env.ENABLE_PLAYGROUND !== 'false',
    },
  };
  
  try {
    const config = configSchema.parse(rawConfig);
    logger.info('Configuration validated successfully');
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Configuration validation failed', {
        errors: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      throw new Error(`Configuration validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Get configuration value with fallback
 */
export function getConfigValue<T>(
  path: string,
  defaultValue: T,
  transform?: (value: string) => T
): T {
  const value = process.env[path];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  if (transform) {
    try {
      return transform(value);
    } catch {
      logger.warn(`Failed to transform config value: ${path}, using default`);
      return defaultValue;
    }
  }
  
  return value as unknown as T;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

// Export a singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = validateEnvironment();
  }
  return configInstance;
}