import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  path: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  maxConnections: number;
  heartbeatInterval: number;
}

/**
 * MCP connection context
 */
export interface MCPContext {
  tenantId: string;
  clientId: string;
  sessionId: string;
  scopes: string[];
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * Extended Express Request with MCP context
 */
export interface MCPRequest extends ExpressRequest {
  context?: MCPContext;
  tenantId?: string;
}

/**
 * MCP tool definition
 */
export interface MCPTool extends Tool {
  requiredScopes: string[];
  module: string;
  operation: string;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  tenantId: string;
  clientId?: string;
  sessionId?: string;
  scopes?: string[];
}

/**
 * Tool execution result
 */
export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: any;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Connection info
 */
export interface ConnectionInfo {
  id: string;
  tenantId: string;
  clientId: string;
  connectedAt: Date;
  lastActivity: Date;
  transport: 'sse' | 'stdio';
  remoteAddress?: string;
  userAgent?: string;
}

/**
 * SSE message types
 */
export type SSEMessageType = 'connected' | 'heartbeat' | 'message' | 'error' | 'close';

/**
 * SSE message format
 */
export interface SSEMessage {
  id?: string;
  type: SSEMessageType;
  data: any;
  retry?: number;
}

/**
 * Middleware function type
 */
export type MCPMiddleware = (
  req: MCPRequest,
  res: ExpressResponse,
  next: NextFunction
) => void | Promise<void>;

/**
 * Tool handler function type
 */
export type ToolHandler<T = any, R = any> = (
  args: T,
  context: ToolContext
) => Promise<R>;

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry {
  tool: MCPTool;
  handler: ToolHandler;
  module: string;
  validateArgs?: (args: any) => boolean | Promise<boolean>;
}

/**
 * Tenant connection state
 */
export interface TenantConnectionState {
  tenantId: string;
  connections: ConnectionInfo[];
  activeTools: string[];
  lastActivity: Date;
  totalRequests: number;
  totalErrors: number;
}