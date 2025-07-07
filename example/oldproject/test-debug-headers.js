#!/usr/bin/env node

import axios from 'axios';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

// Create axios instance with request interceptor
const client = axios.create();

client.interceptors.request.use(request => {
  console.log('📤 Request:', {
    method: request.method.toUpperCase(),
    url: request.url,
    headers: request.headers,
    data: request.data
  });
  return request;
});

client.interceptors.response.use(
  response => {
    console.log('📥 Response:', {
      status: response.status,
      headers: response.headers,
      data: response.data
    });
    return response;
  },
  error => {
    if (error.response) {
      console.log('❌ Error Response:', {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
    }
    return Promise.reject(error);
  }
);

async function testHeaders() {
  console.log('🧪 Testing header transmission...\n');

  try {
    await client.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'debug-client',
          version: '1.0.0'
        }
      },
      id: 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'x-sdp-client-id': CLIENT_ID,
        'x-sdp-client-secret': CLIENT_SECRET
      }
    });
  } catch (error) {
    console.error('\n❌ Request failed');
  }
}

testHeaders().catch(console.error);