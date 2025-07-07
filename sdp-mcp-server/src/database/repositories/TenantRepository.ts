import { query, transaction } from '../connection.js';
import type { 
  TenantModel, 
  CreateTenantInput, 
  UpdateTenantInput,
  OAuthConfigModel,
  CreateOAuthConfigInput 
} from '../models/types.js';
import { logger } from '../../monitoring/logging.js';
import type { PoolClient } from 'pg';

export class TenantRepository {
  /**
   * Create a new tenant
   */
  async create(input: CreateTenantInput): Promise<TenantModel> {
    const sql = `
      INSERT INTO tenants (name, data_center, status, rate_limit_tier, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const params = [
      input.name,
      input.dataCenter,
      input.status || 'active',
      input.rateLimitTier || 'standard',
      JSON.stringify(input.metadata || {}),
    ];
    
    try {
      const result = await query<TenantModel>(sql, params);
      logger.info('Tenant created', { tenantId: result.rows[0]?.id, name: input.name });
      return this.mapToModel(result.rows[0]!);
    } catch (error) {
      logger.error('Failed to create tenant', { error, input });
      throw error;
    }
  }
  
  /**
   * Get tenant by ID
   */
  async findById(id: string): Promise<TenantModel | null> {
    const sql = 'SELECT * FROM tenants WHERE id = $1';
    
    try {
      const result = await query<TenantModel>(sql, [id]);
      return result.rows[0] ? this.mapToModel(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find tenant by ID', { error, id });
      throw error;
    }
  }
  
  /**
   * Get tenant by name
   */
  async findByName(name: string): Promise<TenantModel | null> {
    const sql = 'SELECT * FROM tenants WHERE LOWER(name) = LOWER($1)';
    
    try {
      const result = await query<TenantModel>(sql, [name]);
      return result.rows[0] ? this.mapToModel(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find tenant by name', { error, name });
      throw error;
    }
  }
  
  /**
   * Update tenant
   */
  async update(id: string, input: UpdateTenantInput): Promise<TenantModel | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    
    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(input.status);
    }
    
    if (input.rateLimitTier !== undefined) {
      updates.push(`rate_limit_tier = $${paramIndex++}`);
      params.push(input.rateLimitTier);
    }
    
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(input.metadata));
    }
    
    if (updates.length === 0) {
      return this.findById(id);
    }
    
    params.push(id);
    const sql = `
      UPDATE tenants 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    try {
      const result = await query<TenantModel>(sql, params);
      logger.info('Tenant updated', { tenantId: id });
      return result.rows[0] ? this.mapToModel(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update tenant', { error, id, input });
      throw error;
    }
  }
  
  /**
   * List all active tenants
   */
  async listActive(): Promise<TenantModel[]> {
    const sql = `
      SELECT * FROM tenants 
      WHERE status = 'active'
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await query<TenantModel>(sql);
      return result.rows.map(row => this.mapToModel(row));
    } catch (error) {
      logger.error('Failed to list active tenants', { error });
      throw error;
    }
  }
  
  /**
   * Create tenant with OAuth config in a transaction
   */
  async createWithOAuth(
    tenantInput: CreateTenantInput,
    oauthInput: Omit<CreateOAuthConfigInput, 'tenantId'>
  ): Promise<{ tenant: TenantModel; oauthConfig: OAuthConfigModel }> {
    return transaction(async (client: PoolClient) => {
      // Create tenant
      const tenantSql = `
        INSERT INTO tenants (name, data_center, status, rate_limit_tier, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const tenantParams = [
        tenantInput.name,
        tenantInput.dataCenter,
        tenantInput.status || 'active',
        tenantInput.rateLimitTier || 'standard',
        JSON.stringify(tenantInput.metadata || {}),
      ];
      
      const tenantResult = await client.query<TenantModel>(tenantSql, tenantParams);
      const tenant = this.mapToModel(tenantResult.rows[0]!);
      
      // Create OAuth config
      const oauthSql = `
        INSERT INTO oauth_configs (
          tenant_id, client_id_encrypted, client_secret_encrypted, 
          refresh_token_encrypted, allowed_scopes, sdp_instance_url
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const oauthParams = [
        tenant.id,
        oauthInput.clientIdEncrypted,
        oauthInput.clientSecretEncrypted,
        oauthInput.refreshTokenEncrypted || null,
        oauthInput.allowedScopes,
        oauthInput.sdpInstanceUrl,
      ];
      
      const oauthResult = await client.query<OAuthConfigModel>(oauthSql, oauthParams);
      const oauthConfig = this.mapOAuthToModel(oauthResult.rows[0]!);
      
      logger.info('Tenant created with OAuth config', { 
        tenantId: tenant.id, 
        name: tenant.name 
      });
      
      return { tenant, oauthConfig };
    });
  }
  
  /**
   * Delete tenant (cascades to related tables)
   */
  async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM tenants WHERE id = $1';
    
    try {
      const result = await query(sql, [id]);
      const deleted = (result.rowCount ?? 0) > 0;
      
      if (deleted) {
        logger.info('Tenant deleted', { tenantId: id });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Failed to delete tenant', { error, id });
      throw error;
    }
  }
  
  /**
   * Map database row to model
   */
  private mapToModel(row: any): TenantModel {
    return {
      id: row.id,
      name: row.name,
      dataCenter: row.data_center,
      status: row.status,
      rateLimitTier: row.rate_limit_tier,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  
  /**
   * Map OAuth database row to model
   */
  private mapOAuthToModel(row: any): OAuthConfigModel {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      clientIdEncrypted: row.client_id_encrypted,
      clientSecretEncrypted: row.client_secret_encrypted,
      refreshTokenEncrypted: row.refresh_token_encrypted,
      encryptionVersion: row.encryption_version,
      allowedScopes: row.allowed_scopes || [],
      sdpInstanceUrl: row.sdp_instance_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}