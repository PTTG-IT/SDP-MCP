#!/usr/bin/env node

import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function testTransport() {
  console.log('🧪 Testing StreamableHTTPClientTransport directly...\n');

  try {
    // Create transport with headers in requestInit
    const transport = new StreamableHTTPClientTransport(
      new URL(SERVER_URL),
      {
        requestInit: {
          headers: {
            'x-sdp-client-id': CLIENT_ID,
            'x-sdp-client-secret': CLIENT_SECRET
          }
        }
      }
    );

    console.log('📡 Sending initialize request...');
    
    // Send raw initialize request
    const response = await transport.send({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'transport-test',
          version: '1.0.0'
        }
      },
      id: 1
    });

    console.log('✅ Response:', JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

testTransport().catch(console.error);