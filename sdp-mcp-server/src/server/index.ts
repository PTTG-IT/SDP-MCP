import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from './transport/sse.js';
import { TenantManager } from '../tenants/manager.js';
import { TokenManager } from '../auth/tokenManager.js';
import { createSDPClientFactory } from '../sdp/client.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger } from '../monitoring/auditLogger.js';
import { setCurrentTenantId } from '../tenants/context.js';
import { createToolRegistry } from './toolRegistry.js';
import { createConnectionManager } from './connectionManager.js';
import { authenticateClient } from './middleware/auth.js';
import { validateScopes } from './middleware/scopes.js';
import { trackUsage } from './middleware/usage.js';
import { errorHandler } from './middleware/errorHandler.js';
import type { ServerConfig } from './types.js';

/**
 * MCP Server for Service Desk Plus Cloud
 * Provides multi-tenant access to SDP API through MCP tools
 */
export class SDPMCPServer {
  private server: Server;
  private tenantManager: TenantManager;
  private tokenManager: TokenManager;
  private sdpClientFactory: ReturnType<typeof createSDPClientFactory>;
  private toolRegistry: ReturnType<typeof createToolRegistry>;
  private connectionManager: ReturnType<typeof createConnectionManager>;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    
    // Initialize managers
    this.tenantManager = new TenantManager();
    this.tokenManager = new TokenManager(this.tenantManager);
    this.sdpClientFactory = createSDPClientFactory(this.tokenManager, this.tenantManager);
    
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'service-desk-plus-mcp',
        vendor: 'sdp-mcp-server',
        version: '1.0.0',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
      {
        // Server options
      }
    );

    // Initialize tool registry and connection manager
    this.toolRegistry = createToolRegistry(this.server, this.sdpClientFactory);
    this.connectionManager = createConnectionManager();

    // Setup server handlers
    this.setupHandlers();
  }

  /**
   * Setup server request handlers
   */
  private setupHandlers(): void {
    // Handle tool list requests
    this.server.setRequestHandler('tools/list', async (request, extra) => {
      try {
        const tenantId = extra?.context?.tenantId;
        if (!tenantId) {
          throw new Error('No tenant context');
        }

        // Get tools available for tenant based on scopes
        const tools = await this.toolRegistry.getToolsForTenant(tenantId);
        
        return {
          tools,
        };
      } catch (error) {
        logger.error('Failed to list tools', { error });
        throw error;
      }
    });

    // Handle tool call requests
    this.server.setRequestHandler('tools/call', async (request, extra) => {
      const startTime = Date.now();
      const tenantId = extra?.context?.tenantId;
      
      try {
        if (!tenantId) {
          throw new Error('No tenant context');
        }

        // Set tenant context for this request
        setCurrentTenantId(tenantId);

        const { name, arguments: args } = request.params;

        // Log tool call
        await auditLogger.log({
          tenantId,
          eventType: `mcp.tool.call`,
          eventCategory: 'mcp',
          actorType: 'client',
          actorId: extra?.context?.clientId,
          action: name,
          result: 'pending',
          metadata: {
            tool: name,
            arguments: args,
          },
        });

        // Validate tool access
        const hasAccess = await this.toolRegistry.validateToolAccess(
          name,
          tenantId
        );

        if (!hasAccess) {
          throw new Error(`Access denied to tool: ${name}`);
        }

        // Execute tool
        const result = await this.toolRegistry.executeTool(name, args, {
          tenantId,
          clientId: extra?.context?.clientId,
        });

        // Log success
        const duration = Date.now() - startTime;
        await auditLogger.log({
          tenantId,
          eventType: `mcp.tool.success`,
          eventCategory: 'mcp',
          actorType: 'client',
          actorId: extra?.context?.clientId,
          action: name,
          result: 'success',
          metadata: {
            tool: name,
            duration,
          },
        });

        return result;
      } catch (error) {
        // Log error
        const duration = Date.now() - startTime;
        await auditLogger.log({
          tenantId: tenantId || 'unknown',
          eventType: `mcp.tool.error`,
          eventCategory: 'mcp',
          actorType: 'client',
          actorId: extra?.context?.clientId,
          action: request.params.name,
          result: 'error',
          errorCode: (error as any).code || 'UNKNOWN',
          errorMessage: (error as Error).message,
          metadata: {
            tool: request.params.name,
            duration,
          },
        });

        throw error;
      } finally {
        // Clear tenant context
        setCurrentTenantId(undefined);
      }
    });

    // Handle completion requests
    this.server.setRequestHandler('completion/complete', async (request, extra) => {
      const tenantId = extra?.context?.tenantId;
      if (!tenantId) {
        throw new Error('No tenant context');
      }

      // For now, return empty completions
      // This could be extended to provide context-aware completions
      return {
        completion: {
          values: [],
          total: 0,
          hasMore: false,
        },
      };
    });

    // Handle resource list requests (if needed in future)
    this.server.setRequestHandler('resources/list', async (request, extra) => {
      return {
        resources: [],
      };
    });

    // Handle prompt list requests (if needed in future)
    this.server.setRequestHandler('prompts/list', async (request, extra) => {
      return {
        prompts: [],
      };
    });
  }

  /**
   * Start the server with specified transport
   */
  async start(transport: 'stdio' | 'sse' = 'sse'): Promise<void> {
    logger.info('Starting SDP MCP Server', {
      transport,
      version: '1.0.0',
    });

    try {
      if (transport === 'stdio') {
        // Use stdio transport (for testing)
        const stdioTransport = new StdioServerTransport();
        await this.server.connect(stdioTransport);
        logger.info('Server started with stdio transport');
      } else {
        // Use SSE transport (production)
        const sseTransport = new SSEServerTransport({
          port: this.config.port || 3000,
          path: this.config.path || '/mcp',
          cors: this.config.cors,
          middleware: [
            authenticateClient(this.tenantManager),
            validateScopes(),
            trackUsage(),
            errorHandler(),
          ],
        });

        await sseTransport.start();
        await this.server.connect(sseTransport);
        
        logger.info('Server started with SSE transport', {
          port: this.config.port || 3000,
          path: this.config.path || '/mcp',
        });
      }

      // Register all tools
      await this.toolRegistry.registerAllTools();
      
      // Start connection manager
      this.connectionManager.start();

      logger.info('SDP MCP Server started successfully');
    } catch (error) {
      logger.error('Failed to start server', { error });
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    logger.info('Stopping SDP MCP Server');

    try {
      // Stop connection manager
      this.connectionManager.stop();

      // Close server
      await this.server.close();

      logger.info('SDP MCP Server stopped successfully');
    } catch (error) {
      logger.error('Error stopping server', { error });
      throw error;
    }
  }

  /**
   * Get server status
   */
  getStatus(): {
    running: boolean;
    connections: number;
    tenants: number;
    uptime: number;
  } {
    return {
      running: true, // TODO: Track actual state
      connections: this.connectionManager.getActiveConnections().length,
      tenants: this.connectionManager.getActiveTenants().length,
      uptime: process.uptime(),
    };
  }
}

/**
 * Create and configure SDP MCP Server
 */
export function createSDPMCPServer(config?: Partial<ServerConfig>): SDPMCPServer {
  const defaultConfig: ServerConfig = {
    port: parseInt(process.env.MCP_SERVER_PORT || '3000'),
    path: process.env.MCP_SERVER_PATH || '/mcp',
    cors: {
      origin: process.env.MCP_CORS_ORIGIN || '*',
      credentials: true,
    },
    maxConnections: parseInt(process.env.MCP_MAX_CONNECTIONS || '100'),
    heartbeatInterval: parseInt(process.env.MCP_HEARTBEAT_INTERVAL || '30000'),
  };

  return new SDPMCPServer({
    ...defaultConfig,
    ...config,
  });
}

// Export for use as module
export default SDPMCPServer;