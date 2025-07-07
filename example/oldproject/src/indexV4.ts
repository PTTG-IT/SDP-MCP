#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server V4 - Multi-Transport Support
 * 
 * Supports simultaneous connections via:
 * - Stdio (for local Claude Desktop)
 * - SSE/HTTP (for remote clients)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TransportManager, TransportConfig } from './transport/manager.js';
import { createToolHandler } from './mcp/handlers.js';
import { getClientV2 } from './utils/clientFactoryV2.js';
import { SDPConfig } from './api/types.js';
import { testConnection } from './db/config.js';
import { RateLimitSystem } from './integration/rateLimitIntegration.js';
import { tools, toolSchemas } from './mcp/tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Global instances
let server: Server;
let transportManager: TransportManager;
let rateLimitSystem: RateLimitSystem | null = null;

/**
 * Initialize services
 */
async function initializeServices(client: any): Promise<void> {
  // Initialize database if enabled
  if (process.env.SDP_USE_DB_TOKENS === 'true') {
    console.log('Testing database connection...');
    const dbConnected = await testConnection();
    if (dbConnected) {
      console.log('✓ Database connected');
      // Database tables are already ensured by rate limit system
    } else {
      console.log('✗ Database not available - continuing without persistence');
    }
  }

  // Initialize rate limit system
  console.log('Starting integrated rate limit system...');
  rateLimitSystem = new RateLimitSystem(
    client.authManager,
    {
      clientId: process.env.SDP_CLIENT_ID!,
      clientSecret: process.env.SDP_CLIENT_SECRET!,
      instanceName: process.env.SDP_INSTANCE_NAME!,
      authCode: process.env.SDP_AUTH_CODE || '',
      baseUrl: process.env.SDP_BASE_URL
    },
    {
      enableMonitoring: process.env.SDP_ENABLE_MONITORING === 'true',
      enableAnalytics: process.env.SDP_ENABLE_ANALYTICS === 'true',
      enableQueue: process.env.SDP_ENABLE_QUEUE === 'true',
      enableCoordination: process.env.SDP_ENABLE_COORDINATION === 'true'
    }
  );

  await rateLimitSystem.start();
  console.log('Rate limit system started successfully');

  // Display system status
  const status = await rateLimitSystem.getStatus();
  console.log(`
=== Rate Limit System Status ===
Token Refresh: ${status.coordinator.tokenRefresh.canRefreshNow ? 'AVAILABLE' : 'BLOCKED'}
Circuit Breaker: ${status.coordinator.circuitBreaker.state}
================================
`);

  console.log(`
✓ Rate limit system initialized
  • Monitoring: ${process.env.SDP_ENABLE_MONITORING === 'true' ? 'Enabled' : 'Disabled'}
  • Analytics: ${process.env.SDP_ENABLE_ANALYTICS === 'true' ? 'Enabled' : 'Disabled'}
  • Request Queue: ${process.env.SDP_ENABLE_QUEUE === 'true' ? 'Enabled' : 'Disabled'}
  • Multi-Instance: ${process.env.SDP_ENABLE_COORDINATION === 'true' ? 'Enabled' : 'Disabled'}
`);
}

/**
 * Configure transport based on environment
 */
function getTransportConfig(): TransportConfig {
  const mode = process.env.SDP_TRANSPORT_MODE || 'stdio';
  
  // Parse API keys from environment
  const apiKeys = process.env.SDP_API_KEYS 
    ? process.env.SDP_API_KEYS.split(',').map(k => k.trim()).filter(k => k)
    : [];
  
  // Parse allowed IPs
  const allowedIps = process.env.SDP_ALLOWED_IPS
    ? process.env.SDP_ALLOWED_IPS.split(',').map(ip => ip.trim())
    : ['*'];
  
  return {
    mode: mode as 'stdio' | 'sse' | 'multi',
    httpPort: parseInt(process.env.SDP_HTTP_PORT || '3000'),
    httpHost: process.env.SDP_HTTP_HOST || '0.0.0.0',
    apiKeys,
    allowedIps,
    enableCors: process.env.SDP_ENABLE_CORS !== 'false',
    corsOrigin: process.env.SDP_CORS_ORIGIN || '*'
  };
}

/**
 * Main server initialization
 */
async function main() {
  console.log('Initializing Service Desk Plus MCP Server V4...');
  console.log('===========================================');
  
  try {
    // Create client configuration
    const config: SDPConfig = {
      clientId: process.env.SDP_CLIENT_ID!,
      clientSecret: process.env.SDP_CLIENT_SECRET!,
      baseUrl: process.env.SDP_BASE_URL || '',
      instanceName: process.env.SDP_INSTANCE_NAME!,
      authCode: process.env.SDP_AUTH_CODE || ''
    };

    // Initialize V2 client with no automatic token refresh
    const client = await getClientV2(config);
    console.log('✓ Authentication successful');

    // Initialize services (rate limiting, database, etc.)
    await initializeServices(client);

    // Create MCP server
    server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'service-desk-plus-v4',
        version: '4.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(toolSchemas[tool.name]),
        })),
      };
    });

    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        const handler = createToolHandler(name, client);
        const result = await handler(args || {});
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            },
          ],
        };
      }
    });

    // Get transport configuration
    const transportConfig = getTransportConfig();
    
    // Create and initialize transport manager
    transportManager = new TransportManager(server, transportConfig);
    
    // Set up transport event handlers
    transportManager.on('connection', (info) => {
      console.log(`New ${info.type} connection${info.sessionId ? ` (${info.sessionId})` : ''}`);
    });
    
    transportManager.on('disconnection', (info) => {
      console.log(`${info.type} disconnection${info.sessionId ? ` (${info.sessionId})` : ''}`);
    });
    
    transportManager.on('error', (error) => {
      console.error('Transport error:', error);
    });
    
    // Initialize transports
    await transportManager.initialize();

    console.log('\n========================================');
    console.log('Service Desk Plus MCP Server V4 Running');
    console.log('========================================');
    console.log(`Transport Mode: ${transportConfig.mode.toUpperCase()}`);
    
    if (transportConfig.mode !== 'stdio') {
      console.log(`HTTP/SSE Endpoint: http://${transportConfig.httpHost}:${transportConfig.httpPort}/sse`);
      console.log(`API Keys: ${transportConfig.apiKeys?.length || 0} configured`);
    }
    
    console.log('\nRate Limiting:');
    console.log('• No more than 1 token refresh every 3 minutes');
    console.log('• Maximum 10 tokens per 10 minutes');
    console.log('• 60 API requests per minute');
    console.log('\nPress Ctrl+C to stop');

    // Display transport stats periodically
    if (transportConfig.mode === 'multi' || transportConfig.mode === 'sse') {
      setInterval(() => {
        const stats = transportManager.getStats();
        if (stats.totalConnections > 0) {
          console.log(`\n[Transport Stats] Total: ${stats.totalConnections} | Stdio: ${stats.stdioConnections} | SSE: ${stats.sseConnections}`);
        }
      }, 30000); // Every 30 seconds
    }

    // Display rate limit status periodically
    setInterval(async () => {
      if (rateLimitSystem) {
        const status = await rateLimitSystem.getStatus();
        console.log(`\n[Rate Limit] Token Refresh: ${status.coordinator.tokenRefresh.canRefreshNow ? 'Available' : `Blocked (${Math.ceil((new Date(status.coordinator.tokenRefresh.nextAllowedRefresh).getTime() - Date.now()) / 60000)}m)`} | Circuit: ${status.coordinator.circuitBreaker.state}`);
      }
    }, 60000); // Every minute

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nShutting down server...');
  
  try {
    // Stop rate limit system
    if (rateLimitSystem) {
      await rateLimitSystem.stop();
    }
    
    // Shutdown transport manager
    if (transportManager) {
      await transportManager.shutdown();
    }
    
    console.log('Server shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});