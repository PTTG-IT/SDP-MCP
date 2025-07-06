#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server V2
 * 
 * Key improvements:
 * - Centralized rate limiting with RateLimitCoordinator
 * - Background token management with TokenManager
 * - No token refresh in API calls
 * - Circuit breaker protection
 * - Real-time monitoring
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from 'zod-to-json-schema';
import { tools, toolSchemas } from './mcp/tools.js';
import { createToolHandler } from './mcp/handlers.js';
import { SDPClientV2 } from './api/clientV2.js';
import { TokenManager } from './api/tokenManager.js';
import { RateLimitMonitor } from './monitoring/rateLimitMonitor.js';
import { RateLimitStore } from './db/rateLimitStore.js';
import { getDbPool, testConnection } from './db/config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['SDP_CLIENT_ID', 'SDP_CLIENT_SECRET', 'SDP_INSTANCE_NAME'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these in your .env file');
  process.exit(1);
}

// Create configuration
const config = {
  clientId: process.env.SDP_CLIENT_ID!,
  clientSecret: process.env.SDP_CLIENT_SECRET!,
  instanceName: process.env.SDP_INSTANCE_NAME!,
  authCode: process.env.SDP_AUTH_CODE!,
  baseUrl: process.env.SDP_BASE_URL,
};

// Create singleton client factory
let client: SDPClientV2 | null = null;
let tokenManager: TokenManager | null = null;
let monitor: RateLimitMonitor | null = null;

export function getClient(): SDPClientV2 {
  if (!client) {
    client = new SDPClientV2(config);
  }
  return client;
}

export function getTokenManager(): TokenManager {
  if (!tokenManager) {
    const authManager = getClient()['authManager'];
    tokenManager = TokenManager.getInstance(authManager, config);
  }
  return tokenManager;
}

export function getRateLimitMonitor(): RateLimitMonitor {
  if (!monitor) {
    monitor = new RateLimitMonitor();
    monitor.setTokenManager(getTokenManager());
  }
  return monitor;
}

async function initializeServices() {
  console.log('Initializing Service Desk Plus MCP Server V2...');
  
  // Test database connection if enabled
  if (process.env.SDP_USE_DB_TOKENS === 'true') {
    console.log('Testing database connection...');
    const dbConnected = await testConnection();
    if (dbConnected) {
      console.log('Database connected successfully');
      
      // Ensure rate limit tables exist
      const rateLimitStore = new RateLimitStore();
      await rateLimitStore.ensureTables();
      console.log('Rate limit tables ready');
    } else {
      console.warn('Database connection failed - running without persistence');
    }
  }
  
  // Initialize client and authenticate
  const sdpClient = getClient();
  try {
    await sdpClient.initialize();
    console.log('Authentication successful');
  } catch (error) {
    console.error('Authentication failed:', error);
    process.exit(1);
  }
  
  // Start background token manager
  const tokenMgr = getTokenManager();
  await tokenMgr.start();
  console.log('Background token manager started');
  
  // Start monitoring if enabled
  if (process.env.SDP_ENABLE_MONITORING !== 'false') {
    const rateLimitMonitor = getRateLimitMonitor();
    rateLimitMonitor.start();
    
    // Listen for critical alerts
    rateLimitMonitor.on('alert', (alert) => {
      if (alert.level === 'critical') {
        console.error(`[CRITICAL ALERT] ${alert.type}: ${alert.message}`);
      } else {
        console.warn(`[WARNING] ${alert.type}: ${alert.message}`);
      }
    });
    
    console.log('Rate limit monitoring started');
  }
  
  return sdpClient;
}

async function main() {
  // Initialize services
  const client = await initializeServices();
  
  // Create MCP server
  const server = new Server(
    {
      name: 'service-desk-plus',
      vendor: 'ManageEngine',
      version: '2.0.0',
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
    const { name, arguments: args } = request.params;
    
    try {
      const handler = createToolHandler(name, client);
      const result = await handler(args);
      
      return {
        content: [
          {
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          },
        ],
      };
    }
  });
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    
    // Stop services
    const tokenMgr = getTokenManager();
    tokenMgr.stop();
    
    const monitor = getRateLimitMonitor();
    monitor?.stop();
    
    // Close database connection
    const pool = getDbPool();
    if (pool) {
      await pool.end();
    }
    
    process.exit(0);
  });
  
  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('Service Desk Plus MCP Server V2 is running');
  console.log('Rate limiting: Max 1 token refresh every 3 minutes');
  console.log(`Monitoring: ${process.env.SDP_ENABLE_MONITORING !== 'false' ? 'Enabled' : 'Disabled'}`);
  
  // Log initial status
  if (monitor) {
    setTimeout(() => {
      console.log('\n' + monitor!.formatSummary());
    }, 5000);
  }
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});