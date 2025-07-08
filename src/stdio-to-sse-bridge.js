#!/usr/bin/env node

/**
 * STDIO to SSE Bridge for Claude Desktop
 * This acts as a local proxy between Claude's stdio and the remote SSE server
 */

const axios = require('axios');
const readline = require('readline');
const EventSource = require('eventsource');

const SSE_URL = process.argv[2] || 'http://192.168.2.10:3456/sse';
const MESSAGES_URL = SSE_URL.replace('/sse', '/messages');

console.error(`Connecting to SSE server at: ${SSE_URL}`);

// Create EventSource for SSE connection
const es = new EventSource(SSE_URL);
let sessionId = null;

// Handle SSE events
es.onmessage = (event) => {
  console.error('SSE message:', event.data);
  // Forward to stdout for Claude
  process.stdout.write(event.data + '\n');
};

es.onerror = (error) => {
  console.error('SSE error:', error);
  process.exit(1);
};

// Read from stdin (Claude's requests)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  console.error('Received from Claude:', line);
  
  try {
    // Parse the message
    const message = JSON.parse(line);
    
    // Extract session ID if present
    if (message.sessionId) {
      sessionId = message.sessionId;
    }
    
    // Forward to SSE server via POST
    if (sessionId) {
      const response = await axios.post(
        `${MESSAGES_URL}?sessionId=${sessionId}`,
        message,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Forward response back to Claude
      process.stdout.write(JSON.stringify(response.data) + '\n');
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

// Handle shutdown
process.on('SIGINT', () => {
  console.error('Shutting down bridge...');
  es.close();
  process.exit(0);
});