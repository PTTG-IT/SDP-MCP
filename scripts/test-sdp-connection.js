#!/usr/bin/env node

/**
 * Test Service Desk Plus API connection
 * Verifies OAuth is working before starting MCP server
 */

const { SDPAPIClient } = require('../src/sdp-api-client.js');

async function testConnection() {
  console.log('🧪 Testing Service Desk Plus API Connection');
  console.log('==========================================\n');
  
  try {
    // Initialize client
    const client = new SDPAPIClient();
    
    console.log('📋 Configuration:');
    console.log(`   Portal: ${client.portalName}`);
    console.log(`   Data Center: ${client.dataCenter}`);
    console.log(`   API Endpoint: ${client.getAPIEndpoint()}`);
    console.log('');
    
    // Test 1: List requests
    console.log('🔍 Test 1: Listing requests...');
    const listResult = await client.listRequests({ limit: 5 });
    console.log(`✅ Found ${listResult.total_count} total requests`);
    console.log(`   Returned: ${listResult.requests.length} requests`);
    
    if (listResult.requests.length > 0) {
      console.log('\n📄 Sample request:');
      const sample = listResult.requests[0];
      console.log(`   ID: ${sample.id}`);
      console.log(`   Subject: ${sample.subject}`);
      console.log(`   Status: ${sample.status?.name}`);
      console.log(`   Created: ${sample.created_time?.display_value}`);
    }
    
    // Test 2: Get specific request (if we have one)
    if (listResult.requests.length > 0) {
      const requestId = listResult.requests[0].id;
      console.log(`\n🔍 Test 2: Getting request details for #${requestId}...`);
      const request = await client.getRequest(requestId);
      console.log('✅ Retrieved request details successfully');
      console.log(`   Has notes: ${request.has_notes}`);
      console.log(`   Has attachments: ${request.has_attachments}`);
    }
    
    // Test 3: Search
    console.log('\n🔍 Test 3: Searching requests...');
    const searchResult = await client.searchRequests('test', { limit: 3 });
    console.log(`✅ Search returned ${searchResult.total_count} results`);
    
    console.log('\n🎉 All tests passed! SDP API connection is working.');
    console.log('\n💡 Next steps:');
    console.log('1. Stop the current MCP server');
    console.log('2. Start the integrated server: node src/mcp-sse-sdp-integrated.js');
    console.log('3. Restart Claude Desktop to use the new tools');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 401) {
      console.error('\n⚠️  Authentication failed. You need to:');
      console.error('1. Generate a new authorization code');
      console.error('2. Run: node scripts/setup-sdp-oauth.js');
    } else if (error.code === 'NETWORK_ERROR') {
      console.error('\n⚠️  Network error. Check:');
      console.error('- Internet connection');
      console.error('- Firewall settings');
      console.error('- VPN if required');
    } else {
      console.error('\nDetails:', error);
    }
    
    process.exit(1);
  }
}

testConnection().catch(console.error);