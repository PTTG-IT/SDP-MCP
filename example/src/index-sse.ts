#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from 'zod-to-json-schema';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { tools, toolSchemas } from '../oldproject/src/mcp/tools.js';
import { createToolHandler } from '../oldproject/src/mcp/handlers.js';
import { SDPError, formatSDPError } from '../oldproject/src/utils/errors.js';
import { getClient } from '../oldproject/src/utils/clientFactory.js';
import { createWrappedToolHandler } from '../oldproject/src/mcp/toolWrapper.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Get singleton API client
const sdpClient = getClient();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sdp-mcp-server' });
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  console.log('New SSE connection established');
  
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
    
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    const schema = toolSchemas[name];
    if (!schema) {
      throw new Error(`Schema not found for tool: ${name}`);
    }

    try {
      // Validate arguments
      const validatedArgs = schema.parse(args);
      
      // Create and execute handler
      const wrappedHandler = createWrappedToolHandler(
        createToolHandler(name, sdpClient),
        sdpClient
      );
      
      const result = await wrappedHandler(validatedArgs);
      
      return {
        content: [
          {
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof SDPError) {
        const errorMessage = formatSDPError(error);
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true,
        };
      }
      throw error;
    }
  });

  // Create SSE transport
  const transport = new SSEServerTransport('/sse', res);
  
  // Connect server to transport
  await server.connect(transport);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE connection closed');
    server.close();
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.SDP_HTTP_PORT || 3456;
const HOST = process.env.SDP_HTTP_HOST || '0.0.0.0';

app.listen(PORT as number, HOST, () => {
  console.log(`🚀 SDP MCP Server (SSE) running at http://${HOST}:${PORT}`);
  console.log(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});