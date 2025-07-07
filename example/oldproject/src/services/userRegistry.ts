/**
 * User Registry Service for managing API key to SDP credential mappings
 */

import { Pool } from 'pg';
import { 
  hashApiKey, 
  encryptCredentials, 
  decryptCredentials,
  generateApiKey,
  SDPCredentialsToEncrypt 
} from '../utils/encryption.js';
import { SDPError } from '../utils/errors.js';

export interface UserMapping {
  id: number;
  apiKey: string;
  userName: string;
  userEmail?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  rateLimitOverride?: number;
  metadata: Record<string, any>;
  notes?: string;
}

export interface CreateUserInput {
  userName: string;
  userEmail?: string;
  credentials: SDPCredentialsToEncrypt;
  rateLimitOverride?: number;
  metadata?: Record<string, any>;
  notes?: string;
}

export interface UserCredentials extends SDPCredentialsToEncrypt {
  userId: number;
  userName: string;
  userEmail?: string;
}

export class UserRegistry {
  private pool: Pool;
  private cache: Map<string, { credentials: UserCredentials; timestamp: number }> = new Map();
  private cacheTTL: number = 3600000; // 1 hour

  constructor(pool: Pool) {
    this.pool = pool;
    this.cacheTTL = parseInt(process.env.SDP_USER_CACHE_TTL || '3600') * 1000;
  }

  /**
   * Create a new user mapping
   */
  async createUser(input: CreateUserInput): Promise<{ user: UserMapping; apiKey: string }> {
    const apiKey = generateApiKey('usr');
    const apiKeyHash = hashApiKey(apiKey);
    const encryptedCreds = encryptCredentials(input.credentials);

    const query = `
      INSERT INTO user_mappings (
        api_key, api_key_hash, user_name, user_email, 
        encrypted_credentials, rate_limit_override, metadata, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      apiKey,
      apiKeyHash,
      input.userName,
      input.userEmail || null,
      encryptedCreds,
      input.rateLimitOverride || null,
      JSON.stringify(input.metadata || {}),
      input.notes || null
    ];

    try {
      const result = await this.pool.query(query, values);
      const user = this.mapDbRowToUser(result.rows[0]);
      
      console.log(`✅ Created user mapping for ${input.userName}`);
      
      return { user, apiKey };
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new SDPError('API key already exists', 'DUPLICATE_KEY');
      }
      throw error;
    }
  }

  /**
   * Get user credentials by API key
   */
  async getUserCredentials(apiKey: string): Promise<UserCredentials | null> {
    // Check cache first
    const cached = this.cache.get(apiKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.credentials;
    }

    const apiKeyHash = hashApiKey(apiKey);
    
    const query = `
      UPDATE user_mappings 
      SET last_used_at = CURRENT_TIMESTAMP, 
          usage_count = usage_count + 1
      WHERE api_key_hash = $1 AND is_active = true
      RETURNING id, user_name, user_email, encrypted_credentials
    `;

    try {
      const result = await this.pool.query(query, [apiKeyHash]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const credentials = decryptCredentials(row.encrypted_credentials);
      
      const userCredentials: UserCredentials = {
        ...credentials,
        userId: row.id,
        userName: row.user_name,
        userEmail: row.user_email
      };

      // Cache the credentials
      this.cache.set(apiKey, {
        credentials: userCredentials,
        timestamp: Date.now()
      });

      return userCredentials;
    } catch (error) {
      console.error('Failed to get user credentials:', error);
      throw new SDPError('Failed to retrieve user credentials', 'DATABASE_ERROR');
    }
  }

  /**
   * Update user credentials
   */
  async updateUserCredentials(userId: number, credentials: SDPCredentialsToEncrypt): Promise<void> {
    const encryptedCreds = encryptCredentials(credentials);
    
    const query = `
      UPDATE user_mappings 
      SET encrypted_credentials = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND is_active = true
    `;

    const result = await this.pool.query(query, [encryptedCreds, userId]);
    
    if (result.rowCount === 0) {
      throw new SDPError('User not found', 'NOT_FOUND');
    }

    // Clear cache for this user
    this.clearUserCache(userId);
    
    console.log(`✅ Updated credentials for user ${userId}`);
  }

  /**
   * Deactivate a user
   */
  async deactivateUser(userId: number): Promise<void> {
    const query = `
      UPDATE user_mappings 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [userId]);
    
    if (result.rowCount === 0) {
      throw new SDPError('User not found', 'NOT_FOUND');
    }

    // Clear cache for this user
    this.clearUserCache(userId);
    
    console.log(`✅ Deactivated user ${userId}`);
  }

  /**
   * List all users (without credentials)
   */
  async listUsers(includeInactive: boolean = false): Promise<UserMapping[]> {
    const query = `
      SELECT id, api_key, user_name, user_email, is_active, 
             created_at, updated_at, last_used_at, usage_count,
             rate_limit_override, metadata, notes
      FROM user_mappings
      ${includeInactive ? '' : 'WHERE is_active = true'}
      ORDER BY user_name
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => this.mapDbRowToUser(row));
  }

  /**
   * Get user by ID (without credentials)
   */
  async getUser(userId: number): Promise<UserMapping | null> {
    const query = `
      SELECT id, api_key, user_name, user_email, is_active, 
             created_at, updated_at, last_used_at, usage_count,
             rate_limit_override, metadata, notes
      FROM user_mappings
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDbRowToUser(result.rows[0]);
  }

  /**
   * Track usage for analytics
   */
  async trackUsage(userId: number, ipAddress: string, userAgent: string): Promise<void> {
    const query = `
      INSERT INTO user_mapping_usage (user_mapping_id, ip_address, user_agent)
      VALUES ($1, $2, $3)
    `;

    try {
      await this.pool.query(query, [userId, ipAddress, userAgent]);
    } catch (error) {
      // Don't fail the request if usage tracking fails
      console.error('Failed to track usage:', error);
    }
  }

  /**
   * Clear cache for a specific user
   */
  private clearUserCache(userId: number): void {
    // Clear all entries for this user ID
    for (const [key, value] of this.cache.entries()) {
      if (value.credentials.userId === userId) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Map database row to UserMapping
   */
  private mapDbRowToUser(row: any): UserMapping {
    return {
      id: row.id,
      apiKey: row.api_key,
      userName: row.user_name,
      userEmail: row.user_email,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at,
      usageCount: row.usage_count,
      rateLimitOverride: row.rate_limit_override,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      notes: row.notes
    };
  }

  /**
   * Initialize the database schema
   */
  static async initializeSchema(pool: Pool): Promise<void> {
    const migrationPath = new URL('../db/migrations/001_user_mappings.sql', import.meta.url);
    const fs = await import('fs/promises');
    const sql = await fs.readFile(migrationPath, 'utf-8');
    
    try {
      await pool.query(sql);
      console.log('✅ User mappings schema initialized');
    } catch (error) {
      console.error('Failed to initialize user mappings schema:', error);
      throw error;
    }
  }
}