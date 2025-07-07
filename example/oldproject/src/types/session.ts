/**
 * Session types for multi-tenant MCP server
 */

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { SDPClient } from '../api/client.js';

/**
 * Service Desk Plus credentials provided by the client
 */
export interface SDPCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  baseUrl: string;
  instanceName: string;
  defaultTechnicianEmail?: string;
}

/**
 * Extended session interface with SDP client support
 */
export interface MultiTenantSession {
  id: string;
  transport: SSEServerTransport;
  createdAt: Date;
  lastActivity: Date;
  apiKey: string;
  clientIp: string;
  userAgent: string;
  requestCount: number;
  
  // Multi-tenant fields
  sdpCredentials?: SDPCredentials;
  sdpClient?: SDPClient;
  sdpClientError?: string;
}

/**
 * Session manager interface
 */
export interface SessionManager {
  createSession(sessionData: Omit<MultiTenantSession, 'sdpClient'>): MultiTenantSession;
  getSession(sessionId: string): MultiTenantSession | undefined;
  updateSession(sessionId: string, updates: Partial<MultiTenantSession>): void;
  deleteSession(sessionId: string): void;
  getAllSessions(): Map<string, MultiTenantSession>;
  cleanupInactiveSessions(timeout: number): void;
}