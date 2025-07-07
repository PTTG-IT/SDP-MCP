#!/usr/bin/env node

import express from 'express';

const app = express();
const port = 3456;
const host = '127.0.0.1';

app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Test server is running' });
});

const server = app.listen(port, host, () => {
  console.log(`Test server listening on http://${host}:${port}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('Shutting down test server...');
  server.close();
  process.exit(0);
});