#!/usr/bin/env node

/**
 * Test write operations for Service Desk Plus
 */

const { SDPAPIClientEnhanced } = require('../src/sdp-api-client-enhanced.js');

async function testWriteOperations() {
  console.log('🧪 Testing Service Desk Plus Write Operations');
  console.log('============================================\n');
  
  const client = new SDPAPIClientEnhanced();
  
  try {
    // Test 1: Create a request
    console.log('📝 Test 1: Creating a test request...');
    
    const newRequest = await client.createRequest({
      subject: 'Test Request from MCP Integration',
      description: 'This is a test request created by the MCP integration to verify write operations are working correctly.',
      priority: 'low',
      requester_email: 'test@example.com',
      requester_name: 'MCP Test User'
    });
    
    console.log('✅ Request created successfully!');
    console.log(`   ID: ${newRequest.id}`);
    console.log(`   Subject: ${newRequest.subject}`);
    console.log(`   Status: ${newRequest.status?.name}`);
    
    const requestId = newRequest.id;
    
    // Test 2: Add a note
    console.log('\n📝 Test 2: Adding a note to the request...');
    
    try {
      const note = await client.addNote(
        requestId,
        'This is a test note added via MCP integration',
        true
      );
      console.log('✅ Note added successfully!');
    } catch (noteError) {
      console.error('❌ Failed to add note:', noteError.message);
      console.error('   Trying to diagnose the issue...');
      
      // Let's try to understand what fields the API expects
      console.error('   Error details:', JSON.stringify(noteError.details, null, 2));
    }
    
    // Test 3: Update the request
    console.log('\n📝 Test 3: Updating the request priority...');
    
    const updatedRequest = await client.updateRequest(requestId, {
      priority: 'medium'
    });
    
    console.log('✅ Request updated successfully!');
    console.log(`   New priority: ${updatedRequest.priority?.name}`);
    
    // Test 4: Close the request
    console.log('\n📝 Test 4: Closing the request...');
    
    const closedRequest = await client.closeRequest(requestId, {
      closure_comments: 'Test completed successfully. Closing request.',
      closure_code: 'Resolved'
    });
    
    console.log('✅ Request closed successfully!');
    console.log(`   Status: ${closedRequest.status?.name}`);
    console.log(`   Closure code: ${closedRequest.closure_info?.closure_code?.name}`);
    
    console.log('\n🎉 All write operations completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    
    // Provide helpful debugging info
    if (error.code === 4000 || error.statusCode === 4000) {
      console.error('\n💡 Error 4000 usually means:');
      console.error('- Invalid field values (check category/priority names)');
      console.error('- Missing required fields');
      console.error('- Invalid data format');
    }
  }
}

testWriteOperations().catch(console.error);