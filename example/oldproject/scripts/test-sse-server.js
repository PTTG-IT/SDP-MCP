#!/usr/bin/env node

/**
 * Manual test script for SSE server
 * Usage: node scripts/test-sse-server.js
 */

import axios from 'axios';
import { EventSource } from 'eventsource';

const SERVER_URL = process.env.SSE_SERVER_URL || 'http://localhost:3000';
const API_KEY = process.env.SSE_API_KEY || 'test-key-123456789';

console.log('SSE Server Test Script');
console.log('======================');
console.log(`Server: ${SERVER_URL}`);
console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
console.log('');

async function testHealth() {
  console.log('1. Testing health endpoint...');
  try {
    const response = await axios.get(`${SERVER_URL}/health`);
    console.log('✓ Health check passed:', response.data);
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
  }
  console.log('');
}

async function testAuthentication() {
  console.log('2. Testing authentication...');
  
  // Test without API key
  try {
    await axios.get(`${SERVER_URL}/sse`);
    console.error('✗ Should have required API key');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✓ Correctly rejected request without API key');
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
  
  // Test with invalid API key
  try {
    await axios.get(`${SERVER_URL}/sse`, {
      headers: { 'X-API-Key': 'invalid-key' }
    });
    console.error('✗ Should have rejected invalid API key');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✓ Correctly rejected invalid API key');
    } else {
      console.error('✗ Unexpected error:', error.message);
    }
  }
  
  console.log('');
}

async function testSSEConnection() {
  console.log('3. Testing SSE connection...');
  
  return new Promise((resolve) => {
    const eventSource = new EventSource(`${SERVER_URL}/sse?apiKey=${API_KEY}`);
    let sessionId = null;
    let keepAliveCount = 0;
    
    eventSource.onopen = () => {
      console.log('✓ SSE connection established');
    };
    
    eventSource.onmessage = (event) => {
      if (event.data === ':keepalive') {
        keepAliveCount++;
        console.log(`✓ Received keep-alive #${keepAliveCount}`);
        
        if (keepAliveCount >= 2) {
          console.log('✓ Keep-alive mechanism working');
          eventSource.close();
          resolve();
        }
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('✗ SSE connection error:', error);
      eventSource.close();
      resolve();
    };
    
    // Get session ID from headers (if available)
    setTimeout(async () => {
      try {
        const response = await axios.get(`${SERVER_URL}/sessions`, {
          headers: { 'X-API-Key': API_KEY }
        });
        if (response.data.sessions.length > 0) {
          sessionId = response.data.sessions[0].id;
          console.log(`✓ Session ID: ${sessionId}`);
        }
      } catch (error) {
        console.error('✗ Failed to get session info:', error.message);
      }
    }, 1000);
  });
}

async function testRateLimiting() {
  console.log('\n4. Testing rate limiting...');
  
  // First establish a connection
  const response = await axios.get(`${SERVER_URL}/sse`, {
    headers: { 'X-API-Key': API_KEY },
    responseType: 'stream'
  });
  
  const sessionId = response.headers['x-session-id'];
  if (!sessionId) {
    console.error('✗ No session ID in response headers');
    return;
  }
  
  console.log(`✓ Got session ID: ${sessionId}`);
  
  // Send requests to test rate limit
  const maxRequests = 60; // Default rate limit
  let successCount = 0;
  let rateLimitHit = false;
  
  for (let i = 0; i < maxRequests + 5; i++) {
    try {
      await axios.post(`${SERVER_URL}/messages/${sessionId}`, 
        { test: 'data', index: i },
        { headers: { 'X-API-Key': API_KEY } }
      );
      successCount++;
    } catch (error) {
      if (error.response?.status === 429) {
        console.log(`✓ Rate limit enforced after ${successCount} requests`);
        rateLimitHit = true;
        break;
      } else {
        console.error('✗ Unexpected error:', error.message);
        break;
      }
    }
  }
  
  if (!rateLimitHit) {
    console.log(`⚠️  Rate limit not hit after ${successCount} requests`);
  }
  
  // Close the stream
  response.data.destroy();
  console.log('');
}

async function testSessionManagement() {
  console.log('5. Testing session management...');
  
  // Create multiple connections
  const connections = [];
  const eventSources = [];
  
  console.log('Creating 3 connections...');
  for (let i = 0; i < 3; i++) {
    const es = new EventSource(`${SERVER_URL}/sse?apiKey=${API_KEY}`);
    eventSources.push(es);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Check sessions
  try {
    const response = await axios.get(`${SERVER_URL}/sessions`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log(`✓ Active sessions: ${response.data.count}`);
    console.log(`✓ Connections by IP:`, response.data.connectionsByIP);
  } catch (error) {
    console.error('✗ Failed to get sessions:', error.message);
  }
  
  // Close connections
  console.log('Closing connections...');
  eventSources.forEach(es => es.close());
  
  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check sessions again
  try {
    const response = await axios.get(`${SERVER_URL}/sessions`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log(`✓ Sessions after cleanup: ${response.data.count}`);
  } catch (error) {
    console.error('✗ Failed to get sessions:', error.message);
  }
  
  console.log('');
}

async function testRateLimitStatus() {
  console.log('6. Testing rate limit status endpoint...');
  
  try {
    const response = await axios.get(`${SERVER_URL}/rate-limit-status`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('✓ Rate limit status:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('⚠️  Rate limit status endpoint not available (optional feature)');
  }
  
  console.log('');
}

async function runAllTests() {
  try {
    await testHealth();
    await testAuthentication();
    await testSSEConnection();
    await testRateLimiting();
    await testSessionManagement();
    await testRateLimitStatus();
    
    console.log('All tests completed!');
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();