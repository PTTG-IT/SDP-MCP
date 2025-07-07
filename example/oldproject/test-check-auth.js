#!/usr/bin/env node

import axios from 'axios';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function checkAuthStatus() {
  console.log('🧪 Checking OAuth Authentication Status...\n');

  let sessionId = null;

  try {
    // Step 1: Initialize and get session ID
    console.log('1️⃣ Initializing MCP connection...');
    const initResponse = await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'auth-check-client',
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
      },
      responseType: 'text'
    });

    // Extract session ID from response headers
    sessionId = initResponse.headers['mcp-session-id'];
    console.log(`✅ Initialized with session ID: ${sessionId}\n`);

    // Step 2: Call check_auth_status
    console.log('2️⃣ Checking authentication status...');
    const authResponse = await axios.post(SERVER_URL, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'check_auth_status',
        arguments: {}
      },
      id: 2
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'x-sdp-client-id': CLIENT_ID,
        'x-sdp-client-secret': CLIENT_SECRET,
        'Mcp-Session-Id': sessionId
      },
      responseType: 'text'
    });

    // Parse SSE response
    const lines = authResponse.data.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.result?.content?.[0]?.text) {
          console.log('\n📊 Authentication Status:');
          const status = JSON.parse(data.result.content[0].text);
          console.log(JSON.stringify(status, null, 2));
          
          // Interpret the status
          console.log('\n📋 Summary:');
          if (status.authenticated) {
            console.log('✅ Client is authenticated and ready to use');
            console.log(`   Last token refresh: ${status.lastRefreshed || 'Unknown'}`);
            console.log(`   Refresh count: ${status.refreshCount || 0}`);
          } else if (status.needsReauth) {
            console.log('⚠️  Client needs re-authorization');
            console.log('   Please run the OAuth setup process again');
          } else if (!status.hasTokens) {
            console.log('❌ No OAuth tokens found for this client');
            console.log('   Please complete the initial OAuth setup');
          }
        }
      }
    }

  } catch (error) {
    if (error.response) {
      console.error('\n❌ Error:', error.response.status, error.response.statusText);
      if (error.response.data) {
        console.error('Details:', error.response.data);
      }
    } else {
      console.error('\n❌ Error:', error.message);
    }
  }
}

checkAuthStatus().catch(console.error);