import type { Response, NextFunction } from 'express';
import { TenantManager } from '../../tenants/manager.js';
import { logger } from '../../monitoring/logging.js';
import { auditLogger } from '../../monitoring/auditLogger.js';
import { SDPError } from '../../utils/errors.js';
import type { MCPRequest, MCPContext } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Authenticate client middleware
 * Validates client certificate and establishes tenant context
 */
export function authenticateClient(tenantManager: TenantManager) {
  return async (req: MCPRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // Extract client certificate from headers
      const clientCert = req.headers['x-client-certificate'] as string;
      const clientId = req.headers['x-client-id'] as string;
      
      if (!clientCert || !clientId) {
        throw new SDPError(
          'Missing client certificate or ID',
          'AUTH_MISSING_CREDENTIALS',
          401
        );
      }

      // Validate client certificate and get tenant
      const validationResult = await validateClientCertificate(
        clientCert,
        clientId,
        tenantManager
      );

      if (!validationResult.isValid) {
        throw new SDPError(
          'Invalid client certificate',
          'AUTH_INVALID_CERTIFICATE',
          401,
          { reason: validationResult.reason }
        );
      }

      const { tenant } = validationResult;

      // Check tenant status
      if (tenant.status !== 'active') {
        throw new SDPError(
          'Tenant is not active',
          'AUTH_TENANT_INACTIVE',
          403,
          { tenantStatus: tenant.status }
        );
      }

      // Create MCP context
      const context: MCPContext = {
        tenantId: tenant.id,
        clientId,
        sessionId: uuidv4(),
        scopes: tenant.allowedScopes || [],
        connectedAt: new Date(),
        lastActivity: new Date(),
      };

      // Attach context to request
      req.context = context;
      req.tenantId = tenant.id;

      // Log successful authentication
      const duration = Date.now() - startTime;
      await auditLogger.log({
        tenantId: tenant.id,
        eventType: 'auth.success',
        eventCategory: 'authentication',
        actorType: 'client',
        actorId: clientId,
        action: 'authenticate',
        result: 'success',
        metadata: {
          duration,
          sessionId: context.sessionId,
          scopes: context.scopes.length,
        },
      });

      logger.info('Client authenticated successfully', {
        tenantId: tenant.id,
        clientId,
        sessionId: context.sessionId,
      });

      next();
    } catch (error) {
      const duration = Date.now() - startTime;
      const sdpError = error instanceof SDPError ? error : new SDPError(
        'Authentication failed',
        'AUTH_FAILED',
        401
      );

      // Log authentication failure
      await auditLogger.log({
        tenantId: req.tenantId || 'unknown',
        eventType: 'auth.failure',
        eventCategory: 'authentication',
        actorType: 'client',
        actorId: clientId || 'unknown',
        action: 'authenticate',
        result: 'error',
        errorCode: sdpError.code,
        errorMessage: sdpError.message,
        metadata: {
          duration,
          details: sdpError.details,
        },
      }).catch(logError => {
        logger.error('Failed to log auth failure', { error: logError });
      });

      logger.error('Authentication failed', {
        error: sdpError,
        clientId,
      });

      res.status(sdpError.statusCode).json({
        error: sdpError.code,
        message: sdpError.message,
        details: sdpError.details,
      });
    }
  };
}

/**
 * Validate client certificate
 */
async function validateClientCertificate(
  clientCert: string,
  clientId: string,
  tenantManager: TenantManager
): Promise<{
  isValid: boolean;
  tenant?: any;
  reason?: string;
}> {
  try {
    // Decode certificate (base64)
    const certData = Buffer.from(clientCert, 'base64').toString('utf-8');
    
    // Parse certificate data (simplified - in production use proper X.509 parsing)
    const cert = JSON.parse(certData);
    
    // Validate certificate structure
    if (!cert.tenantId || !cert.clientId || !cert.signature) {
      return {
        isValid: false,
        reason: 'Invalid certificate structure',
      };
    }

    // Validate client ID matches
    if (cert.clientId !== clientId) {
      return {
        isValid: false,
        reason: 'Client ID mismatch',
      };
    }

    // Get tenant
    const tenant = await tenantManager.getTenant(cert.tenantId);
    if (!tenant) {
      return {
        isValid: false,
        reason: 'Tenant not found',
      };
    }

    // Validate certificate signature
    // In production, implement proper signature validation
    // For now, just check if signature exists
    if (!cert.signature) {
      return {
        isValid: false,
        reason: 'Invalid signature',
      };
    }

    // Check certificate expiry
    if (cert.expiresAt && new Date(cert.expiresAt) < new Date()) {
      return {
        isValid: false,
        reason: 'Certificate expired',
      };
    }

    return {
      isValid: true,
      tenant,
    };
  } catch (error) {
    logger.error('Certificate validation error', { error });
    return {
      isValid: false,
      reason: 'Certificate validation failed',
    };
  }
}

/**
 * Optional authentication middleware
 * Allows unauthenticated requests but adds context if authenticated
 */
export function optionalAuth(tenantManager: TenantManager) {
  return async (req: MCPRequest, res: Response, next: NextFunction): Promise<void> => {
    const clientCert = req.headers['x-client-certificate'] as string;
    const clientId = req.headers['x-client-id'] as string;

    if (clientCert && clientId) {
      // Try to authenticate
      const authMiddleware = authenticateClient(tenantManager);
      authMiddleware(req, res, () => {
        // Continue regardless of auth result
        next();
      });
    } else {
      // No credentials provided, continue without auth
      next();
    }
  };
}

/**
 * Require specific tenant middleware
 */
export function requireTenant(tenantId: string) {
  return (req: MCPRequest, res: Response, next: NextFunction): void => {
    if (!req.context || req.context.tenantId !== tenantId) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this tenant',
      });
      return;
    }
    next();
  };
}