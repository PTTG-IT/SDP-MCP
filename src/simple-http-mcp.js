#!/usr/bin/env node

/**
 * Simple HTTP MCP Server
 * Handles MCP protocol over HTTP POST
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Tools definition
const tools = [
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
        id: { type: 'string' }
      },
      required: ['id']
    }
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'simple-http-mcp' });
});

// Main MCP endpoint
app.post('/mcp', (req, res) => {
  const { method, params, id } = req.body;
  console.error(`MCP request: ${method}`);
  
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
        result = { tools };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        if (name === 'list_requests') {
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                requests: [
                  { id: '1', subject: 'Test Request 1', status: 'open' },
                  { id: '2', subject: 'Test Request 2', status: 'closed' }
                ]
              }, null, 2)
            }]
          };
        } else if (name === 'get_request') {
          result = {
            content: [{
              type: 'text',
              text: JSON.stringify({
                id: args.id,
                subject: `Request ${args.id}`,
                status: 'open',
                description: 'Sample request details'
              }, null, 2)
            }]
          };
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
        break;
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    
    res.json({
      jsonrpc: '2.0',
      result,
      id
    });
    
  } catch (error) {
    res.json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: error.message
      },
      id
    });
  }
});

const PORT = 3456;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Simple HTTP MCP Server running on port ${PORT}`);
  console.log(`Health: http://0.0.0.0:${PORT}/health`);
  console.log(`MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
});