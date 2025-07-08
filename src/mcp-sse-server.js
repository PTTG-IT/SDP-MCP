#!/usr/bin/env node

/**
 * MCP SSE Server for Service Desk Plus
 * Based on official @modelcontextprotocol/sdk documentation
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Store transports for each session
const transports = {
  sse: {}
};

// Server configuration
const PORT = process.env.SDP_HTTP_PORT || 3456;
const HOST = process.env.SDP_HTTP_HOST || '0.0.0.0';

// Define available tools
const tools = [
  {
    name: 'list_requests',
    description: 'List service desk requests',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status'
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 10
        }
      }
    }
  },
  {
    name: 'get_request',
    description: 'Get request details',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'Request ID'
        }
      },
      required: ['request_id']
    }
  },
  {
    name: 'create_request',
    description: 'Create new request',
    inputSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Request subject'
        },
        description: {
          type: 'string',
          description: 'Request description'
        }
      },
      required: ['subject']
    }
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sdp-mcp-server',
    transport: 'sse',
    sessions: Object.keys(transports.sse).length
  });
});

// SSE endpoint
app.get('/sse', async (req, res) => {
  console.log(`📡 New SSE connection from ${req.ip}`);
  
  // Create MCP server instance for this connection
  const server = new Server(
    {
      name: 'service-desk-plus',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.log('📋 Tools list requested');
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`🔧 Tool called: ${name}`);
    
    const tool = tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Mock responses for now
    let result;
    switch (name) {
      case 'list_requests':
        result = {
          requests: [
            { id: '1001', subject: 'Test Request 1', status: args.status || 'open' },
            { id: '1002', subject: 'Test Request 2', status: args.status || 'open' }
          ],
          total: 2
        };
        break;
      
      case 'get_request':
        result = {
          id: args.request_id,
          subject: `Request ${args.request_id}`,
          description: 'Sample request details',
          status: 'open'
        };
        break;
      
      case 'create_request':
        result = {
          id: Date.now().toString(),
          subject: args.subject,
          description: args.description || '',
          status: 'open',
          created: new Date().toISOString()
        };
        break;
      
      default:
        throw new Error(`Tool ${name} not implemented`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  });

  // Create SSE transport
  const transport = new SSEServerTransport('/messages', res);
  
  // Store transport by session ID
  transports.sse[transport.sessionId] = transport;
  console.log(`✅ SSE session created: ${transport.sessionId}`);
  
  // Clean up on disconnect
  res.on('close', () => {
    console.log(`👋 SSE session closed: ${transport.sessionId}`);
    delete transports.sse[transport.sessionId];
  });
  
  // Connect server to transport
  await server.connect(transport);
});

// Message endpoint for SSE
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  
  const transport = transports.sse[sessionId];
  
  if (!transport) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('Message handling error:', error);
    res.status(500).json({ error: 'Message handling failed' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    endpoints: {
      health: '/health',
      sse: '/sse',
      messages: '/messages'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const httpServer = app.listen(PORT, HOST, () => {
  console.log(`\n🚀 MCP SSE Server for Service Desk Plus`);
  console.log(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`📬 Message endpoint: http://${HOST}:${PORT}/messages`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
  console.log(`\n📝 Client configuration:`);
  console.log(JSON.stringify({
    mcpServers: {
      "service-desk-plus": {
        type: "sse",
        url: `http://studio:${PORT}/sse`,
        env: {
          SDP_CLIENT_ID: "your-client-id",
          SDP_CLIENT_SECRET: "your-client-secret"
        }
      }
    }
  }, null, 2));
  console.log('\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  httpServer.close(() => {
    process.exit(0);
  });
});