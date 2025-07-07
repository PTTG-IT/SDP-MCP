#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function testSelfClientAuth() {
  console.log('🧪 Testing Self-Client Authentication (HTTP)...\n');

  try {
    // Create HTTP transport with headers  
    const transport = new StreamableHTTPClientTransport(
      new URL(SERVER_URL), 
      { 
        headers: {
          'x-sdp-client-id': CLIENT_ID,
          'x-sdp-client-secret': CLIENT_SECRET
        }
      }
    );
    
    // Create MCP client
    const client = new Client({
      name: 'self-client-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    console.log('📡 Connecting to server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!\n');

    // List available tools
    console.log('🔧 Listing available tools...');
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools`);
    
    // Check if check_auth_status exists
    const authTool = tools.tools.find(t => t.name === 'check_auth_status');
    if (authTool) {
      console.log('\n📋 Testing check_auth_status tool...');
      const authResult = await client.callTool('check_auth_status', {});
      console.log('Auth Status:', JSON.stringify(authResult, null, 2));
    } else {
      console.log('⚠️  check_auth_status tool not found');
    }

    // Disconnect
    console.log('\n👋 Disconnecting...');
    await client.close();
    console.log('✅ Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSelfClientAuth().catch(console.error);