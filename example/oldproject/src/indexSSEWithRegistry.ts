#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server - SSE Transport with User Registry
 * 
 * This version supports the API Key Mapping Service where users
 * authenticate with simple API keys (usr_*) that map to their
 * SDP credentials stored server-side.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createSSEServer, SSEServerConfig } from './transport/sse-server.js';
import { testConnection, getPool } from './db/config.js';
import { RateLimitSystem } from './integration/rateLimitIntegration.js';
import { UserRegistry } from './services/userRegistry.js';
import { tools, toolSchemas } from './mcp/tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createToolHandler } from './mcp/handlers.js';
import { getClientV2 } from './utils/clientFactoryV2.js';
import { SDPConfig } from './api/types.js';
import { validateEncryptionSetup } from './utils/encryption.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Global instances
let server: Server;
let sseServer: any;
let shutdownInProgress = false;
let userRegistry: UserRegistry | null = null;
let globalRateLimitSystem: RateLimitSystem | null = null;

// Store per-session SDP clients
const sessionClients = new Map<string, {
  client: any;
  config: SDPConfig;
}>();

/**
 * Initialize a client for a specific session with credentials
 */
async function initializeSessionClient(sessionId: string, credentials: SDPConfig): Promise<void> {
  console.log(`🔐 Initializing SDP client for session ${sessionId}...`);
  
  try {
    // Create client with provided credentials
    const client = await getClientV2(credentials);
    console.log(`✅ Authentication successful for session ${sessionId}`);
    
    // Store client for this session
    sessionClients.set(sessionId, {
      client,
      config: credentials
    });
    
    console.log(`✅ Client initialized for session ${sessionId}`);
  } catch (error) {
    console.error(`❌ Failed to initialize client for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get or initialize a client for a session
 */
async function getSessionClient(sessionId: string, credentials?: SDPConfig): Promise<any> {
  // Check if client already exists
  const existing = sessionClients.get(sessionId);
  if (existing) {
    return existing.client;
  }
  
  // Initialize new client with provided credentials
  if (!credentials) {
    throw new Error('No credentials provided for session');
  }
  
  await initializeSessionClient(sessionId, credentials);
  return sessionClients.get(sessionId)!.client;
}

/**
 * Clean up session resources
 */
function cleanupSession(sessionId: string): void {
  const session = sessionClients.get(sessionId);
  if (session) {
    console.log(`🧹 Cleaning up session ${sessionId}...`);
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
    console.warn('⚠️  No standard API keys configured! Users will authenticate with usr_* keys only');
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
    enableUserRegistry: true
  };
}

/**
 * Main server initialization
 */
async function main() {
  console.log('🚀 Starting Service Desk Plus MCP Server with User Registry');
  console.log('===========================================================\n');

  try {
    // Validate encryption setup
    console.log('🔐 Validating encryption setup...');
    if (!validateEncryptionSetup()) {
      throw new Error('Encryption validation failed. Check SDP_ENCRYPTION_KEY environment variable.');
    }
    console.log('✅ Encryption validated');

    // Test database connection
    console.log('\n📊 Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection required for user registry');
    }
    console.log('✅ Database connected');

    // Initialize user registry
    const pool = getPool();
    if (!pool) {
      throw new Error('Database pool not available');
    }

    // Initialize schema
    console.log('\n📋 Initializing user registry schema...');
    await UserRegistry.initializeSchema(pool);
    
    userRegistry = new UserRegistry(pool);
    console.log('✅ User registry initialized');

    // Initialize global rate limit system if configured
    if (process.env.SDP_USE_RATE_LIMIT === 'true') {
      // For user registry mode, we'll create a basic rate limit system
      // Individual users' rate limits are handled by their credentials
      const adminConfig: SDPConfig = {
        clientId: process.env.SDP_CLIENT_ID || '',
        clientSecret: process.env.SDP_CLIENT_SECRET || '',
        baseUrl: process.env.SDP_BASE_URL || '',
        instanceName: process.env.SDP_INSTANCE_NAME || '',
        authCode: process.env.SDP_AUTH_CODE || '',
        refreshToken: process.env.SDP_REFRESH_TOKEN || ''
      };
      
      // Only create if admin credentials are provided
      if (adminConfig.clientId && adminConfig.clientSecret) {
        console.log('\n⏱️  Initializing rate limit system...');
        globalRateLimitSystem = new RateLimitSystem(
          null as any, // Will be initialized later if needed
          adminConfig,
          {
            enableMonitoring: false,
            enableAnalytics: false,
            enableQueue: false,
            enableCoordination: false
          }
        );
        console.log('✅ Rate limit system initialized');
      }
    }

    // Create MCP server
    console.log('\n📡 Creating MCP server...');
    server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'service-desk-plus-registry',
        version: '7.0.0',
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

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      try {
        const { name, arguments: args } = request.params;
        
        // Get session context from extra metadata if available
        const sessionId = (extra as any)?.sessionId;
        const sessionCredentials = (extra as any)?.credentials;
        
        if (!sessionId || !sessionCredentials) {
          throw new Error('Session context not available - please reconnect');
        }
        
        // Get or create client for this session
        const client = await getSessionClient(sessionId, sessionCredentials);
        
        // Create tool handler with session-specific client
        const handler = createToolHandler(client);
        return await handler({ name, arguments: args });
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
    
    // Create and start SSE server with user registry
    console.log('\n🌐 Starting SSE server with user registry...');
    sseServer = await createSSEServer(server, sseConfig, globalRateLimitSystem, userRegistry);
    
    // Add session cleanup handler
    const originalClose = sseServer.close;
    sseServer.close = function(callback?: () => void) {
      // Clean up all sessions
      for (const sessionId of sessionClients.keys()) {
        cleanupSession(sessionId);
      }
      originalClose.call(this, callback);
    };
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✨ Service Desk Plus MCP Server Ready (User Registry Mode)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📍 Endpoint: http://${sseConfig.host}:${sseConfig.port}/sse`);
    console.log(`🔑 API Keys: ${sseConfig.apiKeys.length} standard + user registry keys`);
    console.log(`👥 User Registry: Enabled - users authenticate with usr_* keys`);
    console.log(`🔐 Encryption: Enabled - credentials stored securely`);
    console.log(`🌍 CORS: ${sseConfig.enableCors ? `Enabled (${sseConfig.corsOrigin})` : 'Disabled'}`);
    console.log(`🔒 IP Filter: ${sseConfig.allowedIps[0] === '*' ? 'All IPs allowed' : `${sseConfig.allowedIps.length} IPs allowed`}`);
    console.log('\n📊 Features:');
    console.log('   • API Key Mapping - simple usr_* keys map to SDP credentials');
    console.log('   • Secure credential storage with AES-256-GCM encryption');
    console.log('   • Per-user session management');
    console.log('   • Usage tracking and analytics');
    console.log('   • Database-backed persistence');
    console.log('\n💡 User Configuration:');
    console.log('   Users add to their .mcp.json:');
    console.log('   {');
    console.log('     "mcpServers": {');
    console.log('       "service-desk-plus": {');
    console.log('         "type": "sse",');
    console.log(`         "url": "http://${sseConfig.host}:${sseConfig.port}/sse",`);
    console.log('         "headers": {');
    console.log('           "X-API-Key": "usr_2KtY3Bz9F5X8vQ..."');
    console.log('         }');
    console.log('       }');
    console.log('     }');
    console.log('   }');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('Press Ctrl+C to stop\n');

    // Periodic status updates
    setInterval(() => {
      if (!shutdownInProgress) {
        const activeSessions = sessionClients.size;
        console.log(`[${new Date().toLocaleTimeString()}] Active sessions: ${activeSessions}`);
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
    
    // Stop rate limit system
    if (globalRateLimitSystem) {
      console.log('   • Stopping rate limit system...');
      await globalRateLimitSystem.stop();
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