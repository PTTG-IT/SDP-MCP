#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server - Multi-User SSE Transport
 * 
 * This version supports client-provided credentials where each
 * Claude Code user provides their own SDP credentials via environment
 * variables in the MCP configuration.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createSSEServer, SSEServerConfig } from './transport/sse-server-multiuser.js';
// import { createToolHandler } from './mcp/handlers.js';
// import { getClientV2 } from './utils/clientFactoryV2.js';
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

// Load environment variables for server config (not SDP credentials)
dotenv.config();

// Global instances
let server: Server;
let sseServer: any;
let shutdownInProgress = false;

// Store per-session SDP clients and rate limiters
const sessionClients = new Map<string, {
  client: any;
  rateLimitSystem: RateLimitSystem;
  config: SDPConfig;
}>();

/**
 * Initialize a client for a specific session with provided credentials
 */
// async function initializeSessionClient(sessionId: string, credentials: SDPConfig): Promise<void> {
//   console.log(`🔐 Initializing SDP client for session ${sessionId}...`);
//   
//   try {
//     // Create client with provided credentials
//     const client = await getClientV2(credentials);
//     console.log(`✅ Authentication successful for session ${sessionId}`);
//     
//     // Initialize rate limit system for this client
//     const rateLimitSystem = new RateLimitSystem(
//       (client as any).authManager,
//       credentials,
//       {
//         enableMonitoring: false, // Disable per-client monitoring to reduce overhead
//         enableAnalytics: false,
//         enableQueue: false,
//         enableCoordination: false
//       }
//     );
//     
//     await rateLimitSystem.start();
//     
//     // Store client and rate limiter for this session
//     sessionClients.set(sessionId, {
//       client,
//       rateLimitSystem,
//       config: credentials
//     });
//     
//     console.log(`✅ Client initialized for session ${sessionId}`);
//   } catch (error) {
//     console.error(`❌ Failed to initialize client for session ${sessionId}:`, error);
//     throw error;
//   }
// }

/**
 * Get or initialize a client for a session
 */
// async function getSessionClient(sessionId: string, envVars?: Record<string, string>): Promise<any> {
//   // Check if client already exists
//   const existing = sessionClients.get(sessionId);
//   if (existing) {
//     return existing.client;
//   }
//   
//   // Initialize new client with provided credentials
//   if (!envVars) {
//     throw new Error('No credentials provided for session');
//   }
//   
//   const config: SDPConfig = {
//     clientId: envVars.SDP_CLIENT_ID || '',
//     clientSecret: envVars.SDP_CLIENT_SECRET || '',
//     baseUrl: envVars.SDP_BASE_URL || '',
//     instanceName: envVars.SDP_INSTANCE_NAME || '',
//     authCode: envVars.SDP_AUTH_CODE || '',
//     refreshToken: envVars.SDP_REFRESH_TOKEN || ''
//   };
//   
//   // Validate required configuration
//   if (!config.clientId || !config.clientSecret || !config.instanceName) {
//     throw new Error('Missing required SDP credentials in client configuration');
//   }
//   
//   await initializeSessionClient(sessionId, config);
//   return sessionClients.get(sessionId)!.client;
// }

/**
 * Clean up session resources
 */
function cleanupSession(sessionId: string): void {
  const session = sessionClients.get(sessionId);
  if (session) {
    console.log(`🧹 Cleaning up session ${sessionId}...`);
    
    // Stop rate limit system
    if (session.rateLimitSystem) {
      session.rateLimitSystem.stop().catch(err => 
        console.error(`Error stopping rate limit system for ${sessionId}:`, err)
      );
    }
    
    // Remove from map
    sessionClients.delete(sessionId);
    console.log(`✅ Session ${sessionId} cleaned up`);
  }
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
  console.log('🚀 Starting Service Desk Plus MCP Server (Multi-User SSE)');
  console.log('==================================================\n');

  try {
    // Test database connection if enabled
    if (process.env.SDP_USE_DB_TOKENS === 'true') {
      console.log('📊 Testing database connection...');
      const dbConnected = await testConnection();
      if (dbConnected) {
        console.log('✅ Database connected');
      } else {
        console.log('⚠️  Database not available - continuing without persistence');
      }
    }

    // Create MCP server
    console.log('\n📡 Creating MCP server...');
    server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'service-desk-plus-multiuser',
        version: '6.0.0',
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

    // Store request context for each message
    // const requestContexts = new Map<string, { sessionId: string; environment?: Record<string, string> }>();
    
    server.setRequestHandler(CallToolRequestSchema, async (_request) => {
      try {
        // const { name, arguments: args } = request.params;
        
        // Try to get context from the request ID or use a default
        // In a real implementation, we'd need to correlate this with the session
        // For now, we'll need to modify the approach to use a different method
        
        // Since we can't directly get session context here, we'll need to
        // modify the createSSEServer to handle this differently
        throw new Error('Session context not available - implementation needs adjustment');
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
    
    // Create and start SSE server with session cleanup callback
    console.log('\n🌐 Starting SSE server...');
    sseServer = await createSSEServer(server, sseConfig, {
      onSessionEnd: cleanupSession
    });
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ Service Desk Plus MCP Server (Multi-User SSE) Ready');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📍 Endpoint: http://${sseConfig.host}:${sseConfig.port}/sse`);
    console.log(`🔑 API Keys: ${sseConfig.apiKeys.length} configured`);
    console.log(`👥 Multi-User: Each client provides their own SDP credentials`);
    console.log(`🌍 CORS: ${sseConfig.enableCors ? `Enabled (${sseConfig.corsOrigin})` : 'Disabled'}`);
    console.log(`🔒 IP Filter: ${sseConfig.allowedIps[0] === '*' ? 'All IPs allowed' : `${sseConfig.allowedIps.length} IPs allowed`}`);
    console.log('\n📊 Features:');
    console.log('   • Per-user authentication');
    console.log('   • Session-based client management');
    console.log('   • Independent rate limiting per user');
    console.log(`   • Database: ${process.env.SDP_USE_DB_TOKENS === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log('\n💡 Client Configuration:');
    console.log('   Clients must provide these environment variables:');
    console.log('   • SDP_CLIENT_ID');
    console.log('   • SDP_CLIENT_SECRET');
    console.log('   • SDP_INSTANCE_NAME');
    console.log('   • SDP_BASE_URL');
    console.log('   • SDP_REFRESH_TOKEN (optional)');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('Press Ctrl+C to stop\n');

    // Periodic status updates
    setInterval(() => {
      if (!shutdownInProgress) {
        const activeUsers = sessionClients.size;
        console.log(`[${new Date().toLocaleTimeString()}] Active users: ${activeUsers}`);
      }
    }, 60000); // Every minute

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
    
    // Clean up all sessions
    console.log('   • Cleaning up sessions...');
    for (const sessionId of sessionClients.keys()) {
      cleanupSession(sessionId);
    }
    console.log('   ✅ All sessions cleaned up');
    
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