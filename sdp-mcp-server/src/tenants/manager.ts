import { TenantRepository } from '../database/repositories/TenantRepository.js';
import { EncryptionService } from '../auth/encryption.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger, AuditEventTypes } from '../monitoring/auditLogger.js';
import { getRedisClient, RedisKeys } from '../utils/redis.js';
import type { 
  TenantWithConfig, 
  TenantRegistrationRequest, 
  TenantContext,
  DecryptedOAuthConfig 
} from './models/tenant.js';
import { RATE_LIMIT_TIERS, validateInstanceUrl } from './models/tenant.js';
import type { TenantModel, OAuthConfigModel } from '../database/models/types.js';

/**
 * Tenant manager for multi-tenant operations
 */
export class TenantManager {
  private readonly repository: TenantRepository;
  private readonly encryption: EncryptionService;
  private readonly cacheTtlSeconds: number;
  
  constructor(encryptionKey: string, cacheTtlSeconds: number = 300) {
    this.repository = new TenantRepository();
    this.encryption = new EncryptionService(encryptionKey);
    this.cacheTtlSeconds = cacheTtlSeconds;
  }
  
  /**
   * Register a new tenant
   */
  async registerTenant(request: TenantRegistrationRequest): Promise<TenantWithConfig> {
    try {
      // Validate instance URL matches data center
      if (!validateInstanceUrl(request.sdpInstanceUrl, request.dataCenter)) {
        throw new Error(`Instance URL does not match data center ${request.dataCenter}`);
      }
      
      // Check if tenant name already exists
      const existing = await this.repository.findByName(request.name);
      if (existing) {
        throw new Error(`Tenant with name '${request.name}' already exists`);
      }
      
      // Encrypt OAuth credentials
      const encryptedClientId = this.encryption.encryptString(request.clientId, request.name);
      const encryptedClientSecret = this.encryption.encryptString(request.clientSecret, request.name);
      const encryptedRefreshToken = request.refreshToken 
        ? this.encryption.encryptString(request.refreshToken, request.name)
        : undefined;
      
      // Create tenant with OAuth config
      const { tenant, oauthConfig } = await this.repository.createWithOAuth(
        {
          name: request.name,
          dataCenter: request.dataCenter,
          rateLimitTier: request.rateLimitTier || 'standard',
          metadata: request.metadata || {},
        },
        {
          clientIdEncrypted: encryptedClientId,
          clientSecretEncrypted: encryptedClientSecret,
          refreshTokenEncrypted: encryptedRefreshToken,
          allowedScopes: request.allowedScopes,
          sdpInstanceUrl: request.sdpInstanceUrl,
        }
      );
      
      // Log successful registration
      await auditLogger.logAdminAction(
        'create',
        'tenant',
        tenant.id,
        'system',
        'success',
        { tenantName: tenant.name, dataCenter: tenant.dataCenter }
      );
      
      logger.info('Tenant registered successfully', {
        tenantId: tenant.id,
        name: tenant.name,
        dataCenter: tenant.dataCenter,
      });
      
      // Return tenant with decrypted config (for immediate use)
      return this.buildTenantWithConfig(tenant, oauthConfig, {
        clientId: request.clientId,
        clientSecret: request.clientSecret,
        refreshToken: request.refreshToken,
      });
      
    } catch (error) {
      logger.error('Failed to register tenant', { error, request });
      
      await auditLogger.logAdminAction(
        'create',
        'tenant',
        'unknown',
        'system',
        'failure',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      throw error;
    }
  }
  
  /**
   * Get tenant by ID with caching
   */
  async getTenant(tenantId: string): Promise<TenantWithConfig | null> {
    const redis = getRedisClient();
    const cacheKey = RedisKeys.tenant(tenantId);
    
    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('Tenant found in cache', { tenantId });
      return JSON.parse(cached) as TenantWithConfig;
    }
    
    // Load from database
    const tenant = await this.repository.findById(tenantId);
    if (!tenant) {
      return null;
    }
    
    // Load OAuth config
    const oauthConfig = await this.loadOAuthConfig(tenantId);
    if (!oauthConfig) {
      logger.error('OAuth config not found for tenant', { tenantId });
      return null;
    }
    
    // Decrypt OAuth credentials
    const decrypted = this.decryptOAuthConfig(oauthConfig, tenant.name);
    
    // Build full tenant object
    const tenantWithConfig = this.buildTenantWithConfig(tenant, oauthConfig, decrypted);
    
    // Cache the result
    await redis.setex(cacheKey, this.cacheTtlSeconds, JSON.stringify(tenantWithConfig));
    
    return tenantWithConfig;
  }
  
  /**
   * Get tenant context for request processing
   */
  async getTenantContext(tenantId: string): Promise<TenantContext | null> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant || tenant.status !== 'active') {
      return null;
    }
    
    return {
      tenantId: tenant.id,
      name: tenant.name,
      dataCenter: tenant.dataCenter,
      sdpInstanceUrl: tenant.oauthConfig.sdpInstanceUrl,
      allowedScopes: tenant.oauthConfig.allowedScopes,
      rateLimits: RATE_LIMIT_TIERS[tenant.rateLimitTier],
      metadata: tenant.metadata,
    };
  }
  
  /**
   * Update tenant status
   */
  async updateTenantStatus(
    tenantId: string, 
    status: 'active' | 'suspended' | 'inactive',
    reason?: string
  ): Promise<void> {
    const updated = await this.repository.update(tenantId, { status });
    
    if (updated) {
      // Invalidate cache
      await this.invalidateTenantCache(tenantId);
      
      // Log the action
      await auditLogger.logAdminAction(
        'update',
        'tenant',
        tenantId,
        'system',
        'success',
        { status, reason }
      );
      
      logger.info('Tenant status updated', { tenantId, status, reason });
    }
  }
  
  /**
   * List all active tenants
   */
  async listActiveTenants(): Promise<TenantModel[]> {
    return this.repository.listActive();
  }
  
  /**
   * Validate tenant has required scope
   */
  async validateScope(tenantId: string, requiredScope: string): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return false;
    }
    
    // Check if tenant has the required scope
    const hasScope = tenant.oauthConfig.allowedScopes.includes(requiredScope) ||
                    tenant.oauthConfig.allowedScopes.includes('SDPOnDemand.admin.ALL');
    
    if (!hasScope) {
      await auditLogger.logSecurityEvent(
        AuditEventTypes.SECURITY_SCOPE_DENIED,
        tenantId,
        `Scope '${requiredScope}' denied for tenant`,
        { requiredScope, allowedScopes: tenant.oauthConfig.allowedScopes }
      );
    }
    
    return hasScope;
  }
  
  /**
   * Invalidate tenant cache
   */
  async invalidateTenantCache(tenantId: string): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = RedisKeys.tenant(tenantId);
    await redis.del(cacheKey);
    logger.debug('Tenant cache invalidated', { tenantId });
  }
  
  /**
   * Load OAuth config from database
   */
  private async loadOAuthConfig(tenantId: string): Promise<OAuthConfigModel | null> {
    // This would be implemented in a separate OAuthRepository
    // For now, using a simplified query
    const { query } = await import('../database/connection.js');
    const result = await query<OAuthConfigModel>(
      'SELECT * FROM oauth_configs WHERE tenant_id = $1',
      [tenantId]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Decrypt OAuth configuration
   */
  private decryptOAuthConfig(
    config: OAuthConfigModel, 
    tenantName: string
  ): DecryptedOAuthConfig {
    return {
      clientId: this.encryption.decryptString(config.clientIdEncrypted, tenantName),
      clientSecret: this.encryption.decryptString(config.clientSecretEncrypted, tenantName),
      refreshToken: config.refreshTokenEncrypted 
        ? this.encryption.decryptString(config.refreshTokenEncrypted, tenantName)
        : undefined,
    };
  }
  
  /**
   * Build tenant with config object
   */
  private buildTenantWithConfig(
    tenant: TenantModel,
    oauthConfig: OAuthConfigModel,
    decrypted: DecryptedOAuthConfig
  ): TenantWithConfig {
    return {
      id: tenant.id,
      name: tenant.name,
      dataCenter: tenant.dataCenter,
      status: tenant.status,
      rateLimitTier: tenant.rateLimitTier,
      metadata: tenant.metadata,
      oauthConfig: {
        clientId: decrypted.clientId,
        clientSecret: decrypted.clientSecret,
        refreshToken: decrypted.refreshToken,
        allowedScopes: oauthConfig.allowedScopes,
        sdpInstanceUrl: oauthConfig.sdpInstanceUrl,
      },
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}