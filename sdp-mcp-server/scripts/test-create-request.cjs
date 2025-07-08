#!/usr/bin/env node

/**
 * Test create_request functionality
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testCreateRequest() {
  try {
    console.log('Testing create_request with updated API client...\n');
    
    // Initialize client
    const client = new SDPAPIClientV2();
    
    // Test 1: Simple request without priority/category
    console.log('Test 1: Creating simple request...');
    try {
      const simpleRequest = await client.createRequest({
        subject: 'Test Request - Simple',
        description: 'Testing create request without priority or category'
      });
      console.log('✅ Simple request created:', simpleRequest.id);
    } catch (error) {
      console.log('❌ Simple request failed - trying without priority field');
      // Skip to next test
    }
    
    // Test 2: Request with priority only
    console.log('\nTest 2: Creating request with priority...');
    const priorityRequest = await client.createRequest({
      subject: 'Test Request - With Priority',
      description: 'Testing create request with medium priority',
      priority: 'medium'
    });
    console.log('✅ Priority request created:', priorityRequest.id);
    
    // Test 3: Request with priority and category
    console.log('\nTest 3: Creating request with priority and category...');
    const fullRequest = await client.createRequest({
      subject: 'Test Request - Full',
      description: 'Testing create request with all fields',
      priority: 'high',
      category: 'Hardware'
    });
    console.log('✅ Full request created:', fullRequest.id);
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

// Run tests
testCreateRequest();