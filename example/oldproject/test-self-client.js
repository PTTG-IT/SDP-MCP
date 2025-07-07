#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const SERVER_URL = 'http://127.0.0.1:3456/sse';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function testSelfClientAuth() {
  console.log('🧪 Testing Self-Client Authentication...\n');

  try {
    // Create SSE transport with headers
    const headers = {
      'x-sdp-client-id': CLIENT_ID,
      'x-sdp-client-secret': CLIENT_SECRET
    };

    const transport = new SSEClientTransport(new URL(SERVER_URL), { headers });
    
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

    // Test creating a request
    console.log('\n📝 Testing create_request tool...');
    try {
      const createResult = await client.callTool('create_request', {
        subject: 'Test Request from Self-Client Auth',
        description: 'This is a test request to verify self-client authentication',
        requester_email: 'test@example.com',
        requester_name: 'Test User',
        priority: 'Low'
      });
      
      console.log('✅ Request created successfully!');
      console.log('Result:', JSON.stringify(createResult, null, 2));
      
      // Extract request ID if available
      const content = createResult.content?.[0]?.text;
      const idMatch = content?.match(/ID:\s*(\d+)/);
      if (idMatch) {
        const requestId = idMatch[1];
        console.log(`\n🔍 Request ID: ${requestId}`);
        
        // Test closing the request
        console.log('\n🔒 Testing close_request tool...');
        const closeResult = await client.callTool('close_request', {
          request_id: requestId,
          closure_comments: 'Test completed successfully',
          closure_code: 'Completed'
        });
        
        console.log('✅ Request closed successfully!');
        console.log('Result:', JSON.stringify(closeResult, null, 2));
      }
    } catch (error) {
      if (error.message.includes('OAuth')) {
        console.log('❌ OAuth setup required:', error.message);
      } else {
        console.log('❌ Error creating request:', error.message);
      }
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