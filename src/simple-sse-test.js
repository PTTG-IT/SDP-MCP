#!/usr/bin/env node

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Simple SSE endpoint for testing
app.get('/sse', (req, res) => {
  console.log('SSE connection received');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial event
  res.write('data: {"type":"connected"}\n\n');
  
  // Keep alive
  const interval = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);
  
  req.on('close', () => {
    console.log('SSE connection closed');
    clearInterval(interval);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'simple-sse-test' });
});

const PORT = 3456;
app.listen(PORT, () => {
  console.log(`Simple SSE test server running on port ${PORT}`);
  console.log(`Test with: curl -N http://localhost:${PORT}/sse`);
});