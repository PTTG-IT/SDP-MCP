import type { Response, NextFunction } from 'express';
import { logger } from '../../monitoring/logging.js';
import { SDPPermissionError } from '../../utils/errors.js';
import type { MCPRequest } from '../types.js';

/**
 * OAuth scope definitions
 */
export const OAUTH_SCOPES = {
  // Request scopes
  REQUESTS_READ: 'SDPOnDemand.requests.READ',
  REQUESTS_CREATE: 'SDPOnDemand.requests.CREATE',
  REQUESTS_UPDATE: 'SDPOnDemand.requests.UPDATE',
  REQUESTS_DELETE: 'SDPOnDemand.requests.DELETE',
  
  // Problem scopes
  PROBLEMS_READ: 'SDPOnDemand.problems.READ',
  PROBLEMS_CREATE: 'SDPOnDemand.problems.CREATE',
  PROBLEMS_UPDATE: 'SDPOnDemand.problems.UPDATE',
  PROBLEMS_DELETE: 'SDPOnDemand.problems.DELETE',
  
  // Change scopes
  CHANGES_READ: 'SDPOnDemand.changes.READ',
  CHANGES_CREATE: 'SDPOnDemand.changes.CREATE',
  CHANGES_UPDATE: 'SDPOnDemand.changes.UPDATE',
  CHANGES_DELETE: 'SDPOnDemand.changes.DELETE',
  
  // Project scopes
  PROJECTS_READ: 'SDPOnDemand.projects.READ',
  PROJECTS_CREATE: 'SDPOnDemand.projects.CREATE',
  PROJECTS_UPDATE: 'SDPOnDemand.projects.UPDATE',
  PROJECTS_DELETE: 'SDPOnDemand.projects.DELETE',
  
  // Asset scopes
  ASSETS_READ: 'SDPOnDemand.assets.READ',
  ASSETS_CREATE: 'SDPOnDemand.assets.CREATE',
  ASSETS_UPDATE: 'SDPOnDemand.assets.UPDATE',
  ASSETS_DELETE: 'SDPOnDemand.assets.DELETE',
  
  // Admin scopes
  ADMIN_ALL: 'SDPOnDemand.admin.ALL',
} as const;

/**
 * Validate scopes middleware
 * Ensures the client has necessary OAuth scopes
 */
export function validateScopes(requiredScopes?: string[]) {
  return (req: MCPRequest, res: Response, next: NextFunction): void => {
    try {
      // Skip if no scopes required
      if (!requiredScopes || requiredScopes.length === 0) {
        next();
        return;
      }

      // Check if context exists
      if (!req.context) {
        throw new SDPPermissionError(
          'No authentication context',
          undefined,
          []
        );
      }

      const clientScopes = req.context.scopes || [];

      // Check for admin scope (bypasses all checks)
      if (clientScopes.includes(OAUTH_SCOPES.ADMIN_ALL)) {
        logger.debug('Admin scope detected, bypassing scope check');
        next();
        return;
      }

      // Check if client has all required scopes
      const missingScopes = requiredScopes.filter(
        scope => !clientScopes.includes(scope)
      );

      if (missingScopes.length > 0) {
        throw new SDPPermissionError(
          `Missing required scopes: ${missingScopes.join(', ')}`,
          missingScopes[0],
          clientScopes,
          {
            requiredScopes,
            missingScopes,
          }
        );
      }

      logger.debug('Scope validation passed', {
        requiredScopes,
        clientScopes,
      });

      next();
    } catch (error) {
      if (error instanceof SDPPermissionError) {
        logger.warn('Scope validation failed', {
          tenantId: req.context?.tenantId,
          clientId: req.context?.clientId,
          requiredScopes,
          error: error.message,
        });

        res.status(403).json({
          error: 'INSUFFICIENT_SCOPE',
          message: error.message,
          requiredScopes,
          availableScopes: error.availableScopes,
        });
      } else {
        logger.error('Unexpected error in scope validation', { error });
        res.status(500).json({
          error: 'INTERNAL_ERROR',
          message: 'Failed to validate scopes',
        });
      }
    }
  };
}

/**
 * Require any of the specified scopes
 */
export function requireAnyScope(...scopes: string[]) {
  return (req: MCPRequest, res: Response, next: NextFunction): void => {
    if (!req.context) {
      res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
      return;
    }

    const clientScopes = req.context.scopes || [];

    // Check for admin scope
    if (clientScopes.includes(OAUTH_SCOPES.ADMIN_ALL)) {
      next();
      return;
    }

    // Check if client has any of the required scopes
    const hasScope = scopes.some(scope => clientScopes.includes(scope));

    if (!hasScope) {
      logger.warn('Missing any required scope', {
        tenantId: req.context.tenantId,
        requiredScopes: scopes,
        clientScopes,
      });

      res.status(403).json({
        error: 'INSUFFICIENT_SCOPE',
        message: `Requires one of: ${scopes.join(', ')}`,
        requiredScopes: scopes,
        availableScopes: clientScopes,
      });
      return;
    }

    next();
  };
}

/**
 * Extract scope from tool name
 * Maps MCP tool names to required OAuth scopes
 */
export function getScopesForTool(toolName: string): string[] {
  const scopeMap: Record<string, string[]> = {
    // Request tools
    'create_request': [OAUTH_SCOPES.REQUESTS_CREATE],
    'get_request': [OAUTH_SCOPES.REQUESTS_READ],
    'update_request': [OAUTH_SCOPES.REQUESTS_UPDATE],
    'delete_request': [OAUTH_SCOPES.REQUESTS_DELETE],
    'list_requests': [OAUTH_SCOPES.REQUESTS_READ],
    'close_request': [OAUTH_SCOPES.REQUESTS_UPDATE],
    'pickup_request': [OAUTH_SCOPES.REQUESTS_UPDATE],
    
    // Problem tools
    'create_problem': [OAUTH_SCOPES.PROBLEMS_CREATE],
    'get_problem': [OAUTH_SCOPES.PROBLEMS_READ],
    'update_problem': [OAUTH_SCOPES.PROBLEMS_UPDATE],
    'delete_problem': [OAUTH_SCOPES.PROBLEMS_DELETE],
    'list_problems': [OAUTH_SCOPES.PROBLEMS_READ],
    'analyze_problem': [OAUTH_SCOPES.PROBLEMS_UPDATE],
    'resolve_problem': [OAUTH_SCOPES.PROBLEMS_UPDATE],
    
    // Change tools
    'create_change': [OAUTH_SCOPES.CHANGES_CREATE],
    'get_change': [OAUTH_SCOPES.CHANGES_READ],
    'update_change': [OAUTH_SCOPES.CHANGES_UPDATE],
    'delete_change': [OAUTH_SCOPES.CHANGES_DELETE],
    'list_changes': [OAUTH_SCOPES.CHANGES_READ],
    'approve_change': [OAUTH_SCOPES.CHANGES_UPDATE],
    'implement_change': [OAUTH_SCOPES.CHANGES_UPDATE],
    
    // Project tools
    'create_project': [OAUTH_SCOPES.PROJECTS_CREATE],
    'get_project': [OAUTH_SCOPES.PROJECTS_READ],
    'update_project': [OAUTH_SCOPES.PROJECTS_UPDATE],
    'delete_project': [OAUTH_SCOPES.PROJECTS_DELETE],
    'list_projects': [OAUTH_SCOPES.PROJECTS_READ],
    'create_milestone': [OAUTH_SCOPES.PROJECTS_UPDATE],
    'create_task': [OAUTH_SCOPES.PROJECTS_UPDATE],
    
    // Asset tools
    'create_asset': [OAUTH_SCOPES.ASSETS_CREATE],
    'get_asset': [OAUTH_SCOPES.ASSETS_READ],
    'update_asset': [OAUTH_SCOPES.ASSETS_UPDATE],
    'delete_asset': [OAUTH_SCOPES.ASSETS_DELETE],
    'list_assets': [OAUTH_SCOPES.ASSETS_READ],
    'assign_asset': [OAUTH_SCOPES.ASSETS_UPDATE],
    'scan_assets': [OAUTH_SCOPES.ASSETS_CREATE],
  };

  return scopeMap[toolName] || [];
}

/**
 * Check if a scope grants access to an operation
 */
export function scopeGrantsAccess(scope: string, operation: string): boolean {
  // Admin scope grants all access
  if (scope === OAUTH_SCOPES.ADMIN_ALL) {
    return true;
  }

  // Extract module and permission from scope
  const scopeParts = scope.split('.');
  if (scopeParts.length !== 3) {
    return false;
  }

  const [, module, permission] = scopeParts;

  // Check if operation matches
  return operation.toLowerCase().includes(module.toLowerCase()) &&
         operation.toLowerCase().includes(permission.toLowerCase());
}