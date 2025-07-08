#!/usr/bin/env node

/**
 * Proper MCP SSE Server implementation
 * Based on official SDK examples
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Store active sessions
const sessions = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-sse-proper',
    sessions: sessions.size
  });
});

// SSE endpoint
app.get('/sse', async (req, res) => {
  console.error('New SSE connection established');
  
  // Create a new MCP server instance for this connection
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

  // Set up tools
  server.setRequestHandler('tools/list', async () => {
    console.error('Listing tools');
    return {
      tools: [
        {
          name: 'test_tool',
          description: 'A simple test tool',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Test message'
              }
            }
          }
        }
      ]
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    console.error('Tool called:', request.params.name);
    return {
      content: [
        {
          type: 'text',
          text: `Tool ${request.params.name} called with: ${JSON.stringify(request.params.arguments)}`
        }
      ]
    };
  });

  // Create transport with proper path
  const transport = new SSEServerTransport('/', res);
  
  // Store session
  sessions.set(transport.sessionId, { server, transport });
  console.error(`Session created: ${transport.sessionId}`);
  
  // Clean up on disconnect
  res.on('close', () => {
    console.error(`Session closed: ${transport.sessionId}`);
    sessions.delete(transport.sessionId);
  });

  // Connect server
  try {
    await server.connect(transport);
    console.error('MCP server connected successfully');
  } catch (error) {
    console.error('Failed to connect MCP server:', error);
    res.status(500).end();
  }
});

// Message handling endpoint
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId || req.body.sessionId;
  console.error(`Message for session ${sessionId}:`, req.body);
  
  const session = sessions.get(sessionId);
  if (!session) {
    console.error('Session not found:', sessionId);
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    await session.transport.handleMessage(req.body);
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling message:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, '0.0.0.0', () => {
  console.error(`MCP SSE Server running on port ${PORT}`);
  console.error(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.error(`Messages endpoint: http://0.0.0.0:${PORT}/messages`);
});