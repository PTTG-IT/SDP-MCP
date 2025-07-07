import type { Request, Response, NextFunction } from 'express';
import { TenantManager } from './manager.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger, AuditEventTypes } from '../monitoring/auditLogger.js';
import type { TenantContext } from './models/tenant.js';

/**
 * Extended Express Request with tenant context
 */
export interface TenantRequest extends Request {
  tenant?: TenantContext;
  tenantId?: string;
}

/**
 * Create tenant isolation middleware
 */
export function createTenantMiddleware(tenantManager: TenantManager) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract tenant ID from various sources
      const tenantId = extractTenantId(req);
      
      if (!tenantId) {
        res.status(401).json({
          error: 'Missing tenant identification',
          code: 'TENANT_ID_REQUIRED',
        });
        return;
      }
      
      // Load tenant context
      const tenantContext = await tenantManager.getTenantContext(tenantId);
      
      if (!tenantContext) {
        await auditLogger.logSecurityEvent(
          AuditEventTypes.SECURITY_VIOLATION,
          tenantId,
          'Invalid or inactive tenant',
          { path: req.path, method: req.method }
        );
        
        res.status(403).json({
          error: 'Invalid or inactive tenant',
          code: 'TENANT_INVALID',
        });
        return;
      }
      
      // Attach tenant context to request
      req.tenant = tenantContext;
      req.tenantId = tenantId;
      
      logger.debug('Tenant context loaded', {
        tenantId,
        name: tenantContext.name,
        path: req.path,
      });
      
      next();
    } catch (error) {
      logger.error('Tenant middleware error', { error, path: req.path });
      
      res.status(500).json({
        error: 'Internal server error',
        code: 'TENANT_MIDDLEWARE_ERROR',
      });
    }
  };
}

/**
 * Create scope validation middleware
 */
export function requireScope(requiredScope: string, tenantManager: TenantManager) {
  return async (req: TenantRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenantId) {
      res.status(401).json({
        error: 'Tenant context not found',
        code: 'TENANT_CONTEXT_MISSING',
      });
      return;
    }
    
    try {
      const hasScope = await tenantManager.validateScope(req.tenantId, requiredScope);
      
      if (!hasScope) {
        res.status(403).json({
          error: 'Insufficient permissions',
          code: 'SCOPE_DENIED',
          requiredScope,
        });
        return;
      }
      
      next();
    } catch (error) {
      logger.error('Scope validation error', { error, tenantId: req.tenantId, requiredScope });
      
      res.status(500).json({
        error: 'Internal server error',
        code: 'SCOPE_VALIDATION_ERROR',
      });
    }
  };
}

/**
 * Extract tenant ID from request
 */
function extractTenantId(req: Request): string | null {
  // Priority order:
  // 1. Bearer token (JWT)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const tenantId = extractTenantIdFromToken(token);
    if (tenantId) {
      return tenantId;
    }
  }
  
  // 2. Custom header
  const customHeader = req.headers['x-tenant-id'];
  if (customHeader && typeof customHeader === 'string') {
    return customHeader;
  }
  
  // 3. Query parameter (for SSE connections)
  const queryParam = req.query.tenantId;
  if (queryParam && typeof queryParam === 'string') {
    return queryParam;
  }
  
  // 4. Session (if using sessions)
  const session = (req as any).session;
  if (session?.tenantId) {
    return session.tenantId;
  }
  
  return null;
}

/**
 * Extract tenant ID from JWT token
 */
function extractTenantIdFromToken(token: string): string | null {
  try {
    // In a real implementation, this would verify and decode the JWT
    // For now, we'll use a simple base64 decode of the payload
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64').toString());
    return payload.tenantId || payload.tid || null;
  } catch {
    return null;
  }
}

/**
 * Ensure request isolation between tenants
 */
export function ensureTenantIsolation(paramName: string = 'tenantId') {
  return (req: TenantRequest, res: Response, next: NextFunction): void => {
    const paramTenantId = req.params[paramName];
    const contextTenantId = req.tenantId;
    
    if (!contextTenantId) {
      res.status(401).json({
        error: 'Tenant context not found',
        code: 'TENANT_CONTEXT_MISSING',
      });
      return;
    }
    
    if (paramTenantId && paramTenantId !== contextTenantId) {
      logger.warn('Tenant isolation violation attempt', {
        contextTenantId,
        requestedTenantId: paramTenantId,
        path: req.path,
      });
      
      void auditLogger.logSecurityEvent(
        AuditEventTypes.SECURITY_VIOLATION,
        contextTenantId,
        'Attempted cross-tenant access',
        {
          requestedTenantId: paramTenantId,
          path: req.path,
          method: req.method,
        }
      );
      
      res.status(403).json({
        error: 'Access denied',
        code: 'CROSS_TENANT_ACCESS_DENIED',
      });
      return;
    }
    
    next();
  };
}