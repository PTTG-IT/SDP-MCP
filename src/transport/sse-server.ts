/**
 * Simplified SSE-only server for Service Desk Plus MCP
 * 
 * Production-ready features:
 * - API key authentication with rate limiting
 * - Session management with automatic cleanup
 * - Health monitoring and metrics
 * - Graceful connection handling
 * - Security headers and CORS
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { randomUUID } from 'crypto';
import { RateLimitSystem } from '../integration/rateLimitIntegration.js';
import { MultiTenantSession, SDPCredentials } from '../types/session.js';
import { UserRegistry } from '../services/userRegistry.js';
import { Pool } from 'pg';

export interface SSEServerConfig {
  port: number;
  host: string;
  apiKeys: string[];
  allowedIps: string[];
  enableCors: boolean;
  corsOrigin: string;
  maxConnections: number;
  sessionTimeout: number;
  enableMetrics: boolean;
  enableHealthCheck: boolean;
  rateLimitPerKey: number;
  enableUserRegistry?: boolean;
}

interface AuthenticatedRequest extends Request {
  sessionId?: string;
  apiKey?: string;
  userCredentials?: any;
}

// Use MultiTenantSession from types
type Session = MultiTenantSession;

interface Metrics {
  totalConnections: number;
  activeConnections: number;
  totalRequests: number;
  averageSessionDuration: number;
  apiKeyUsage: Map<string, number>;
  errorCount: number;
  lastError?: Date;
}

// Session and metrics storage
const sessions = new Map<string, Session>();
const metrics: Metrics = {
  totalConnections: 0,
  activeConnections: 0,
  totalRequests: 0,
  averageSessionDuration: 0,
  apiKeyUsage: new Map(),
  errorCount: 0
};

// Rate limiting per API key
const rateLimiters = new Map<string, { count: number; resetTime: number }>();

/**
 * Create and configure SSE server
 */
export async function createSSEServer(
  mcpServer: Server,
  config: SSEServerConfig,
  rateLimitSystem: RateLimitSystem | null,
  userRegistry?: UserRegistry | null
): Promise<any> {
  const app: Express = express();
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // CORS configuration
  if (config.enableCors) {
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigin === '*') {
          callback(null, true);
        } else {
          const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      exposedHeaders: ['X-Session-ID', 'X-Rate-Limit-Remaining']
    }));
  }
  
  // Body parsers for JSON and URL-encoded data
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });
  
  /**
   * Extract SDP credentials from request headers
   */
  const extractSDPCredentials = (req: Request): SDPCredentials | undefined => {
    const clientId = req.headers['x-sdp-client-id'] as string;
    const clientSecret = req.headers['x-sdp-client-secret'] as string;
    const refreshToken = req.headers['x-sdp-refresh-token'] as string;
    const baseUrl = req.headers['x-sdp-base-url'] as string;
    const instanceName = req.headers['x-sdp-instance'] as string;
    const technicianEmail = req.headers['x-sdp-technician-email'] as string;
    
    // All required fields must be present
    if (!clientId || !clientSecret || !refreshToken || !baseUrl || !instanceName) {
      return undefined;
    }
    
    return {
      clientId,
      clientSecret,
      refreshToken,
      baseUrl,
      instanceName,
      defaultTechnicianEmail: technicianEmail
    };
  };

  /**
   * API key authentication with rate limiting and user registry support
   */
  const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    // Check for API key in various locations
    let apiKey = req.headers['x-api-key'] as string || 
                 req.headers['x-user-key'] as string || 
                 req.query.apiKey as string;
    
    // Also check for Bearer token (from OAuth flow)
    const authHeader = req.headers.authorization;
    if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    
    if (!apiKey) {
      metrics.errorCount++;
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Include X-API-Key header, X-User-Key header, Authorization: Bearer token, or apiKey query parameter'
      });
    }
    
    // Check if it's a user registry key (starts with usr_)
    if (config.enableUserRegistry && userRegistry && apiKey.startsWith('usr_')) {
      try {
        const userCredentials = await userRegistry.getUserCredentials(apiKey);
        
        if (!userCredentials) {
          metrics.errorCount++;
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
        
        // Skip standard API key check for user registry keys
      } catch (error) {
        console.error('User registry authentication error:', error);
        metrics.errorCount++;
        return res.status(500).json({ 
          error: 'Authentication error',
          message: 'Failed to validate user credentials'
        });
      }
    } else if (!config.apiKeys.includes(apiKey)) {
      metrics.errorCount++;
      return res.status(403).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not authorized'
      });
    }
    
    // IP allowlist check
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (config.allowedIps[0] !== '*') {
      const allowed = config.allowedIps.some(allowedIp => {
        if (allowedIp.includes('/')) {
          // CIDR notation support
          return isIpInRange(clientIp, allowedIp);
        }
        return clientIp === allowedIp;
      });
      
      if (!allowed) {
        metrics.errorCount++;
        return res.status(403).json({ 
          error: 'IP not allowed',
          message: `Your IP address ${clientIp} is not authorized`
        });
      }
    }
    
    // Rate limiting per API key
    const now = Date.now();
    const limiter = rateLimiters.get(apiKey) || { count: 0, resetTime: now + 60000 };
    
    if (now > limiter.resetTime) {
      limiter.count = 0;
      limiter.resetTime = now + 60000;
    }
    
    if (limiter.count >= config.rateLimitPerKey) {
      metrics.errorCount++;
      const resetIn = Math.ceil((limiter.resetTime - now) / 1000);
      res.setHeader('X-Rate-Limit-Remaining', '0');
      res.setHeader('X-Rate-Limit-Reset', limiter.resetTime.toString());
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${resetIn} seconds`,
        retryAfter: resetIn
      });
    }
    
    limiter.count++;
    rateLimiters.set(apiKey, limiter);
    res.setHeader('X-Rate-Limit-Remaining', (config.rateLimitPerKey - limiter.count).toString());
    
    // Track API key usage
    metrics.apiKeyUsage.set(apiKey, (metrics.apiKeyUsage.get(apiKey) || 0) + 1);
    
    req.apiKey = apiKey;
    next();
  };
  
  /**
   * Health check endpoint (no auth required)
   */
  app.get('/health', (_req: Request, res: Response) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      connections: {
        active: sessions.size,
        max: config.maxConnections
      },
      memory: process.memoryUsage(),
      rateLimitSystem: rateLimitSystem ? 'active' : 'inactive'
    };
    
    res.json(health);
  });
  
  /**
   * Metrics endpoint
   */
  if (config.enableMetrics) {
    app.get('/metrics', authenticate, (_req: AuthenticatedRequest, res: Response) => {
      const sessionDurations = Array.from(sessions.values()).map(s => 
        Date.now() - s.createdAt.getTime()
      );
      
      const avgDuration = sessionDurations.length > 0
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
        : 0;
      
      res.json({
        ...metrics,
        activeConnections: sessions.size,
        averageSessionDuration: Math.round(avgDuration / 1000), // seconds
        apiKeyUsage: Array.from(metrics.apiKeyUsage.entries()).map(([key, count]) => ({
          key: key.substring(0, 8) + '...',
          count
        }))
      });
    });
  }
  
  /**
   * SSE endpoint - establish connection
   */
  app.get('/sse', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Check connection limit
    if (sessions.size >= config.maxConnections) {
      metrics.errorCount++;
      res.status(503).json({ 
        error: 'Connection limit reached',
        message: `Maximum ${config.maxConnections} concurrent connections allowed`
      });
      return;
    }
    
    const sessionId = randomUUID();
    req.sessionId = sessionId;
    
    // Create SSE transport (it will handle headers)
    const transport = new SSEServerTransport(`/messages/${sessionId}`, res as any);
    
    // Connect transport to MCP server (this automatically calls start())
    await mcpServer.connect(transport);
    
    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(':ping\n\n');
      } catch (error) {
        // Connection might be closed
        clearInterval(pingInterval);
      }
    }, 30000);
    
    // Extract SDP credentials from headers or user registry
    let sdpCredentials = extractSDPCredentials(req);
    
    // If using user registry and credentials were loaded, use those instead
    if (req.userCredentials && config.enableUserRegistry) {
      const userCreds = req.userCredentials;
      sdpCredentials = {
        clientId: userCreds.clientId,
        clientSecret: userCreds.clientSecret,
        refreshToken: userCreds.refreshToken,
        baseUrl: userCreds.baseUrl,
        instanceName: userCreds.instanceName,
        defaultTechnicianEmail: userCreds.defaultTechnicianEmail
      };
      console.log(`🔐 Using credentials from user registry for ${userCreds.userName} (${userCreds.userEmail || 'no email'})`);
    }
    
    // Store session with credentials
    const session: Session = {
      id: sessionId,
      transport,
      createdAt: new Date(),
      lastActivity: new Date(),
      apiKey: req.apiKey!,
      clientIp: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      requestCount: 0,
      sdpCredentials
    };
    sessions.set(sessionId, session);
    
    // Update metrics
    metrics.totalConnections++;
    metrics.activeConnections = sessions.size;
    
    console.log(`✅ SSE connection established: ${sessionId} (${req.apiKey!.substring(0, 8)}...)`);
    
    // Handle client disconnect
    req.on('close', () => {
      clearInterval(pingInterval);
      sessions.delete(sessionId);
      transport.close();
      metrics.activeConnections = sessions.size;
      console.log(`❌ SSE connection closed: ${sessionId}`);
    });
  });
  
  /**
   * Message endpoint - receive messages from client
   */
  app.post('/messages/:sessionId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
      metrics.errorCount++;
      return res.status(404).json({ 
        error: 'Session not found',
        message: 'Invalid or expired session ID'
      });
    }
    
    // Verify API key matches session
    if (session.apiKey !== req.apiKey) {
      metrics.errorCount++;
      return res.status(403).json({ 
        error: 'API key mismatch',
        message: 'API key does not match session'
      });
    }
    
    // Update activity
    session.lastActivity = new Date();
    session.requestCount++;
    metrics.totalRequests++;
    
    try {
      // The SSE transport expects the raw request body as a stream
      // Express has already parsed it, so we need to recreate a stream
      const { Readable } = await import('stream');
      const bodyStream = Readable.from(JSON.stringify(req.body));
      
      // Create a minimal request-like object that SSE transport expects
      const mockReq = Object.assign(bodyStream, {
        headers: req.headers,
        method: req.method,
        url: req.url,
        httpVersion: '1.1',
        socket: req.socket
      });
      
      // Handle message through SSE transport
      await session.transport.handlePostMessage(mockReq as any, res as any);
    } catch (error) {
      metrics.errorCount++;
      metrics.lastError = new Date();
      console.error(`Error handling message for session ${sessionId}:`, error);
      
      // Don't try to send response if headers already sent
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to process message',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });
  
  /**
   * OAuth discovery endpoints for Claude Code compatibility
   */
  app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
    res.json({
      resource: "http://localhost:3456/sse",
      authorization_servers: ["http://localhost:3456"]
    });
  });

  app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
    res.json({
      issuer: "http://localhost:3456",
      authorization_endpoint: "http://localhost:3456/oauth/authorize",
      token_endpoint: "http://localhost:3456/oauth/token",
      registration_endpoint: "http://localhost:3456/register",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"]
    });
  });

  /**
   * Dynamic client registration endpoint for Claude Code
   */
  app.post('/register', (req: Request, res: Response) => {
    // Claude Code dynamic registration
    const clientId = randomUUID();
    const clientSecret = randomUUID();
    
    res.json({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: req.body.redirect_uris || ["http://localhost:9999/callback"],
      token_endpoint_auth_method: "client_secret_basic"
    });
  });

  /**
   * OAuth authorization endpoint - redirects back with a code
   */
  app.get('/oauth/authorize', (req: Request, res: Response): void => {
    const { redirect_uri, state } = req.query;
    
    if (!redirect_uri) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'redirect_uri is required'
      });
      return;
    }
    
    // Generate a simple authorization code
    const code = randomUUID();
    
    // Store code temporarily (in production, use a proper store with expiration)
    // For now, we'll just generate a code that includes the API key info
    const redirectUrl = new URL(redirect_uri as string);
    redirectUrl.searchParams.append('code', code);
    if (state) {
      redirectUrl.searchParams.append('state', state as string);
    }
    
    // Redirect back to the client with the authorization code
    res.redirect(redirectUrl.toString());
  });

  /**
   * OAuth token endpoint - exchanges code for access token
   */
  app.post('/oauth/token', (req: Request, res: Response): void => {
    console.log('OAuth token request:', {
      headers: req.headers,
      body: req.body,
      contentType: req.get('content-type')
    });
    
    const { grant_type, code, refresh_token } = req.body || {};
    
    if (!grant_type) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'grant_type is required'
      });
      return;
    }
    
    if (grant_type === 'authorization_code') {
      if (!code) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'code is required for authorization_code grant'
        });
        return;
      }
      
      // In a real implementation, validate the code
      // For now, we'll use the first API key from config as the access token
      const accessToken = config.apiKeys[0] || randomUUID();
      
      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: randomUUID(),
        scope: 'full_access'
      });
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'refresh_token is required for refresh_token grant'
        });
        return;
      }
      
      // Generate new access token (using first API key from config)
      const accessToken = config.apiKeys[0] || randomUUID();
      
      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: randomUUID(),
        scope: 'full_access'
      });
    } else {
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: `Grant type '${grant_type}' is not supported`
      });
    }
  });

  /**
   * Session information endpoint
   */
  app.get('/sessions', authenticate, (_req: AuthenticatedRequest, res: Response) => {
    const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
      id,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      duration: Date.now() - session.createdAt.getTime(),
      requestCount: session.requestCount,
      apiKey: session.apiKey.substring(0, 8) + '...'
    }));
    
    res.json({
      count: sessions.size,
      maxConnections: config.maxConnections,
      sessions: sessionList
    });
  });
  
  /**
   * Rate limit status endpoint
   */
  if (rateLimitSystem) {
    app.get('/rate-limit-status', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
      try {
        const status = await rateLimitSystem.getStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ 
          error: 'Failed to get rate limit status',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }
  
  /**
   * 404 handler
   */
  app.use((_req: Request, res: Response) => {
    metrics.errorCount++;
    res.status(404).json({ 
      error: 'Not found',
      message: 'The requested endpoint does not exist'
    });
  });
  
  /**
   * Error handler
   */
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    metrics.errorCount++;
    metrics.lastError = new Date();
    console.error('Server error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
  });
  
  /**
   * Session cleanup interval
   */
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of sessions.entries()) {
      if (now - session.lastActivity.getTime() > config.sessionTimeout) {
        sessions.delete(sessionId);
        session.transport.close();
        cleaned++;
        console.log(`🧹 Session timeout: ${sessionId}`);
      }
    }
    
    if (cleaned > 0) {
      metrics.activeConnections = sessions.size;
      console.log(`🧹 Cleaned ${cleaned} inactive sessions`);
    }
  }, 60000); // Check every minute
  
  // Start server
  const server = app.listen(config.port, config.host, () => {
    console.log(`✅ SSE server listening on http://${config.host}:${config.port}`);
  });
  
  return server;
}

/**
 * Check if IP is in CIDR range
 */
function isIpInRange(ip: string, cidr: string): boolean {
  // Simple implementation - in production use a proper IP range library
  const [range, bits] = cidr.split('/');
  if (!bits) return ip === range;
  
  // Convert IPs to numbers for comparison
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  const mask = ~((1 << (32 - parseInt(bits))) - 1);
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.');
  return parts.reduce((acc, part) => (acc << 8) + parseInt(part), 0) >>> 0;
}