#!/usr/bin/env node

// Test if we can start a basic MCP server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';

const app = express();
app.use(express.json());

// Create MCP server
const server = new Server(
  {
    name: 'test-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test MCP endpoint
app.post('/test-mcp', async (req, res) => {
  console.log('Received MCP request:', req.body);
  res.json({ 
    jsonrpc: '2.0',
    result: { 
      message: 'Test response' 
    },
    id: req.body.id || 1
  });
});

const PORT = 3456;
const HOST = '127.0.0.1';

const httpServer = app.listen(PORT, HOST, () => {
  console.log(`Test MCP server running at http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/test-mcp`);
});

httpServer.on('error', (err) => {
  console.error('Server error:', err);
});