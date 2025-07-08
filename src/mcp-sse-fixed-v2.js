#!/usr/bin/env node

/**
 * Fixed MCP SSE Server v2
 * Properly handles JSON-RPC notifications vs requests
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Active SSE connections
const connections = new Map();
let sessionCounter = 0;

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'mcp-sse-v2',
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
    'X-Accel-Buffering': 'no'
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

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  // Handle disconnect
  req.on('close', () => {
    console.error(`Session closed: ${sessionId}`);
    clearInterval(keepAlive);
    connections.delete(sessionId);
  });
});

// Handle JSON-RPC messages properly
function handleJsonRpcMessage(message, sseConnection) {
  const { method, params, id, jsonrpc } = message;
  
  // Check if this is a notification (no id field)
  const isNotification = id === undefined;
  
  console.error(`Received ${isNotification ? 'notification' : 'request'}: ${method}`);
  
  // For notifications, we should NOT send a response
  if (isNotification) {
    console.error(`Ignoring notification: ${method}`);
    // Log but don't respond to notifications
    return null;
  }
  
  // Handle requests (messages with id)
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
        const { name, arguments: args } = params || {};
        result = {
          content: [{
            type: 'text',
            text: `Called ${name} with args: ${JSON.stringify(args)}`
          }]
        };
        break;
        
      default:
        // Only return error for requests, not notifications
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          },
          id
        };
    }
    
    return {
      jsonrpc: '2.0',
      result,
      id
    };
    
  } catch (error) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id
    };
  }
}

// Message endpoint for client-to-server communication
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'];
  const sseConnection = connections.get(sessionId);
  
  if (!sseConnection) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const response = handleJsonRpcMessage(req.body, sseConnection);
  
  if (response) {
    // Send response via SSE
    sseConnection.write(`data: ${JSON.stringify(response)}\n\n`);
  }
  
  // Always respond OK to POST request
  res.json({ status: 'ok' });
});

// Direct POST to /sse endpoint (for mcp-remote compatibility)
app.post('/sse', async (req, res) => {
  console.error('Direct SSE POST received');
  
  const response = handleJsonRpcMessage(req.body, null);
  
  // For notifications, return 200 OK with no body
  if (!response) {
    return res.status(200).end();
  }
  
  // For requests, return the response
  res.json(response);
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, '0.0.0.0', () => {
  console.error(`MCP SSE Server v2 running on port ${PORT}`);
  console.error(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.error(`Health: http://0.0.0.0:${PORT}/health`);
  console.error(`\nKey improvements:`);
  console.error(`- Properly handles JSON-RPC notifications (no id field)`);
  console.error(`- Only returns errors for requests, not notifications`);
  console.error(`- Compatible with mcp-remote proxy`);
});