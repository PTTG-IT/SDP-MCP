#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server - SSE Transport Only
 * 
 * Production-ready SSE server with:
 * - API key authentication
 * - Rate limiting
 * - Session management
 * - Health monitoring
 * - Graceful shutdown
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createSSEServer, SSEServerConfig } from './transport/sse-server.js';
import { createToolHandler } from './mcp/handlers.js';
import { getClientV2 } from './utils/clientFactoryV2.js';
import { SDPConfig } from './api/types.js';
import { testConnection } from './db/config.js';
import { RateLimitSystem } from './integration/rateLimitIntegration.js';
import { tools, toolSchemas } from './mcp/tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Global instances
let server: Server;
let sseServer: any;
let rateLimitSystem: RateLimitSystem | null = null;
let shutdownInProgress = false;

/**
 * Initialize database and services
 */
async function initializeServices(client: any): Promise<void> {
  // Database connection (optional but recommended)
  if (process.env.SDP_USE_DB_TOKENS === 'true') {
    console.log('📊 Testing database connection...');
    const dbConnected = await testConnection();
    if (dbConnected) {
      console.log('✅ Database connected');
    } else {
      console.log('⚠️  Database not available - continuing without persistence');
    }
  }

  // Initialize rate limit system
  console.log('🚦 Starting rate limit system...');
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
  
  const status = await rateLimitSystem.getStatus();
  console.log(`✅ Rate limit system initialized`);
  console.log(`   • Token refresh: ${status.coordinator.tokenRefresh.canRefreshNow ? 'Available' : 'Blocked'}`);
  console.log(`   • Circuit breaker: ${status.coordinator.circuitBreaker.state}`);
}

/**
 * Configure SSE server from environment
 */
function getSSEConfig(): SSEServerConfig {
  // Parse API keys
  const apiKeys = process.env.SDP_API_KEYS
    ? process.env.SDP_API_KEYS.split(',').map(k => k.trim()).filter(k => k)
    : [];

  if (apiKeys.length === 0) {
    console.warn('⚠️  No API keys configured! Add SDP_API_KEYS to .env');
  }

  // Parse allowed IPs
  const allowedIps = process.env.SDP_ALLOWED_IPS
    ? process.env.SDP_ALLOWED_IPS.split(',').map(ip => ip.trim())
    : ['*'];

  return {
    port: parseInt(process.env.SDP_HTTP_PORT || '3456'),
    host: process.env.SDP_HTTP_HOST || '127.0.0.1',
    apiKeys,
    allowedIps,
    enableCors: process.env.SDP_ENABLE_CORS !== 'false',
    corsOrigin: process.env.SDP_CORS_ORIGIN || '*',
    maxConnections: parseInt(process.env.SDP_MAX_CONNECTIONS || '100'),
    sessionTimeout: parseInt(process.env.SDP_SESSION_TIMEOUT || '1800000'), // 30 minutes
    enableMetrics: process.env.SDP_ENABLE_METRICS === 'true',
    enableHealthCheck: true,
    rateLimitPerKey: parseInt(process.env.SDP_RATE_LIMIT_PER_KEY || '60'), // per minute
  };
}

/**
 * Main server initialization
 */
async function main() {
  console.log('🚀 Starting Service Desk Plus MCP Server (SSE-Only)');
  console.log('==================================================\n');

  try {
    // Create SDP client configuration
    const config: SDPConfig = {
      clientId: process.env.SDP_CLIENT_ID!,
      clientSecret: process.env.SDP_CLIENT_SECRET!,
      baseUrl: process.env.SDP_BASE_URL || '',
      instanceName: process.env.SDP_INSTANCE_NAME!,
      authCode: process.env.SDP_AUTH_CODE || ''
    };

    // Validate required configuration
    if (!config.clientId || !config.clientSecret || !config.instanceName) {
      throw new Error('Missing required configuration. Check SDP_CLIENT_ID, SDP_CLIENT_SECRET, and SDP_INSTANCE_NAME');
    }

    // Initialize SDP client
    console.log('🔐 Initializing SDP client...');
    const client = await getClientV2(config);
    console.log('✅ Authentication successful');

    // Initialize services
    await initializeServices(client);

    // Create MCP server
    console.log('\n📡 Creating MCP server...');
    server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'service-desk-plus-sse',
        version: '5.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(toolSchemas[tool.name]),
        })),
      };
    });

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

    // Get SSE configuration
    const sseConfig = getSSEConfig();
    
    // Create and start SSE server
    console.log('\n🌐 Starting SSE server...');
    sseServer = await createSSEServer(server, sseConfig, rateLimitSystem);
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ Service Desk Plus MCP Server (SSE) Ready');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📍 Endpoint: http://${sseConfig.host}:${sseConfig.port}/sse`);
    console.log(`🔑 API Keys: ${sseConfig.apiKeys.length} configured`);
    console.log(`🌍 CORS: ${sseConfig.enableCors ? `Enabled (${sseConfig.corsOrigin})` : 'Disabled'}`);
    console.log(`🔒 IP Filter: ${sseConfig.allowedIps[0] === '*' ? 'All IPs allowed' : `${sseConfig.allowedIps.length} IPs allowed`}`);
    console.log('\n📊 Rate Limiting:');
    console.log('   • Token refresh: Max 1 every 3 minutes');
    console.log('   • OAuth tokens: Max 10 per 10 minutes');
    console.log('   • API requests: 60 per minute');
    console.log(`   • Per API key: ${sseConfig.rateLimitPerKey} requests/minute`);
    console.log('\n🔧 Features:');
    console.log(`   • Database: ${process.env.SDP_USE_DB_TOKENS === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`   • Monitoring: ${process.env.SDP_ENABLE_MONITORING === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`   • Analytics: ${process.env.SDP_ENABLE_ANALYTICS === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`   • Metrics: ${sseConfig.enableMetrics ? 'Enabled' : 'Disabled'}`);
    console.log('\n💡 Endpoints:');
    console.log(`   • Health: http://${sseConfig.host}:${sseConfig.port}/health`);
    console.log(`   • SSE: http://${sseConfig.host}:${sseConfig.port}/sse`);
    console.log(`   • Sessions: http://${sseConfig.host}:${sseConfig.port}/sessions`);
    console.log(`   • Metrics: http://${sseConfig.host}:${sseConfig.port}/metrics`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('Press Ctrl+C to stop\n');

    // Periodic status updates
    if (process.env.SDP_ENABLE_MONITORING === 'true') {
      setInterval(async () => {
        if (rateLimitSystem && !shutdownInProgress) {
          const status = await rateLimitSystem.getStatus();
          const canRefresh = status.coordinator.tokenRefresh.canRefreshNow;
          const nextRefresh = status.coordinator.tokenRefresh.nextAllowedRefresh;
          const timeUntil = nextRefresh ? Math.ceil((new Date(nextRefresh).getTime() - Date.now()) / 60000) : 0;
          
          console.log(`[${new Date().toLocaleTimeString()}] Token: ${canRefresh ? '✅ Available' : `⏳ ${timeUntil}m`} | Circuit: ${status.coordinator.circuitBreaker.state}`);
        }
      }, 60000); // Every minute
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  
  console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop accepting new connections
    if (sseServer) {
      console.log('   • Closing SSE server...');
      await new Promise<void>((resolve) => {
        sseServer.close(() => {
          console.log('   ✅ SSE server closed');
          resolve();
        });
      });
    }
    
    // Stop rate limit system
    if (rateLimitSystem) {
      console.log('   • Stopping rate limit system...');
      await rateLimitSystem.stop();
      console.log('   ✅ Rate limit system stopped');
    }
    
    console.log('\n✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  shutdown('unhandledRejection');
});

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});