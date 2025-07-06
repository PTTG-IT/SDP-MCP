/**
 * Enhanced SSE server with user registry support
 * Extends the base SSE server to support API key mapping
 */

import { createSSEServer as createBaseSSEServer, SSEServerConfig } from './sse-server.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { RateLimitSystem } from '../integration/rateLimitIntegration.js';
import { UserRegistry } from '../services/userRegistry.js';
import { Request, Response, NextFunction } from 'express';

export interface SSEServerWithRegistryConfig extends SSEServerConfig {
  enableUserRegistry?: boolean;
}

interface AuthenticatedRequest extends Request {
  sessionId?: string;
  apiKey?: string;
  userCredentials?: any;
}

/**
 * Create SSE server with user registry support
 */
export async function createSSEServerWithRegistry(
  mcpServer: Server,
  config: SSEServerWithRegistryConfig,
  rateLimitSystem: RateLimitSystem | null,
  userRegistry: UserRegistry | null
): Promise<any> {
  // Create the base server
  const server = await createBaseSSEServer(mcpServer, config, rateLimitSystem);
  
  // If user registry is enabled and provided, enhance the authentication
  if (config.enableUserRegistry && userRegistry) {
    console.log('🔐 User registry authentication enabled');
    
    // We need to intercept the authentication middleware
    // This is a bit tricky since the middleware is already set up
    // For now, we'll document this as a limitation and suggest
    // modifying the main sse-server.ts file directly
    
    console.warn('⚠️  User registry requires modifying authentication middleware directly');
    console.warn('    See MULTI_USER_IMPLEMENTATION.md for details');
  }
  
  return server;
}

/**
 * Enhanced authentication middleware that checks user registry
 * This should replace the standard authenticate middleware in sse-server.ts
 */
export function createAuthenticateWithRegistry(
  config: SSEServerConfig,
  userRegistry: UserRegistry
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    // Check for API key in various locations
    let apiKey = req.headers['x-api-key'] as string || 
                 req.headers['x-user-key'] as string || 
                 req.query.apiKey as string;
    
    // Also check for Bearer token
    const authHeader = req.headers.authorization;
    if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Include X-API-Key, X-User-Key header, or Authorization: Bearer token'
      });
    }
    
    // First, check if it's a user registry key (starts with usr_)
    if (apiKey.startsWith('usr_')) {
      try {
        const userCredentials = await userRegistry.getUserCredentials(apiKey);
        
        if (!userCredentials) {
          return res.status(403).json({ 
            error: 'Invalid user key',
            message: 'The provided user key is not valid or has been deactivated'
          });
        }
        
        // Store credentials in request for later use
        req.userCredentials = userCredentials;
        req.apiKey = apiKey;
        
        // Track usage
        const clientIp = req.ip || req.socket.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';
        await userRegistry.trackUsage(userCredentials.userId, clientIp, userAgent);
        
        next();
      } catch (error) {
        console.error('User registry authentication error:', error);
        return res.status(500).json({ 
          error: 'Authentication error',
          message: 'Failed to validate user credentials'
        });
      }
    } else {
      // Fall back to standard API key authentication
      if (!config.apiKeys.includes(apiKey)) {
        return res.status(403).json({ 
          error: 'Invalid API key',
          message: 'The provided API key is not authorized'
        });
      }
      
      req.apiKey = apiKey;
      next();
    }
  };
}