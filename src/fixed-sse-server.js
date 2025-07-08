#!/usr/bin/env node

/**
 * Fixed MCP SSE Server
 * Properly implements SSE protocol with persistent connections
 */

const express = require('express');
const cors = require('cors');
// Generate simple session IDs
let sessionCounter = 0;

const app = express();
app.use(cors());
app.use(express.json());

// Active SSE connections
const connections = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'fixed-sse-server',
    connections: connections.size 
  });
});

// SSE endpoint - MUST keep connection open
app.get('/sse', (req, res) => {
  console.error('New SSE connection established');
  
  // Set SSE headers - CRITICAL
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  });

  // Create session
  const sessionId = `session-${Date.now()}-${++sessionCounter}`;
  connections.set(sessionId, res);
  console.error(`Session created: ${sessionId}`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    sessionId: sessionId
  })}\n\n`);

  // Keep connection alive with periodic pings
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    console.error(`Session closed: ${sessionId}`);
    clearInterval(keepAlive);
    connections.delete(sessionId);
  });

  // IMPORTANT: Do NOT end the response - keep it open!
});

// Message endpoint for client-to-server communication
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'];
  const sseConnection = connections.get(sessionId);
  
  if (!sseConnection) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const { method, params, id } = req.body;
  console.error(`Received ${method} for session ${sessionId}`);

  try {
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'service-desk-plus',
            version: '1.0.0'
          }
        };
        break;
        
      case 'tools/list':
        result = {
          tools: [
            {
              name: 'list_requests',
              description: 'List service desk requests',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', default: 10 }
                }
              }
            },
            {
              name: 'get_request',
              description: 'Get request details',
              inputSchema: {
                type: 'object',
                properties: {
                  request_id: { type: 'string' }
                },
                required: ['request_id']
              }
            }
          ]
        };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        result = {
          content: [{
            type: 'text',
            text: `Called ${name} with args: ${JSON.stringify(args)}`
          }]
        };
        break;
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    
    // Send response via SSE
    const response = {
      jsonrpc: '2.0',
      result,
      id
    };
    
    sseConnection.write(`data: ${JSON.stringify(response)}\n\n`);
    
    // Also respond to POST request
    res.json({ status: 'ok' });
    
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: error.message
      },
      id
    };
    
    sseConnection.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
    res.status(400).json(errorResponse);
  }
});

// For mcp-remote compatibility - handle direct SSE messages
app.post('/sse', async (req, res) => {
  // This handles the case where mcp-remote sends initialize directly
  const { method, params, id } = req.body;
  console.error(`Direct SSE POST: ${method}`);
  
  if (method === 'initialize') {
    // Return initialize response directly
    res.json({
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'service-desk-plus',
          version: '1.0.0'
        }
      },
      id
    });
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found'
      },
      id
    });
  }
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, '0.0.0.0', () => {
  console.error(`Fixed SSE Server running on port ${PORT}`);
  console.error(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.error(`Health: http://0.0.0.0:${PORT}/health`);
});