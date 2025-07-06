import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';

interface HttpServerConfig {
  port: number;
  host: string;
  apiKeys: string[];
  allowedIps: string[];
  enableCors: boolean;
  corsOrigin: string;
  onSseConnection: (sessionId: string, transport: SSEServerTransport) => void;
}

interface AuthenticatedRequest extends Request {
  sessionId?: string;
  apiKey?: string;
}

// Session management
const sessions = new Map<string, {
  transport: SSEServerTransport;
  createdAt: Date;
  lastActivity: Date;
  apiKey: string;
  clientIp: string;
}>();

// Cleanup inactive sessions after 30 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Create HTTP server for SSE transport
 */
export async function createHttpServer(config: HttpServerConfig): Promise<any> {
  const app: Express = express();
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false // Allow SSE
  }));
  
  // CORS configuration
  if (config.enableCors) {
    app.use(cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));
  }
  
  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  
  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.ip}`);
    next();
  });
  
  // API key authentication middleware
  const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
    const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }
    
    if (!config.apiKeys.includes(apiKey)) {
      return res.status(403).json({ error: 'Invalid API key' });
    }
    
    // Check IP whitelist
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (config.allowedIps[0] !== '*' && !config.allowedIps.includes(clientIp)) {
      return res.status(403).json({ error: 'IP not allowed' });
    }
    
    req.apiKey = apiKey;
    next();
  };
  
  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      transport: 'sse',
      sessions: sessions.size,
      uptime: process.uptime()
    });
  });
  
  // SSE endpoint - establish connection
  app.get('/sse', authenticate, async (req: AuthenticatedRequest, res: Response) => {
    const sessionId = randomUUID();
    req.sessionId = sessionId;
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Session-ID': sessionId
    });
    
    // Create SSE transport with response object
    const transport = new SSEServerTransport(`/messages/${sessionId}`, res as any);
    
    // Start the SSE connection
    await transport.start();
    
    // Store session
    sessions.set(sessionId, {
      transport,
      createdAt: new Date(),
      lastActivity: new Date(),
      apiKey: req.apiKey!,
      clientIp: req.ip || ''
    });
    
    // Notify about new connection
    config.onSseConnection(sessionId, transport);
    
    // Handle client disconnect
    req.on('close', () => {
      sessions.delete(sessionId);
      transport.close();
      console.log(`SSE connection closed: ${sessionId}`);
    });
  });
  
  // Message endpoint - receive messages from client
  app.post('/messages/:sessionId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<any> => {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify API key matches session
    if (session.apiKey !== req.apiKey) {
      return res.status(403).json({ error: 'API key mismatch' });
    }
    
    // Update activity
    session.lastActivity = new Date();
    
    try {
      // Handle the message through SSE transport
      await session.transport.handlePostMessage(req as unknown as IncomingMessage, res as any);
    } catch (error) {
      console.error(`Error handling message for session ${sessionId}:`, error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });
  
  // Session info endpoint
  app.get('/sessions', authenticate, (_req: AuthenticatedRequest, res: Response) => {
    const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
      id,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      clientIp: session.clientIp,
      apiKey: session.apiKey.substring(0, 8) + '...' // Partial key for security
    }));
    
    res.json({
      count: sessions.size,
      sessions: sessionList
    });
  });
  
  // Rate limiting info endpoint
  app.get('/rate-limit-status', authenticate, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { RateLimitCoordinator } = await import('../api/rateLimitCoordinator.js');
      const coordinator = RateLimitCoordinator.getInstance();
      const status = await coordinator.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get rate limit status' });
    }
  });
  
  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });
  
  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
  
  // Session cleanup interval
  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
      if (now - session.lastActivity.getTime() > SESSION_TIMEOUT) {
        sessions.delete(sessionId);
        session.transport.close();
        console.log(`Session timeout: ${sessionId}`);
      }
    }
  }, 60000); // Check every minute
  
  // Start server
  const server = app.listen(config.port, config.host, () => {
    console.log(`HTTP/SSE server listening on ${config.host}:${config.port}`);
  });
  
  return server;
}