#!/usr/bin/env node

/**
 * SSE Server for Service Desk Plus MCP
 * This is a JavaScript version that doesn't require TypeScript compilation
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Try to load the compiled modules, fall back to a simple implementation
let tools, toolSchemas, createToolHandler, getClient;

try {
  // Try to load from compiled oldproject
  const toolsModule = require('../oldproject/dist/mcp/tools.js');
  tools = toolsModule.tools;
  toolSchemas = toolsModule.toolSchemas;
  createToolHandler = require('../oldproject/dist/mcp/handlers.js').createToolHandler;
  getClient = require('../oldproject/dist/utils/clientFactory.js').getClient;
} catch (error) {
  console.log('⚠️  Compiled modules not found, using fallback implementation');
  
  // Fallback: Define minimal tools for testing
  tools = [
    {
      name: 'list_requests',
      description: 'List service desk requests'
    },
    {
      name: 'get_request',
      description: 'Get a specific request by ID'
    }
  ];
  
  // Simple schemas
  toolSchemas = {
    list_requests: {
      parse: (args) => args
    },
    get_request: {
      parse: (args) => {
        if (!args.request_id) throw new Error('request_id is required');
        return args;
      }
    }
  };
  
  // Dummy handler for testing
  createToolHandler = (name) => {
    return async (args) => {
      return `Tool ${name} called with args: ${JSON.stringify(args)}`;
    };
  };
  
  // Dummy client
  getClient = () => ({});
}

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Get API client
const sdpClient = getClient();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'sdp-mcp-server',
    mode: 'sse',
    tools: tools.map(t => t.name)
  });
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  console.log('📡 New SSE connection from:', req.ip);
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // Send initial connection message
  res.write('data: {"type":"connection","status":"connected"}\n\n');
  
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

  // Register list tools handler
  server.setRequestHandler('tools/list', async () => {
    console.log('📋 Listing tools');
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      })),
    };
  });

  // Register call tool handler
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`🔧 Calling tool: ${name}`);
    
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      // Validate arguments if schema exists
      const schema = toolSchemas[name];
      const validatedArgs = schema ? schema.parse(args) : args;
      
      // Create and execute handler
      const handler = createToolHandler(name, sdpClient);
      const result = await handler(validatedArgs);
      
      return {
        content: [
          {
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`❌ Tool error:`, error);
      return {
        content: [
          { 
            type: "text", 
            text: `Error: ${error.message}` 
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
  console.log('✅ MCP server connected via SSE');
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('👋 SSE connection closed');
    clearInterval(keepAlive);
    server.close();
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.SDP_HTTP_PORT || 3456;
const HOST = process.env.SDP_HTTP_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 SDP MCP Server (SSE) is running!`);
  console.log(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  console.log(`\n🔌 Configure your MCP client with:`);
  console.log(`   URL: http://studio:${PORT}/sse`);
  console.log(`   Type: sse\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});