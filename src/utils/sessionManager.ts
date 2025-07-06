/**
 * Session Manager for Multi-User MCP Server
 * 
 * Manages per-session SDP clients and their credentials
 */

import { SDPConfig } from '../api/types.js';
import { getClientV2 } from './clientFactoryV2.js';
import { RateLimitSystem } from '../integration/rateLimitIntegration.js';

export interface SessionData {
  sessionId: string;
  client: any;
  rateLimitSystem: RateLimitSystem;
  config: SDPConfig;
  createdAt: Date;
  lastAccessed: Date;
}

class SessionManager {
  private sessions = new Map<string, SessionData>();
  private currentSessionId: string | null = null;

  /**
   * Set the current session ID for the request context
   */
  setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Clear the current session ID
   */
  clearCurrentSession(): void {
    this.currentSessionId = null;
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Initialize or get a client for a session
   */
  async getOrCreateClient(sessionId: string, config?: SDPConfig): Promise<any> {
    // Check if session exists
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastAccessed = new Date();
      return existing.client;
    }

    // Need config to create new session
    if (!config) {
      throw new Error(`No configuration provided for new session ${sessionId}`);
    }

    // Validate required configuration
    if (!config.clientId || !config.clientSecret || !config.instanceName) {
      throw new Error('Missing required SDP credentials (clientId, clientSecret, instanceName)');
    }

    console.log(`🔐 Initializing SDP client for session ${sessionId}...`);

    try {
      // Create client with provided credentials
      const client = await getClientV2(config);
      console.log(`✅ Authentication successful for session ${sessionId}`);

      // Initialize rate limit system for this client
      const rateLimitSystem = new RateLimitSystem(
        (client as any).authManager,
        config,
        {
          enableMonitoring: false, // Disable per-client monitoring
          enableAnalytics: false,
          enableQueue: false,
          enableCoordination: false
        }
      );

      await rateLimitSystem.start();

      // Store session data
      const sessionData: SessionData = {
        sessionId,
        client,
        rateLimitSystem,
        config,
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      this.sessions.set(sessionId, sessionData);
      console.log(`✅ Client initialized for session ${sessionId}`);

      return client;
    } catch (error) {
      console.error(`❌ Failed to initialize client for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get client for current session
   */
  async getCurrentClient(): Promise<any> {
    if (!this.currentSessionId) {
      throw new Error('No current session set');
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      throw new Error(`Session ${this.currentSessionId} not found`);
    }

    session.lastAccessed = new Date();
    return session.client;
  }

  /**
   * Update session configuration
   */
  updateSessionConfig(sessionId: string, config: SDPConfig): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.config = { ...session.config, ...config };
    }
  }

  /**
   * Clean up a session
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`🧹 Cleaning up session ${sessionId}...`);

      // Stop rate limit system
      if (session.rateLimitSystem) {
        try {
          await session.rateLimitSystem.stop();
        } catch (error) {
          console.error(`Error stopping rate limit system for ${sessionId}:`, error);
        }
      }

      // Remove from map
      this.sessions.delete(sessionId);
      console.log(`✅ Session ${sessionId} cleaned up`);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(maxAge: number = 30 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed.getTime() > maxAge) {
        await this.cleanupSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        createdAt: session.createdAt,
        lastAccessed: session.lastAccessed,
        instanceName: session.config.instanceName
      }))
    };
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();