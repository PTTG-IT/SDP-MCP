#!/usr/bin/env node

import axios from 'axios';
import crypto from 'crypto';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

function parseSSEResponse(data) {
  // Parse SSE format: "event: message\ndata: {...}\n\n"
  const lines = data.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      return JSON.parse(line.slice(6));
    }
  }
  return null;
}

async function testMCPSession() {
  console.log('🧪 Testing MCP with session...\n');

  const sessionId = crypto.randomUUID();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'x-sdp-client-id': CLIENT_ID,
    'x-sdp-client-secret': CLIENT_SECRET,
    'Mcp-Session-Id': sessionId
  };

  try {
    // Step 1: Initialize
    console.log('1️⃣ Sending initialize request...');
    const initResponse = await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      },
      id: 1
    }, { headers, responseType: 'text' });

    const initData = parseSSEResponse(initResponse.data);
    console.log('✅ Initialize response:', JSON.stringify(initData, null, 2));

    // Step 2: Call check_auth_status directly (skip initialized notification)
    console.log('\n3️⃣ Checking auth status...');
    const authResponse = await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'check_auth_status',
        arguments: {}
      },
      id: 2
    }, { headers, responseType: 'text' });

    const authData = parseSSEResponse(authResponse.data);
    console.log('\n✅ Auth Status Response:', JSON.stringify(authData, null, 2));
    
    // Parse the actual auth status from the tool response
    if (authData?.result?.content?.[0]?.text) {
      console.log('\n📊 Parsed Auth Status:');
      const status = JSON.parse(authData.result.content[0].text);
      console.log(JSON.stringify(status, null, 2));
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP Error:', error.response.status);
      console.error('Response:', error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testMCPSession().catch(console.error);