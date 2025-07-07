#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function testMCPConnection() {
  console.log('🧪 Testing MCP Connection and OAuth Status...\n');

  try {
    // Create transport with authentication headers in requestInit
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

    // Create MCP client
    const client = new Client(
      {
        name: 'oauth-test-client',
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    );

    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');

    console.log('🔍 Checking OAuth authentication status...');
    try {
      const result = await client.callTool('check_auth_status', {});
      
      // Parse the response
      if (result.content && result.content.length > 0 && result.content[0].type === 'text') {
        const statusText = result.content[0].text;
        const status = JSON.parse(statusText);
        
        console.log('\n📊 OAuth Authentication Status:');
        console.log(JSON.stringify(status, null, 2));
        
        console.log('\n📋 Summary:');
        if (status.authenticated) {
          console.log('✅ Client is authenticated and ready to use');
          console.log(`   Mode: ${status.mode}`);
          console.log(`   Last token refresh: ${status.lastRefreshed || 'Unknown'}`);
          console.log(`   Refresh count: ${status.refreshCount || 0}`);
        } else if (status.needsReauth) {
          console.log('⚠️  Client needs re-authorization');
          console.log('   Please run the OAuth setup process again');
          if (status.lastError) {
            console.log(`   Last error: ${status.lastError}`);
          }
        } else if (!status.hasTokens) {
          console.log('❌ No OAuth tokens found for this client');
          console.log('   Please complete the initial OAuth setup');
        }
      }
    } catch (error) {
      console.error('❌ Error calling check_auth_status:', error.message);
      if (result.isError) {
        console.error('Tool error:', result.content?.[0]?.text);
      }
    }

    // Disconnect properly
    console.log('\n👋 Disconnecting...');
    await client.close();
    console.log('✅ Disconnected');

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Run the test
testMCPConnection().catch(console.error);