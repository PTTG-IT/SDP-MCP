import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Database configuration for PostgreSQL connection
 */
export const dbConfig: PoolConfig = {
  host: process.env.SDP_DB_HOST || 'localhost',
  port: parseInt(process.env.SDP_DB_PORT || '5433'),
  database: process.env.SDP_DB_NAME || 'sdp_mcp',
  user: process.env.SDP_DB_USER || 'sdpmcpservice',
  password: process.env.SDP_DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  ssl: process.env.SDP_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

/**
 * Feature flags for database functionality
 */
export const dbFeatures = {
  useDbTokens: process.env.SDP_USE_DB_TOKENS === 'true',
  useAuditLog: process.env.SDP_USE_AUDIT_LOG === 'true',
  useChangeTracking: process.env.SDP_USE_CHANGE_TRACKING === 'true',
};

/**
 * Database connection pool singleton
 */
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(dbConfig);
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
    
    // Log successful connection
    pool.on('connect', () => {
      console.log('Database pool: New client connected');
    });
  }
  
  return pool;
}

/**
 * Close the database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Execute a query with automatic client management
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return the first row
 */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Alias for getPool for backward compatibility
 */
export function getDbPool(): Pool | null {
  return pool;
}