import express, { Express } from 'express';
import cors from 'cors';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../monitoring/logging.js';
import type { MCPRequest, SSEMessage, MCPMiddleware } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * SSE Server Transport for MCP
 * Implements Server-Sent Events transport for MCP communication
 */
export class SSEServerTransport implements Transport {
  private app: Express;
  private server: any;
  private clients: Map<string, express.Response> = new Map();
  private messageHandlers: Array<(message: JSONRPCMessage) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];

  constructor(
    private config: {
      port: number;
      path: string;
      cors?: cors.CorsOptions;
      middleware?: MCPMiddleware[];
    }
  ) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    if (this.config.cors) {
      this.app.use(cors(this.config.cors));
    }

    // Body parser for POST requests
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Custom middleware
    if (this.config.middleware) {
      this.config.middleware.forEach(middleware => {
        this.app.use(middleware);
      });
    }

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug('SSE request', {
        method: req.method,
        path: req.path,
        headers: req.headers,
        context: (req as MCPRequest).context,
      });
      next();
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // SSE endpoint
    this.app.get(this.config.path, this.handleSSEConnection.bind(this));

    // Message endpoint (for client-to-server messages)
    this.app.post(`${this.config.path}/message`, this.handleMessage.bind(this));

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        clients: this.clients.size,
        uptime: process.uptime(),
      });
    });
  }

  /**
   * Handle SSE connection
   */
  private handleSSEConnection(req: MCPRequest, res: express.Response): void {
    const clientId = uuidv4();
    const tenantId = req.context?.tenantId || 'unknown';

    logger.info('SSE client connected', {
      clientId,
      tenantId,
      remoteAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    // Store client connection
    this.clients.set(clientId, res);

    // Send initial connection message
    this.sendSSEMessage(res, {
      type: 'connected',
      data: {
        clientId,
        tenantId,
        timestamp: new Date().toISOString(),
      },
    });

    // Setup heartbeat
    const heartbeatInterval = setInterval(() => {
      this.sendSSEMessage(res, {
        type: 'heartbeat',
        data: {
          timestamp: new Date().toISOString(),
        },
      });
    }, 30000); // 30 seconds

    // Handle client disconnect
    req.on('close', () => {
      logger.info('SSE client disconnected', { clientId, tenantId });
      
      clearInterval(heartbeatInterval);
      this.clients.delete(clientId);
      
      // Notify close handlers
      this.closeHandlers.forEach(handler => handler());
    });

    // Handle errors
    req.on('error', (error) => {
      logger.error('SSE connection error', { clientId, error });
      
      clearInterval(heartbeatInterval);
      this.clients.delete(clientId);
      
      // Notify error handlers
      this.errorHandlers.forEach(handler => handler(error));
    });

    // Store client ID in response for message routing
    (res as any).clientId = clientId;
  }

  /**
   * Handle incoming message from client
   */
  private async handleMessage(req: MCPRequest, res: express.Response): Promise<void> {
    try {
      const { clientId, message } = req.body;

      if (!clientId || !message) {
        res.status(400).json({ error: 'Missing clientId or message' });
        return;
      }

      logger.debug('Received message from client', {
        clientId,
        messageType: message.method || message.result ? 'response' : 'request',
      });

      // Notify message handlers
      this.messageHandlers.forEach(handler => handler(message));

      res.json({ success: true });
    } catch (error) {
      logger.error('Error handling message', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Send SSE message to client
   */
  private sendSSEMessage(res: express.Response, message: SSEMessage): void {
    const data = JSON.stringify(message.data);
    let sseMessage = '';

    if (message.id) {
      sseMessage += `id: ${message.id}\n`;
    }

    if (message.type) {
      sseMessage += `event: ${message.type}\n`;
    }

    sseMessage += `data: ${data}\n`;

    if (message.retry) {
      sseMessage += `retry: ${message.retry}\n`;
    }

    sseMessage += '\n';

    res.write(sseMessage);
  }

  /**
   * Start the SSE server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          logger.info('SSE server started', {
            port: this.config.port,
            path: this.config.path,
          });
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('SSE server error', { error });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the SSE server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all client connections
      this.clients.forEach((res, clientId) => {
        this.sendSSEMessage(res, {
          type: 'close',
          data: { reason: 'Server shutting down' },
        });
        res.end();
      });
      this.clients.clear();

      // Close server
      if (this.server) {
        this.server.close(() => {
          logger.info('SSE server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send message to specific client or broadcast
   */
  async send(message: JSONRPCMessage): Promise<void> {
    // For SSE, we need to determine which client to send to
    // This could be based on the message ID or a routing strategy
    
    // For now, broadcast to all clients (in production, implement proper routing)
    this.clients.forEach((res, clientId) => {
      this.sendSSEMessage(res, {
        type: 'message',
        data: message,
      });
    });
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register close handler
   */
  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    await this.stop();
  }
}