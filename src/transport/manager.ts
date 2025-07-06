import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { EventEmitter } from 'events';

export interface TransportConfig {
  mode: 'stdio' | 'sse' | 'multi';
  httpPort?: number;
  httpHost?: string;
  apiKeys?: string[];
  allowedIps?: string[];
  enableCors?: boolean;
  corsOrigin?: string;
}

export interface TransportInfo {
  name: string;
  type: 'stdio' | 'sse';
  status: 'connected' | 'disconnected' | 'error';
  connectedAt?: Date;
  lastActivity?: Date;
  sessionId?: string;
}

/**
 * Manages multiple transport connections for the MCP server
 * Allows simultaneous stdio (local) and SSE/HTTP (remote) connections
 */
export class TransportManager extends EventEmitter {
  private server: Server;
  private transports: Map<string, Transport> = new Map();
  private transportInfo: Map<string, TransportInfo> = new Map();
  private config: TransportConfig;
  private httpServer: any; // Will be Express server
  
  constructor(server: Server, config: TransportConfig) {
    super();
    this.server = server;
    this.config = config;
  }
  
  /**
   * Initialize transports based on configuration
   */
  async initialize(): Promise<void> {
    console.log(`Initializing TransportManager in ${this.config.mode} mode`);
    
    switch (this.config.mode) {
      case 'stdio':
        await this.initializeStdio();
        break;
      case 'sse':
        await this.initializeSse();
        break;
      case 'multi':
        await this.initializeStdio();
        await this.initializeSse();
        break;
      default:
        throw new Error(`Unknown transport mode: ${this.config.mode}`);
    }
  }
  
  /**
   * Initialize stdio transport for local connections
   */
  private async initializeStdio(): Promise<void> {
    try {
      const stdioTransport = new StdioServerTransport();
      await this.addTransport('stdio-main', stdioTransport, 'stdio');
      console.log('✓ Stdio transport initialized');
    } catch (error) {
      console.error('Failed to initialize stdio transport:', error);
      throw error;
    }
  }
  
  /**
   * Initialize SSE transport for remote connections
   */
  private async initializeSse(): Promise<void> {
    if (!this.config.httpPort) {
      throw new Error('HTTP port must be specified for SSE transport');
    }
    
    try {
      // Import HTTP server setup (to be created)
      const { createHttpServer } = await import('./http-server.js');
      
      // Create HTTP server with Express
      this.httpServer = await createHttpServer({
        port: this.config.httpPort,
        host: this.config.httpHost || '0.0.0.0',
        apiKeys: this.config.apiKeys || [],
        allowedIps: this.config.allowedIps || ['*'],
        enableCors: this.config.enableCors ?? true,
        corsOrigin: this.config.corsOrigin || '*',
        onSseConnection: (sessionId: string, transport: SSEServerTransport) => {
          this.handleSseConnection(sessionId, transport);
        }
      });
      
      console.log(`✓ HTTP/SSE transport initialized on port ${this.config.httpPort}`);
    } catch (error) {
      console.error('Failed to initialize SSE transport:', error);
      throw error;
    }
  }
  
  /**
   * Handle new SSE connection
   */
  private async handleSseConnection(sessionId: string, transport: SSEServerTransport): Promise<void> {
    try {
      await this.addTransport(`sse-${sessionId}`, transport, 'sse', sessionId);
      console.log(`New SSE connection established: ${sessionId}`);
      
      // Set up activity tracking
      this.emit('connection', {
        type: 'sse',
        sessionId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error(`Failed to handle SSE connection ${sessionId}:`, error);
      this.emit('error', {
        type: 'sse',
        sessionId,
        error
      });
    }
  }
  
  /**
   * Add a transport to the manager
   */
  private async addTransport(
    name: string, 
    transport: Transport, 
    type: 'stdio' | 'sse',
    sessionId?: string
  ): Promise<void> {
    // Connect transport to server
    await this.server.connect(transport);
    
    // Store transport and info
    this.transports.set(name, transport);
    this.transportInfo.set(name, {
      name,
      type,
      status: 'connected',
      connectedAt: new Date(),
      lastActivity: new Date(),
      sessionId
    });
    
    // Set up cleanup on transport close
    transport.onclose = () => {
      this.removeTransport(name);
    };
  }
  
  /**
   * Remove a transport
   */
  private removeTransport(name: string): void {
    this.transports.delete(name);
    const info = this.transportInfo.get(name);
    if (info) {
      info.status = 'disconnected';
      this.emit('disconnection', {
        type: info.type,
        sessionId: info.sessionId,
        timestamp: new Date()
      });
    }
    console.log(`Transport disconnected: ${name}`);
  }
  
  /**
   * Get current transport statistics
   */
  getStats(): {
    totalConnections: number;
    stdioConnections: number;
    sseConnections: number;
    connections: TransportInfo[];
  } {
    const connections = Array.from(this.transportInfo.values())
      .filter(info => info.status === 'connected');
    
    return {
      totalConnections: connections.length,
      stdioConnections: connections.filter(c => c.type === 'stdio').length,
      sseConnections: connections.filter(c => c.type === 'sse').length,
      connections
    };
  }
  
  /**
   * Shutdown all transports
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down TransportManager...');
    
    // Close all transports
    for (const [name, transport] of this.transports) {
      try {
        await transport.close();
      } catch (error) {
        console.error(`Error closing transport ${name}:`, error);
      }
    }
    
    // Stop HTTP server if running
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          console.log('HTTP server closed');
          resolve();
        });
      });
    }
    
    this.transports.clear();
    this.transportInfo.clear();
    console.log('TransportManager shutdown complete');
  }
}