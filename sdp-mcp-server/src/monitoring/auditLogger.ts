import { query } from '../database/connection.js';
import type { CreateAuditLogInput, AuditLogModel } from '../database/models/types.js';
import { logger } from './logging.js';

/**
 * Audit event types
 */
export const AuditEventTypes = {
  // Authentication events
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_TOKEN_REFRESH: 'auth.token.refresh',
  AUTH_TOKEN_EXPIRED: 'auth.token.expired',
  AUTH_FAILED: 'auth.failed',
  
  // API events
  API_REQUEST: 'api.request',
  API_RESPONSE: 'api.response',
  API_ERROR: 'api.error',
  API_RATE_LIMITED: 'api.rate_limited',
  
  // Admin events
  ADMIN_TENANT_CREATE: 'admin.tenant.create',
  ADMIN_TENANT_UPDATE: 'admin.tenant.update',
  ADMIN_TENANT_DELETE: 'admin.tenant.delete',
  ADMIN_CONFIG_UPDATE: 'admin.config.update',
  
  // Security events
  SECURITY_VIOLATION: 'security.violation',
  SECURITY_SCOPE_DENIED: 'security.scope.denied',
  SECURITY_ENCRYPTION_ERROR: 'security.encryption.error',
  
  // System events
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_ERROR: 'system.error',
  SYSTEM_HEALTH_CHECK: 'system.health_check',
} as const;

export type AuditEventType = typeof AuditEventTypes[keyof typeof AuditEventTypes];

/**
 * Audit logger service
 */
export class AuditLogger {
  private queue: CreateAuditLogInput[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 100;
  private readonly flushIntervalMs = 5000;

  constructor() {
    this.startBatchProcessor();
  }

  /**
   * Log an audit event
   */
  async log(input: CreateAuditLogInput): Promise<void> {
    // Add to queue for batch processing
    this.queue.push(input);
    
    // Flush immediately if queue is full
    if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
    }
    
    // Also log to standard logger for immediate visibility
    logger.info('Audit event', {
      eventType: input.eventType,
      category: input.eventCategory,
      result: input.result,
      tenantId: input.tenantId,
    });
  }

  /**
   * Log a successful authentication
   */
  async logAuth(
    tenantId: string,
    actorId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      eventType: AuditEventTypes.AUTH_LOGIN,
      eventCategory: 'auth',
      actorType: 'tenant',
      actorId,
      action: 'login',
      result: 'success',
      metadata,
    });
  }

  /**
   * Log an API request
   */
  async logApiRequest(
    tenantId: string,
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      eventType: AuditEventTypes.API_REQUEST,
      eventCategory: 'api',
      actorType: 'tenant',
      resourceType: 'api_endpoint',
      resourceId: `${method} ${path}`,
      action: method.toLowerCase(),
      result: statusCode < 400 ? 'success' : 'failure',
      durationMs,
      metadata: {
        ...metadata,
        statusCode,
        method,
        path,
      },
    });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    tenantId: string | undefined,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      eventType,
      eventCategory: 'security',
      actorType: tenantId ? 'tenant' : 'system',
      action: 'security_check',
      result: 'failure',
      errorMessage: description,
      metadata,
    });
  }

  /**
   * Log an admin action
   */
  async logAdminAction(
    action: string,
    resourceType: string,
    resourceId: string,
    adminId: string,
    result: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      eventType: `admin.${resourceType}.${action}`,
      eventCategory: 'admin',
      actorType: 'admin',
      actorId: adminId,
      resourceType,
      resourceId,
      action,
      result,
      metadata,
    });
  }

  /**
   * Query audit logs
   */
  async query(filters: {
    tenantId?: string;
    eventType?: string;
    eventCategory?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLogModel[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(filters.tenantId);
    }

    if (filters.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(filters.eventType);
    }

    if (filters.eventCategory) {
      conditions.push(`event_category = $${paramIndex++}`);
      params.push(filters.eventCategory);
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const sql = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    try {
      const result = await query<AuditLogModel>(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to query audit logs', { error, filters });
      throw error;
    }
  }

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Flush queued audit logs to database
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.maxBatchSize);
    
    try {
      await this.insertBatch(batch);
    } catch (error) {
      logger.error('Failed to flush audit logs', { error, batchSize: batch.length });
      // Re-queue failed items
      this.queue.unshift(...batch);
    }
  }

  /**
   * Insert a batch of audit logs
   */
  private async insertBatch(batch: CreateAuditLogInput[]): Promise<void> {
    if (batch.length === 0) {
      return;
    }

    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const log of batch) {
      const valueParams: string[] = [];
      
      // Add all fields in order
      params.push(
        log.tenantId || null,
        log.eventType,
        log.eventCategory,
        log.actorType,
        log.actorId || null,
        log.resourceType || null,
        log.resourceId || null,
        log.action,
        log.result,
        log.errorCode || null,
        log.errorMessage || null,
        JSON.stringify(log.metadata || {}),
        log.ipAddress || null,
        log.userAgent || null,
        log.durationMs || null
      );
      
      // Build parameter placeholders
      for (let i = 0; i < 15; i++) {
        valueParams.push(`$${paramIndex++}`);
      }
      
      values.push(`(${valueParams.join(', ')})`);
    }

    const sql = `
      INSERT INTO audit_logs (
        tenant_id, event_type, event_category, actor_type, actor_id,
        resource_type, resource_id, action, result, error_code,
        error_message, metadata, ip_address, user_agent, duration_ms
      )
      VALUES ${values.join(', ')}
    `;

    await query(sql, params);
  }

  /**
   * Stop the audit logger
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush any remaining logs
    void this.flush();
  }
}

// Create singleton instance
export const auditLogger = new AuditLogger();