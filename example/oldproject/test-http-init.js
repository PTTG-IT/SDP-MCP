#!/usr/bin/env node

import axios from 'axios';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function testInitialization() {
  console.log('🧪 Testing MCP initialization sequence...\n');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'x-sdp-client-id': CLIENT_ID,
    'x-sdp-client-secret': CLIENT_SECRET
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
    }, { headers });

    console.log('✅ Initialize response:', JSON.stringify(initResponse.data, null, 2));

    // Step 2: Complete initialization
    console.log('\n2️⃣ Sending initialized notification...');
    await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    }, { headers });

    console.log('✅ Initialization complete');

    // Step 3: List tools
    console.log('\n3️⃣ Listing tools...');
    const toolsResponse = await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 2
    }, { headers });

    console.log('✅ Tools:', JSON.stringify(toolsResponse.data, null, 2));

    // Step 4: Call check_auth_status
    console.log('\n4️⃣ Checking auth status...');
    const authResponse = await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'check_auth_status',
        arguments: {}
      },
      id: 3
    }, { headers });

    console.log('✅ Auth Status:', JSON.stringify(authResponse.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testInitialization().catch(console.error);