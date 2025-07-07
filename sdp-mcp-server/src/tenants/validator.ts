import { z } from 'zod';
import type { DataCenter } from '../database/models/types.js';

/**
 * OAuth scope pattern validation
 */
const OAUTH_SCOPE_PATTERN = /^SDPOnDemand\.[a-zA-Z]+\.(READ|CREATE|UPDATE|DELETE|ALL)$/;

/**
 * Validate OAuth scope format
 */
export function isValidOAuthScope(scope: string): boolean {
  return OAUTH_SCOPE_PATTERN.test(scope);
}

/**
 * Schema for tenant registration
 */
export const tenantRegistrationSchema = z.object({
  name: z.string()
    .min(3, 'Tenant name must be at least 3 characters')
    .max(100, 'Tenant name must not exceed 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tenant name can only contain letters, numbers, hyphens, and underscores'),
  
  dataCenter: z.enum(['US', 'EU', 'IN', 'AU', 'CN', 'JP'] as const),
  
  clientId: z.string()
    .min(20, 'Client ID appears to be invalid')
    .max(200, 'Client ID appears to be invalid'),
  
  clientSecret: z.string()
    .min(20, 'Client secret appears to be invalid')
    .max(200, 'Client secret appears to be invalid'),
  
  refreshToken: z.string()
    .min(20, 'Refresh token appears to be invalid')
    .max(500, 'Refresh token appears to be invalid')
    .optional(),
  
  allowedScopes: z.array(z.string())
    .min(1, 'At least one OAuth scope is required')
    .refine(
      (scopes) => scopes.every(isValidOAuthScope),
      'Invalid OAuth scope format. Expected format: SDPOnDemand.{module}.{permission}'
    ),
  
  sdpInstanceUrl: z.string()
    .url('Invalid SDP instance URL')
    .refine(
      (url) => url.startsWith('https://'),
      'SDP instance URL must use HTTPS'
    ),
  
  rateLimitTier: z.enum(['basic', 'standard', 'premium', 'enterprise'])
    .optional()
    .default('standard'),
  
  metadata: z.record(z.any()).optional().default({}),
});

/**
 * Schema for tenant update
 */
export const tenantUpdateSchema = z.object({
  name: z.string()
    .min(3, 'Tenant name must be at least 3 characters')
    .max(100, 'Tenant name must not exceed 100 characters')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tenant name can only contain letters, numbers, hyphens, and underscores')
    .optional(),
  
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
  
  rateLimitTier: z.enum(['basic', 'standard', 'premium', 'enterprise']).optional(),
  
  metadata: z.record(z.any()).optional(),
});

/**
 * Validate tenant has required capabilities
 */
export interface TenantCapabilities {
  canCreateRequests: boolean;
  canUpdateRequests: boolean;
  canDeleteRequests: boolean;
  canManageProblems: boolean;
  canManageChanges: boolean;
  canManageProjects: boolean;
  canManageAssets: boolean;
  isAdmin: boolean;
}

/**
 * Extract tenant capabilities from OAuth scopes
 */
export function extractCapabilities(scopes: string[]): TenantCapabilities {
  const hasScope = (module: string, permission: string): boolean => {
    return scopes.includes(`SDPOnDemand.${module}.${permission}`) ||
           scopes.includes(`SDPOnDemand.${module}.ALL`) ||
           scopes.includes('SDPOnDemand.admin.ALL');
  };
  
  return {
    canCreateRequests: hasScope('requests', 'CREATE'),
    canUpdateRequests: hasScope('requests', 'UPDATE'),
    canDeleteRequests: hasScope('requests', 'DELETE'),
    canManageProblems: hasScope('problems', 'CREATE') || hasScope('problems', 'UPDATE'),
    canManageChanges: hasScope('changes', 'CREATE') || hasScope('changes', 'UPDATE'),
    canManageProjects: hasScope('projects', 'CREATE') || hasScope('projects', 'UPDATE'),
    canManageAssets: hasScope('assets', 'CREATE') || hasScope('assets', 'UPDATE'),
    isAdmin: scopes.includes('SDPOnDemand.admin.ALL'),
  };
}

/**
 * Common SDP modules and their required scopes
 */
export const SDP_MODULES = {
  requests: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  problems: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  changes: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  projects: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  assets: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  solutions: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  contracts: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  users: ['READ', 'CREATE', 'UPDATE'],
  technicians: ['READ'],
  accounts: ['READ', 'CREATE', 'UPDATE'],
} as const;

/**
 * Build scope string
 */
export function buildScope(module: keyof typeof SDP_MODULES, permission: string): string {
  return `SDPOnDemand.${module}.${permission}`;
}

/**
 * Parse scope string
 */
export function parseScope(scope: string): { module: string; permission: string } | null {
  const match = scope.match(/^SDPOnDemand\.([a-zA-Z]+)\.(READ|CREATE|UPDATE|DELETE|ALL)$/);
  if (!match) {
    return null;
  }
  
  return {
    module: match[1]!,
    permission: match[2]!,
  };
}