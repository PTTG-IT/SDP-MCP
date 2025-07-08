#!/usr/bin/env node

/**
 * JavaScript fallback to start the MCP server without TypeScript compilation
 * This is a temporary solution while fixing TypeScript errors
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting SDP MCP Server (JavaScript mode)');
console.log('==========================================\n');

// Check if TypeScript files need to be transpiled on the fly
const tsNode = spawn('npx', [
  'ts-node',
  '--esm',
  '--experimental-specifier-resolution=node',
  '--transpile-only', // Skip type checking
  path.join(__dirname, '..', 'src', 'index.ts')
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TS_NODE_TRANSPILE_ONLY: 'true',
    TS_NODE_LOG_ERROR: 'true',
    NODE_ENV: process.env.NODE_ENV || 'development'
  }
});

tsNode.on('error', (err) => {
  console.error('❌ Failed to start server:', err.message);
  console.error('\nTrying alternative approach...\n');
  
  // Fallback: Try to run compiled JavaScript if it exists
  const node = spawn('node', [
    path.join(__dirname, '..', 'dist', 'index.js')
  ], {
    stdio: 'inherit'
  });
  
  node.on('error', (err2) => {
    console.error('❌ No compiled files found. Please run one of:');
    console.error('   npm run build:dev    (relaxed TypeScript)');
    console.error('   npm run build        (strict TypeScript)');
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});