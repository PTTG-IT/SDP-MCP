#!/usr/bin/env node

/**
 * MCP TCP Server for Service Desk Plus
 * Works with socat for remote connections
 */

const net = require('net');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { Readable, Writable } = require('stream');

const PORT = process.env.MCP_TCP_PORT || 3456;
const HOST = process.env.MCP_TCP_HOST || '0.0.0.0';

// Tool definitions (same as before)
const tools = [
  {
    name: 'list_requests',
    description: 'List service desk requests',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status' },
        limit: { type: 'number', description: 'Maximum results', default: 10 }
      }
    }
  },
  {
    name: 'get_request',
    description: 'Get request details',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'Request ID' }
      },
      required: ['request_id']
    }
  }
];

// Create TCP server
const tcpServer = net.createServer((socket) => {
  console.error(`New TCP connection from ${socket.remoteAddress}:${socket.remotePort}`);
  
  // Create MCP server for this connection
  const mcpServer = new Server(
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
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    // Mock responses
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
          status: 'open'
        };
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  });

  // Create stdio transport using the TCP socket
  const transport = new StdioServerTransport({
    stdin: socket,
    stdout: socket
  });
  
  // Connect MCP server to transport
  mcpServer.connect(transport).catch(err => {
    console.error('MCP connection error:', err);
    socket.end();
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });

  socket.on('close', () => {
    console.error('TCP connection closed');
    mcpServer.close();
  });
});

tcpServer.listen(PORT, HOST, () => {
  console.error(`MCP TCP Server listening on ${HOST}:${PORT}`);
  console.error('Use socat to connect: socat - TCP:studio:3456');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('Shutting down...');
  tcpServer.close();
  process.exit(0);
});