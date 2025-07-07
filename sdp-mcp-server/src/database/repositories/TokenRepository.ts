import { query } from '../connection.js';
import type { StoredTokenModel, CreateStoredTokenInput } from '../models/types.js';
import { logger } from '../../monitoring/logging.js';

export class TokenRepository {
  /**
   * Store or update token for a tenant
   */
  async upsert(input: CreateStoredTokenInput): Promise<StoredTokenModel> {
    const sql = `
      INSERT INTO stored_tokens (
        tenant_id, access_token_encrypted, refresh_token_encrypted,
        expires_at, scopes, token_type, last_refreshed, refresh_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 0)
      ON CONFLICT (tenant_id) 
      DO UPDATE SET
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
        expires_at = EXCLUDED.expires_at,
        scopes = EXCLUDED.scopes,
        token_type = EXCLUDED.token_type,
        last_refreshed = CURRENT_TIMESTAMP,
        refresh_count = stored_tokens.refresh_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const params = [
      input.tenantId,
      input.accessTokenEncrypted,
      input.refreshTokenEncrypted,
      input.expiresAt,
      input.scopes,
      input.tokenType || 'Bearer',
    ];
    
    try {
      const result = await query<StoredTokenModel>(sql, params);
      logger.info('Token upserted', { 
        tenantId: input.tenantId, 
        expiresAt: input.expiresAt 
      });
      return this.mapToModel(result.rows[0]!);
    } catch (error) {
      logger.error('Failed to upsert token', { error, tenantId: input.tenantId });
      throw error;
    }
  }
  
  /**
   * Get token by tenant ID
   */
  async findByTenantId(tenantId: string): Promise<StoredTokenModel | null> {
    const sql = 'SELECT * FROM stored_tokens WHERE tenant_id = $1';
    
    try {
      const result = await query<StoredTokenModel>(sql, [tenantId]);
      return result.rows[0] ? this.mapToModel(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find token by tenant ID', { error, tenantId });
      throw error;
    }
  }
  
  /**
   * Get valid (non-expired) token by tenant ID
   */
  async findValidByTenantId(tenantId: string): Promise<StoredTokenModel | null> {
    const sql = `
      SELECT * FROM stored_tokens 
      WHERE tenant_id = $1 
      AND expires_at > CURRENT_TIMESTAMP
    `;
    
    try {
      const result = await query<StoredTokenModel>(sql, [tenantId]);
      return result.rows[0] ? this.mapToModel(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find valid token by tenant ID', { error, tenantId });
      throw error;
    }
  }
  
  /**
   * Get tokens expiring soon (within specified seconds)
   */
  async findExpiringTokens(withinSeconds: number = 300): Promise<StoredTokenModel[]> {
    const sql = `
      SELECT st.*, t.status as tenant_status
      FROM stored_tokens st
      JOIN tenants t ON st.tenant_id = t.id
      WHERE t.status = 'active'
      AND st.expires_at > CURRENT_TIMESTAMP
      AND st.expires_at <= CURRENT_TIMESTAMP + INTERVAL '${withinSeconds} seconds'
      ORDER BY st.expires_at ASC
    `;
    
    try {
      const result = await query<StoredTokenModel>(sql);
      return result.rows.map(row => this.mapToModel(row));
    } catch (error) {
      logger.error('Failed to find expiring tokens', { error, withinSeconds });
      throw error;
    }
  }
  
  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    const sql = `
      DELETE FROM stored_tokens 
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
    `;
    
    try {
      const result = await query(sql);
      const deletedCount = result.rowCount ?? 0;
      
      if (deletedCount > 0) {
        logger.info('Expired tokens deleted', { count: deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete expired tokens', { error });
      throw error;
    }
  }
  
  /**
   * Get token statistics
   */
  async getStatistics(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    avgRefreshCount: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE expires_at > CURRENT_TIMESTAMP) as active_tokens,
        COUNT(*) FILTER (WHERE expires_at <= CURRENT_TIMESTAMP) as expired_tokens,
        AVG(refresh_count)::numeric(10,2) as avg_refresh_count
      FROM stored_tokens
    `;
    
    try {
      const result = await query(sql);
      const stats = result.rows[0];
      
      return {
        totalTokens: parseInt(stats?.total_tokens || '0'),
        activeTokens: parseInt(stats?.active_tokens || '0'),
        expiredTokens: parseInt(stats?.expired_tokens || '0'),
        avgRefreshCount: parseFloat(stats?.avg_refresh_count || '0'),
      };
    } catch (error) {
      logger.error('Failed to get token statistics', { error });
      throw error;
    }
  }
  
  /**
   * Delete token by tenant ID
   */
  async deleteByTenantId(tenantId: string): Promise<boolean> {
    const sql = 'DELETE FROM stored_tokens WHERE tenant_id = $1';
    
    try {
      const result = await query(sql, [tenantId]);
      const deleted = (result.rowCount ?? 0) > 0;
      
      if (deleted) {
        logger.info('Token deleted for tenant', { tenantId });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Failed to delete token', { error, tenantId });
      throw error;
    }
  }
  
  /**
   * Map database row to model
   */
  private mapToModel(row: any): StoredTokenModel {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      accessTokenEncrypted: row.access_token_encrypted,
      refreshTokenEncrypted: row.refresh_token_encrypted,
      expiresAt: row.expires_at,
      scopes: row.scopes || [],
      tokenType: row.token_type,
      lastRefreshed: row.last_refreshed,
      refreshCount: row.refresh_count,
      encryptionVersion: row.encryption_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}