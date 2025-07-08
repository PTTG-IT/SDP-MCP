#!/usr/bin/env node

/**
 * Remote STDIO Wrapper for Claude Desktop
 * Connects to a remote HTTP/SSE server via stdio
 */

const axios = require('axios');
const readline = require('readline');

// Configuration
const REMOTE_HOST = process.env.REMOTE_HOST || '192.168.2.10';
const REMOTE_PORT = process.env.REMOTE_PORT || '3456';
const BASE_URL = `http://${REMOTE_HOST}:${REMOTE_PORT}`;

// Setup stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Buffer for incomplete messages
let buffer = '';

// Handle incoming messages from Claude
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    console.error('Received from Claude:', JSON.stringify(message).substring(0, 100));
    
    // Forward to remote server
    const response = await axios.post(`${BASE_URL}/mcp`, message, {
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': process.env.SDP_CLIENT_ID || '',
        'X-Client-Secret': process.env.SDP_CLIENT_SECRET || ''
      },
      timeout: 30000
    });
    
    // Send response back to Claude
    process.stdout.write(JSON.stringify(response.data) + '\n');
    
  } catch (error) {
    console.error('Error:', error.message);
    
    // Send error response to Claude
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id: null
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('Wrapper shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Wrapper terminated');
  process.exit(0);
});

// Initial connection test
axios.get(`${BASE_URL}/health`)
  .then(res => {
    console.error(`Connected to remote server: ${JSON.stringify(res.data)}`);
  })
  .catch(err => {
    console.error(`Failed to connect to ${BASE_URL}: ${err.message}`);
  });

console.error(`Remote STDIO wrapper started, connecting to ${BASE_URL}`);