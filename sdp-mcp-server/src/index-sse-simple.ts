#!/usr/bin/env node

/**
 * Simplified SSE Server for Service Desk Plus MCP
 * Based on the working implementation from src/mcp-sse-sdp-integrated.js
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import dotenv from 'dotenv';
import { logger } from './monitoring/simpleLogging.js';
import { SDPClient } from './sdp/simpleClient.js';
import { getSimpleConfig } from './utils/simpleConfig.js';

// Load environment variables
dotenv.config();

// Get simple config
const config = getSimpleConfig();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize SDP client (simplified for now - single tenant)
const sdpClient = new SDPClient({
  baseUrl: config.sdp.baseUrl,
  instanceName: config.sdp.instanceName,
  clientId: process.env.SDP_OAUTH_CLIENT_ID!,
  clientSecret: process.env.SDP_OAUTH_CLIENT_SECRET!,
  refreshToken: process.env.SDP_OAUTH_REFRESH_TOKEN!,
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'sdp-mcp-server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  logger.info('New SSE connection established');
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  
  // Initialize MCP server for this connection
  const server = new Server(
    {
      name: "service-desk-plus",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Import tools and handlers
  const { tools } = await import('./server/tools/index.js');
  const { createSimpleToolHandler } = await import('./server/handlers/simpleToolHandler.js');

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.schema),
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      // Validate arguments
      const validatedArgs = tool.schema.parse(args);
      
      // Create and execute handler
      const handler = createSimpleToolHandler(name, sdpClient);
      const result = await handler(validatedArgs);
      
      return {
        content: [
          {
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      logger.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          { 
            type: "text", 
            text: `Error: ${error.message || 'Unknown error occurred'}` 
          }
        ],
        isError: true,
      };
    }
  });

  // Create SSE transport
  const transport = new SSEServerTransport('/sse', res);
  
  // Connect server to transport
  await server.connect(transport);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);
  
  // Handle client disconnect
  req.on('close', () => {
    logger.info('SSE connection closed');
    clearInterval(keepAlive);
    server.close();
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.server.port || 3456;
const HOST = config.server.host || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`🚀 SDP MCP Server (SSE) running at http://${HOST}:${PORT}`);
  logger.info(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  logger.info(`🏥 Health check: http://${HOST}:${PORT}/health`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('👋 Shutting down server...');
  process.exit(0);
});