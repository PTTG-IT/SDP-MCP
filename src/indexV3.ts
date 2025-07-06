#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server V3 - Full Rate Limiting System
 * 
 * Complete implementation with:
 * - Centralized rate limiting
 * - Background token management
 * - Circuit breaker protection
 * - Real-time monitoring
 * - Token analytics
 * - Cross-instance coordination
 * - Priority request queue
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
import { AuthManagerV2 } from './api/authV2.js';
import { RateLimitSystem } from './integration/rateLimitIntegration.js';
import { testConnection } from './db/config.js';
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

// Global instances
let client: SDPClientV2 | null = null;
let rateLimitSystem: RateLimitSystem | null = null;

async function initializeServices() {
  console.log('Initializing Service Desk Plus MCP Server V3...');
  console.log('===========================================');
  
  // Test database connection
  const dbAvailable = await testDatabaseConnection();
  
  // Create client and auth manager
  client = new SDPClientV2(config);
  const authManager = (client as any).authManager as AuthManagerV2;
  
  // Initialize authentication
  try {
    await client.initialize();
    console.log('✓ Authentication successful');
  } catch (error) {
    console.error('✗ Authentication failed:', error);
    process.exit(1);
  }
  
  // Create rate limit system with all features
  const systemOptions = {
    enableMonitoring: process.env.SDP_ENABLE_MONITORING !== 'false',
    enableAnalytics: process.env.SDP_ENABLE_ANALYTICS === 'true',
    enableQueue: process.env.SDP_ENABLE_QUEUE === 'true',
    enableCoordination: dbAvailable && process.env.SDP_ENABLE_COORDINATION === 'true',
    monitoringInterval: parseInt(process.env.SDP_MONITORING_INTERVAL || '60000'),
    queueOptions: {
      maxConcurrent: parseInt(process.env.SDP_QUEUE_CONCURRENT || '5'),
      maxRetries: parseInt(process.env.SDP_QUEUE_RETRIES || '3')
    }
  };
  
  rateLimitSystem = new RateLimitSystem(authManager, config, systemOptions);
  
  // Start the system
  await rateLimitSystem.start();
  
  console.log('\n✓ Rate limit system initialized');
  console.log(`  • Monitoring: ${systemOptions.enableMonitoring ? 'Enabled' : 'Disabled'}`);
  console.log(`  • Analytics: ${systemOptions.enableAnalytics ? 'Enabled' : 'Disabled'}`);
  console.log(`  • Request Queue: ${systemOptions.enableQueue ? 'Enabled' : 'Disabled'}`);
  console.log(`  • Multi-Instance: ${systemOptions.enableCoordination ? 'Enabled' : 'Disabled'}`);
  
  // Set up periodic reporting
  if (systemOptions.enableAnalytics) {
    setInterval(async () => {
      const report = await rateLimitSystem!.generateReport(1); // Last 24 hours
      console.log('\n' + report);
    }, 3600000); // Every hour
  }
  
  return client;
}

async function testDatabaseConnection(): Promise<boolean> {
  if (process.env.SDP_USE_DB_TOKENS !== 'true') {
    console.log('ℹ Database features disabled');
    return false;
  }
  
  console.log('Testing database connection...');
  const connected = await testConnection();
  
  if (connected) {
    console.log('✓ Database connected');
  } else {
    console.log('✗ Database unavailable - running with limited features');
  }
  
  return connected;
}

async function main() {
  // Initialize services
  const sdpClient = await initializeServices();
  
  // Create MCP server
  const server = new Server(
    {
      name: 'service-desk-plus-v3',
      vendor: 'ManageEngine',
      version: '3.0.0',
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
    
    // Handle special system tools
    if (name === 'rate_limit_status') {
      const status = await rateLimitSystem!.getStatus();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }]
      };
    }
    
    if (name === 'token_forecast') {
      const forecast = await rateLimitSystem!.getForecast(24);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(forecast, null, 2)
        }]
      };
    }
    
    // Handle regular tools
    try {
      const handler = createToolHandler(name, sdpClient);
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
    console.log('\n\nShutting down gracefully...');
    
    try {
      // Generate final report
      if (rateLimitSystem && process.env.SDP_ENABLE_ANALYTICS === 'true') {
        const report = await rateLimitSystem.generateReport(1);
        console.log('\nFinal Report:\n' + report);
      }
      
      // Stop rate limit system
      if (rateLimitSystem) {
        await rateLimitSystem.stop();
      }
      
      console.log('✓ Shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  });
  
  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('\n========================================');
  console.log('Service Desk Plus MCP Server V3 Running');
  console.log('========================================');
  console.log('Rate Limiting: No more than 1 token refresh every 3 minutes');
  console.log('OAuth Limit: Maximum 10 tokens per 10 minutes');
  console.log('API Limit: 60 requests per minute');
  console.log('\nPress Ctrl+C to stop');
  
  // Display initial status after startup
  setTimeout(async () => {
    const status = await rateLimitSystem!.getStatus();
    console.log('\nSystem Status:');
    console.log(`• Token Refresh: ${status.coordinator.tokenRefresh.canRefreshNow ? 'Available' : 'Blocked'}`);
    console.log(`• Circuit Breaker: ${status.coordinator.circuitBreaker.state}`);
    if (status.instance) {
      console.log(`• Instance Role: ${status.instance.role}`);
    }
    if (status.analytics) {
      console.log(`• Token Health: ${status.analytics.currentHealth} (${status.analytics.healthScore}/100)`);
    }
  }, 3000);
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});