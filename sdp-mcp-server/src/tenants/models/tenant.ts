import type { DataCenter, TenantStatus, RateLimitTier } from '../../database/models/types.js';

/**
 * Rate limit configuration for a tenant
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  concurrentRequests: number;
}

/**
 * Rate limit tiers with predefined configurations
 */
export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitConfig> = {
  basic: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 10,
    concurrentRequests: 5,
  },
  standard: {
    requestsPerMinute: 120,
    requestsPerHour: 3000,
    requestsPerDay: 30000,
    burstLimit: 20,
    concurrentRequests: 10,
  },
  premium: {
    requestsPerMinute: 300,
    requestsPerHour: 10000,
    requestsPerDay: 100000,
    burstLimit: 50,
    concurrentRequests: 25,
  },
  enterprise: {
    requestsPerMinute: 600,
    requestsPerHour: 30000,
    requestsPerDay: 500000,
    burstLimit: 100,
    concurrentRequests: 50,
  },
};

/**
 * Tenant context for request processing
 */
export interface TenantContext {
  tenantId: string;
  name: string;
  dataCenter: DataCenter;
  sdpInstanceUrl: string;
  allowedScopes: string[];
  rateLimits: RateLimitConfig;
  metadata: Record<string, any>;
}

/**
 * Decrypted OAuth configuration
 */
export interface DecryptedOAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
}

/**
 * Tenant with full configuration
 */
export interface TenantWithConfig {
  id: string;
  name: string;
  dataCenter: DataCenter;
  status: TenantStatus;
  rateLimitTier: RateLimitTier;
  metadata: Record<string, any>;
  oauthConfig: {
    clientId: string;
    clientSecret: string;
    refreshToken?: string;
    allowedScopes: string[];
    sdpInstanceUrl: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tenant registration request
 */
export interface TenantRegistrationRequest {
  name: string;
  dataCenter: DataCenter;
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  allowedScopes: string[];
  sdpInstanceUrl: string;
  rateLimitTier?: RateLimitTier;
  metadata?: Record<string, any>;
}

/**
 * Get SDP base URL for a data center
 */
export function getSDPBaseUrl(dataCenter: DataCenter): string {
  const dataCenterUrls: Record<DataCenter, string> = {
    US: 'https://sdpondemand.manageengine.com',
    EU: 'https://sdpondemand.manageengine.eu',
    IN: 'https://sdpondemand.manageengine.in',
    AU: 'https://sdpondemand.manageengine.au',
    CN: 'https://sdpondemand.manageengine.cn',
    JP: 'https://sdpondemand.manageengine.jp',
  };
  
  return dataCenterUrls[dataCenter];
}

/**
 * Validate SDP instance URL matches data center
 */
export function validateInstanceUrl(url: string, dataCenter: DataCenter): boolean {
  const expectedBase = getSDPBaseUrl(dataCenter);
  return url.startsWith(expectedBase);
}