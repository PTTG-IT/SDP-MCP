/**
 * Bearer Token Service for MCP Client Authentication
 * 
 * Manages short-lived bearer tokens for SSE connections
 */

import crypto from 'crypto';
import { SDPAuthError } from '../utils/errors.js';

interface TokenData {
  clientId: string;
  clientSecret: string;
  createdAt: Date;
  expiresAt: Date;
}

export class BearerTokenService {
  private tokens: Map<string, TokenData> = new Map();
  private tokenTTL: number = 3600 * 1000; // 1 hour in milliseconds
  
  constructor() {
    // Clean up expired tokens every 5 minutes
    setInterval(() => this.cleanupExpiredTokens(), 5 * 60 * 1000);
  }
  
  /**
   * Generate a new bearer token for the given credentials
   */
  async generateToken(clientId: string, clientSecret: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    // Validate credentials format
    if (!clientId || !clientSecret) {
      throw new SDPAuthError('Invalid credentials');
    }
    
    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store token data
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.tokenTTL);
    
    this.tokens.set(token, {
      clientId,
      clientSecret,
      createdAt: now,
      expiresAt
    });
    
    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: Math.floor(this.tokenTTL / 1000) // Convert to seconds
    };
  }
  
  /**
   * Validate a bearer token and return the associated credentials
   */
  validateToken(token: string): { clientId: string; clientSecret: string } | null {
    const tokenData = this.tokens.get(token);
    
    if (!tokenData) {
      return null;
    }
    
    // Check if token is expired
    if (new Date() > tokenData.expiresAt) {
      this.tokens.delete(token);
      return null;
    }
    
    return {
      clientId: tokenData.clientId,
      clientSecret: tokenData.clientSecret
    };
  }
  
  /**
   * Revoke a token
   */
  revokeToken(token: string): void {
    this.tokens.delete(token);
  }
  
  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    const expiredTokens: string[] = [];
    
    for (const [token, data] of this.tokens.entries()) {
      if (now > data.expiresAt) {
        expiredTokens.push(token);
      }
    }
    
    for (const token of expiredTokens) {
      this.tokens.delete(token);
    }
    
    if (expiredTokens.length > 0) {
      console.log(`🧹 Cleaned up ${expiredTokens.length} expired bearer tokens`);
    }
  }
  
  /**
   * Get token statistics
   */
  getStats(): { activeTokens: number; clientIds: string[] } {
    const clientIds = new Set<string>();
    
    for (const data of this.tokens.values()) {
      clientIds.add(data.clientId);
    }
    
    return {
      activeTokens: this.tokens.size,
      clientIds: Array.from(clientIds)
    };
  }
}