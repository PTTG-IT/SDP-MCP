#!/usr/bin/env node

/**
 * SSE Server for Service Desk Plus MCP
 * Provides HTTP/SSE transport for remote MCP clients
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Import configurations
const PORT = process.env.SDP_HTTP_PORT || 3456;
const HOST = process.env.SDP_HTTP_HOST || '0.0.0.0';

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'sdp-mcp-server',
    transport: 'sse',
    version: '1.0.0'
  });
});

// Main SSE endpoint
app.get('/sse', async (req, res) => {
  console.log(`📡 New SSE connection from: ${req.ip} at ${new Date().toISOString()}`);
  
  // Extract client credentials from headers or query params
  const clientId = req.headers['x-sdp-client-id'] || req.query.client_id;
  const clientSecret = req.headers['x-sdp-client-secret'] || req.query.client_secret;
  
  if (!clientId || !clientSecret) {
    console.error('❌ Missing client credentials');
    res.status(401).json({ error: 'Missing SDP_CLIENT_ID or SDP_CLIENT_SECRET' });
    return;
  }
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  
  // Send initial connection event
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

  // Define available tools
  const tools = [
    {
      name: 'list_requests',
      description: 'List service desk requests with filters',
      inputSchema: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            description: 'Filter by status (e.g., open, closed, pending)' 
          },
          limit: { 
            type: 'number', 
            description: 'Maximum number of results to return',
            default: 10
          }
        }
      }
    },
    {
      name: 'get_request',
      description: 'Get details of a specific request',
      inputSchema: {
        type: 'object',
        properties: {
          request_id: { 
            type: 'string', 
            description: 'The ID of the request to retrieve',
            required: true
          }
        },
        required: ['request_id']
      }
    },
    {
      name: 'create_request',
      description: 'Create a new service desk request',
      inputSchema: {
        type: 'object',
        properties: {
          subject: { 
            type: 'string', 
            description: 'Subject of the request',
            required: true
          },
          description: { 
            type: 'string', 
            description: 'Detailed description of the request' 
          },
          priority: { 
            type: 'string', 
            description: 'Priority level (low, medium, high)',
            default: 'medium'
          }
        },
        required: ['subject']
      }
    },
    {
      name: 'update_request',
      description: 'Update an existing request',
      inputSchema: {
        type: 'object',
        properties: {
          request_id: { 
            type: 'string', 
            description: 'ID of the request to update',
            required: true
          },
          status: { 
            type: 'string', 
            description: 'New status for the request' 
          },
          notes: { 
            type: 'string', 
            description: 'Additional notes or updates' 
          }
        },
        required: ['request_id']
      }
    }
  ];

  // Register list tools handler
  server.setRequestHandler('tools/list', async () => {
    console.log('📋 Listing available tools');
    return { tools };
  });

  // Register call tool handler
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`🔧 Tool called: ${name} with args:`, args);
    
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ 
          type: "text", 
          text: `Error: Tool '${name}' not found. Available tools: ${tools.map(t => t.name).join(', ')}` 
        }],
        isError: true
      };
    }

    try {
      // Here you would integrate with the actual Service Desk Plus API
      // For now, return mock responses
      let result;
      
      switch (name) {
        case 'list_requests':
          result = {
            requests: [
              {
                id: '12345',
                subject: 'Sample Request 1',
                status: args.status || 'open',
                created: new Date().toISOString()
              },
              {
                id: '12346',
                subject: 'Sample Request 2',
                status: args.status || 'open',
                created: new Date().toISOString()
              }
            ],
            total: 2,
            limit: args.limit || 10
          };
          break;
          
        case 'get_request':
          result = {
            id: args.request_id,
            subject: `Request ${args.request_id}`,
            description: 'This is a sample request retrieved from the system',
            status: 'open',
            priority: 'medium',
            created: new Date().toISOString()
          };
          break;
          
        case 'create_request':
          result = {
            id: Math.random().toString(36).substr(2, 9),
            subject: args.subject,
            description: args.description || '',
            priority: args.priority || 'medium',
            status: 'open',
            created: new Date().toISOString(),
            message: 'Request created successfully'
          };
          break;
          
        case 'update_request':
          result = {
            id: args.request_id,
            status: args.status || 'updated',
            notes: args.notes || '',
            updated: new Date().toISOString(),
            message: 'Request updated successfully'
          };
          break;
          
        default:
          throw new Error(`Handler not implemented for tool: ${name}`);
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
      
    } catch (error) {
      console.error(`❌ Error in tool ${name}:`, error);
      return {
        content: [{ 
          type: "text", 
          text: `Error: ${error.message}` 
        }],
        isError: true
      };
    }
  });

  // Create SSE transport
  const transport = new SSEServerTransport('/sse', res);
  
  // Connect server to transport
  await server.connect(transport);
  console.log('✅ MCP server connected via SSE');
  
  // Keep-alive interval
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found', 
    endpoints: {
      health: '/health',
      sse: '/sse'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const httpServer = app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Service Desk Plus MCP Server (SSE) is running!`);
  console.log(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  console.log(`\n🔌 Available network addresses:`);
  console.log(`   - http://localhost:${PORT}/sse`);
  console.log(`   - http://studio:${PORT}/sse`);
  console.log(`   - http://studio.pttg.loc:${PORT}/sse`);
  console.log(`   - http://192.168.2.10:${PORT}/sse`);
  console.log(`   - http://10.212.0.7:${PORT}/sse`);
  console.log(`\n📝 Configure your MCP client with:`);
  console.log(`   {`);
  console.log(`     "mcpServers": {`);
  console.log(`       "service-desk-plus": {`);
  console.log(`         "type": "sse",`);
  console.log(`         "url": "http://studio:${PORT}/sse",`);
  console.log(`         "env": {`);
  console.log(`           "SDP_CLIENT_ID": "your-client-id",`);
  console.log(`           "SDP_CLIENT_SECRET": "your-client-secret"`);
  console.log(`         }`);
  console.log(`       }`);
  console.log(`     }`);
  console.log(`   }`);
  console.log(`\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received SIGTERM, shutting down...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});