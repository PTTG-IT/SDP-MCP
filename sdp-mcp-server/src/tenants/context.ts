import { AsyncLocalStorage } from 'async_hooks';
import type { TenantContext } from './models/tenant.js';
import { logger } from '../monitoring/logging.js';

/**
 * Async local storage for tenant context
 */
const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Run a function with tenant context
 */
export function runWithTenantContext<T>(
  context: TenantContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return tenantContextStorage.run(context, fn);
}

/**
 * Get current tenant context
 */
export function getCurrentTenant(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

/**
 * Get current tenant ID
 */
export function getCurrentTenantId(): string | undefined {
  return getCurrentTenant()?.tenantId;
}

/**
 * Require tenant context (throws if not found)
 */
export function requireTenantContext(): TenantContext {
  const context = getCurrentTenant();
  if (!context) {
    throw new Error('Tenant context not found. Ensure code is running within tenant context.');
  }
  return context;
}

/**
 * Create a tenant-scoped logger
 */
export function createTenantLogger() {
  const tenant = getCurrentTenant();
  if (!tenant) {
    return logger;
  }
  
  return logger.child({
    tenantId: tenant.tenantId,
    tenantName: tenant.name,
    dataCenter: tenant.dataCenter,
  });
}

/**
 * Check if running in tenant context
 */
export function isInTenantContext(): boolean {
  return getCurrentTenant() !== undefined;
}

/**
 * Wrap an async function to preserve tenant context
 */
export function preserveTenantContext<T extends (...args: any[]) => any>(
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const context = getCurrentTenant();
    if (!context) {
      return fn(...args);
    }
    
    return runWithTenantContext(context, () => fn(...args));
  }) as T;
}

/**
 * Create a tenant-aware error
 */
export class TenantError extends Error {
  public readonly tenantId?: string;
  public readonly tenantName?: string;
  
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TenantError';
    
    const tenant = getCurrentTenant();
    if (tenant) {
      this.tenantId = tenant.tenantId;
      this.tenantName = tenant.name;
    }
  }
}

/**
 * Middleware to setup tenant context for async operations
 */
export function tenantContextMiddleware() {
  return (req: any, res: any, next: any): void => {
    if (req.tenant) {
      runWithTenantContext(req.tenant, () => {
        next();
      });
    } else {
      next();
    }
  };
}