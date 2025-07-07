import pg from 'pg';
import type { DatabaseConfig } from '../utils/config.js';
import { logger } from '../monitoring/logging.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Database connection configuration
 */
export interface ConnectionOptions extends DatabaseConfig {
  application_name?: string;
}

/**
 * Create and configure a PostgreSQL connection pool
 */
export async function connectDatabase(config: ConnectionOptions): Promise<pg.Pool> {
  if (pool) {
    logger.warn('Database pool already exists, returning existing pool');
    return pool;
  }

  const poolConfig: pg.PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.name,
    user: config.user,
    password: config.password,
    min: config.poolMin,
    max: config.poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    application_name: config.application_name || 'sdp-mcp-server',
  };

  // Add SSL configuration if enabled
  if (config.ssl) {
    poolConfig.ssl = {
      rejectUnauthorized: true,
    };
  }

  pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error('Unexpected database pool error:', err);
  });

  pool.on('connect', () => {
    logger.debug('New database client connected');
  });

  pool.on('acquire', () => {
    logger.debug('Database client acquired from pool');
  });

  pool.on('remove', () => {
    logger.debug('Database client removed from pool');
  });

  // Test the connection
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    logger.info('Database connected successfully', {
      currentTime: result.rows[0]?.current_time,
      host: config.host,
      database: config.name,
    });
    
    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the current database pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query with automatic client management
 */
export async function query<T = any>(
  text: string,
  params?: any[],
): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  
  try {
    const start = Date.now();
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration,
      rowCount: result.rowCount,
    });
    
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      query: text.substring(0, 100),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (!pool) {
    logger.warn('No database pool to close');
    return;
  }
  
  try {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  } catch (error) {
    logger.error('Error closing database pool:', error);
    throw error;
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health_check');
    return result.rows[0]?.health_check === 1;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}