/**
 * Database model type definitions
 */

export type DataCenter = 'US' | 'EU' | 'IN' | 'AU' | 'CN' | 'JP';
export type TenantStatus = 'active' | 'suspended' | 'inactive';
export type RateLimitTier = 'basic' | 'standard' | 'premium' | 'enterprise';
export type EventCategory = 'auth' | 'api' | 'admin' | 'security' | 'system';
export type ActorType = 'system' | 'tenant' | 'admin' | 'mcp_client';
export type EventResult = 'success' | 'failure' | 'error';
export type TransportType = 'sse' | 'websocket' | 'stdio';

export interface TenantModel {
  id: string;
  name: string;
  dataCenter: DataCenter;
  status: TenantStatus;
  rateLimitTier: RateLimitTier;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthConfigModel {
  id: string;
  tenantId: string;
  clientIdEncrypted: string;
  clientSecretEncrypted: string;
  refreshTokenEncrypted: string | null;
  encryptionVersion: number;
  allowedScopes: string[];
  sdpInstanceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredTokenModel {
  id: string;
  tenantId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  expiresAt: Date;
  scopes: string[];
  tokenType: string;
  lastRefreshed: Date;
  refreshCount: number;
  encryptionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogModel {
  id: string;
  tenantId: string | null;
  eventType: string;
  eventCategory: EventCategory;
  actorType: ActorType;
  actorId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  action: string;
  result: EventResult;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, any>;
  ipAddress: string | null;
  userAgent: string | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface RateLimitModel {
  id: string;
  tenantId: string;
  endpoint: string;
  windowStart: Date;
  windowDurationSeconds: number;
  requestCount: number;
  limitExceededCount: number;
  lastRequestAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPSessionModel {
  id: string;
  tenantId: string;
  sessionToken: string;
  clientInfo: Record<string, any>;
  transportType: TransportType;
  connectedAt: Date;
  lastActivityAt: Date;
  disconnectedAt: Date | null;
  isActive: boolean;
  totalRequests: number;
  totalErrors: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolUsageStatsModel {
  id: string;
  tenantId: string;
  toolName: string;
  operation: string;
  successCount: number;
  failureCount: number;
  totalDurationMs: bigint;
  avgDurationMs: number;
  lastUsedAt: Date | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Input types for creating/updating records
export interface CreateTenantInput {
  name: string;
  dataCenter: DataCenter;
  status?: TenantStatus;
  rateLimitTier?: RateLimitTier;
  metadata?: Record<string, any>;
}

export interface UpdateTenantInput {
  name?: string;
  status?: TenantStatus;
  rateLimitTier?: RateLimitTier;
  metadata?: Record<string, any>;
}

export interface CreateOAuthConfigInput {
  tenantId: string;
  clientIdEncrypted: string;
  clientSecretEncrypted: string;
  refreshTokenEncrypted?: string;
  allowedScopes: string[];
  sdpInstanceUrl: string;
}

export interface CreateStoredTokenInput {
  tenantId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  expiresAt: Date;
  scopes: string[];
  tokenType?: string;
}

export interface CreateAuditLogInput {
  tenantId?: string;
  eventType: string;
  eventCategory: EventCategory;
  actorType: ActorType;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  result: EventResult;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  durationMs?: number;
}