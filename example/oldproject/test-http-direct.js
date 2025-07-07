#!/usr/bin/env node

import axios from 'axios';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function testDirectCall() {
  console.log('🧪 Testing direct HTTP call...\n');

  try {
    const response = await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'x-sdp-client-id': CLIENT_ID,
        'x-sdp-client-secret': CLIENT_SECRET
      }
    });

    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testDirectCall().catch(console.error);