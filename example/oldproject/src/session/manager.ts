/**
 * Session manager for multi-tenant MCP server
 */

import { MultiTenantSession, SessionManager } from '../types/session.js';

/**
 * Default session manager implementation
 */
export class DefaultSessionManager implements SessionManager {
  private sessions = new Map<string, MultiTenantSession>();

  createSession(sessionData: Omit<MultiTenantSession, 'sdpClient'>): MultiTenantSession {
    const session: MultiTenantSession = {
      ...sessionData,
      sdpClient: undefined,
      sdpClientError: undefined
    };
    
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): MultiTenantSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<MultiTenantSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastActivity = new Date();
    }
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clean up SDPClient if exists
      if (session.sdpClient) {
        // SDPClient doesn't have a cleanup method, but we can clear references
        session.sdpClient = undefined;
      }
      this.sessions.delete(sessionId);
    }
  }

  getAllSessions(): Map<string, MultiTenantSession> {
    return new Map(this.sessions);
  }

  cleanupInactiveSessions(timeout: number): void {
    const now = Date.now();
    const sessionsToDelete: string[] = [];
    
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > timeout) {
        sessionsToDelete.push(id);
      }
    }
    
    sessionsToDelete.forEach(id => this.deleteSession(id));
    
    if (sessionsToDelete.length > 0) {
      console.log(`🧹 Cleaned ${sessionsToDelete.length} inactive sessions`);
    }
  }
}