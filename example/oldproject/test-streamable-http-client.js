#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const SERVER_URL = 'http://127.0.0.1:3456/mcp';
const CLIENT_ID = '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
const CLIENT_SECRET = '5752f7060c587171f81b21d58c5b8d0019587ca999';

async function testStreamableHTTPClient() {
  console.log('🧪 Testing Self-Client Authentication with Streamable HTTP...\n');

  try {
    // Create Streamable HTTP transport with headers
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
      name: 'streamable-http-test',
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
      try {
        const authResult = await client.callTool('check_auth_status', {});
        console.log('Auth Status:', JSON.stringify(authResult, null, 2));
      } catch (error) {
        console.log('❌ Auth check error:', error.message);
      }
    } else {
      console.log('⚠️  check_auth_status tool not found');
    }

    // Test creating a request
    console.log('\n📝 Testing create_request tool...');
    try {
      const createResult = await client.callTool('create_request', {
        subject: 'Test Request - Streamable HTTP Self-Client Auth',
        description: 'This is a test request to verify self-client authentication with Streamable HTTP transport',
        requester_email: 'test@example.com',
        requester_name: 'Test User',
        priority: 'Low',
        category: 'Software'
      });
      
      console.log('✅ Request created successfully!');
      console.log('Result:', JSON.stringify(createResult, null, 2));
      
      // Extract request ID if available
      const content = createResult.content?.[0]?.text;
      const idMatch = content?.match(/ID:\s*(\d+)/);
      if (idMatch) {
        const requestId = idMatch[1];
        console.log(`\n🔍 Request ID: ${requestId}`);
        
        // Test getting the request
        console.log('\n📄 Testing get_request tool...');
        const getResult = await client.callTool('get_request', {
          request_id: requestId
        });
        console.log('Request details retrieved successfully!');
        
        // Test closing the request
        console.log('\n🔒 Testing close_request tool...');
        const closeResult = await client.callTool('close_request', {
          request_id: requestId,
          closure_comments: 'Test completed successfully - Streamable HTTP transport working',
          closure_code: 'Completed'
        });
        
        console.log('✅ Request closed successfully!');
        console.log('Result:', JSON.stringify(closeResult, null, 2));
      }
    } catch (error) {
      if (error.message?.includes('OAuth')) {
        console.log('❌ OAuth setup required:', error.message);
        console.log('\n💡 Hint: Run the OAuth setup process first');
      } else {
        console.log('❌ Error creating request:', error.message);
      }
    }

    // Test list requests
    console.log('\n📋 Testing list_requests tool...');
    try {
      const listResult = await client.callTool('list_requests', {
        status: 'Open',
        per_page: 5
      });
      console.log('✅ Requests listed successfully!');
    } catch (error) {
      console.log('❌ Error listing requests:', error.message);
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
testStreamableHTTPClient().catch(console.error);