#!/usr/bin/env node

import axios from 'axios';

const SERVER_URL = 'http://127.0.0.1:3456';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function checkOAuthStatus() {
  console.log('🔍 Checking Service Desk Plus OAuth Authentication Status\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // First check OAuth initialization endpoint
    console.log('1️⃣  Checking OAuth initialization status...');
    const initCheck = await axios.post(`${SERVER_URL}/oauth/initialize`, {
      clientId: CLIENT_ID
    });

    console.log(`   Status: ${initCheck.data.needsSetup ? '❌ Setup Required' : '✅ Already Authorized'}`);
    if (initCheck.data.message) {
      console.log(`   Message: ${initCheck.data.message}`);
    }

    // Now test via MCP protocol
    console.log('\n2️⃣  Testing via MCP protocol...');
    
    // Initialize MCP session
    const initResponse = await axios.post(`${SERVER_URL}/mcp`, {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'oauth-status-checker',
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

    const sessionId = initResponse.headers['mcp-session-id'];
    console.log(`   Session established: ${sessionId}`);

    // Call check_auth_status tool
    console.log('\n3️⃣  Calling check_auth_status tool...');
    const authCheckResponse = await axios.post(`${SERVER_URL}/mcp`, {
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
    const lines = authCheckResponse.data.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.result?.content?.[0]?.text) {
          const status = JSON.parse(data.result.content[0].text);
          
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📊 OAuth Authentication Status Report');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          
          console.log(`Client ID: ${CLIENT_ID.substring(0, 20)}...`);
          console.log(`Mode: ${status.mode || 'Unknown'}`);
          console.log(`Authenticated: ${status.authenticated ? '✅ Yes' : '❌ No'}`);
          console.log(`Has Tokens: ${status.hasTokens ? '✅ Yes' : '❌ No'}`);
          console.log(`Needs Re-auth: ${status.needsReauth ? '⚠️  Yes' : '✅ No'}`);
          
          if (status.lastRefreshed) {
            console.log(`Last Token Refresh: ${new Date(status.lastRefreshed).toLocaleString()}`);
          }
          if (status.refreshCount !== undefined) {
            console.log(`Token Refresh Count: ${status.refreshCount}`);
          }
          if (status.lastError) {
            console.log(`Last Error: ❌ ${status.lastError}`);
          }
          
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          // Provide guidance
          if (status.authenticated) {
            console.log('\n✅ Your OAuth setup is working correctly!');
            console.log('   The MCP server can authenticate with Service Desk Plus.');
          } else if (status.needsReauth) {
            console.log('\n⚠️  OAuth Re-authorization Required!');
            console.log('   The stored tokens have expired or been revoked.');
            console.log('   Please run the OAuth setup process again.');
          } else if (!status.hasTokens) {
            console.log('\n❌ OAuth Setup Required!');
            console.log('   No OAuth tokens found for this client.');
            console.log('   Please complete the initial OAuth setup:');
            console.log('   1. Go to https://api-console.zoho.com/');
            console.log('   2. Generate an authorization code with offline scope');
            console.log('   3. Run: npm run oauth:setup');
          }
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Error checking OAuth status:');
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        console.error('   Details:', JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error('   ', error.message);
    }
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   - Make sure the MCP server is running: npm run start:self-client-http');
    console.log('   - Check that the database is accessible');
    console.log('   - Verify your client ID and secret are correct');
  }
}

// Run the check
checkOAuthStatus().catch(console.error);