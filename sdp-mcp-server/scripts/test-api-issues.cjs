#!/usr/bin/env node

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testAPIIssues() {
  try {
    console.log('=== Testing API Issues ===\n');
    
    const client = new SDPAPIClientV2();
    
    // Test 1: Try to list requests with status filter
    console.log('1. Testing list requests with status filter...');
    try {
      const result = await client.listRequests({ 
        limit: 2, 
        status: 'open' 
      });
      console.log('✅ Status filter works!');
      console.log('Found requests:', result.requests.length);
    } catch (error) {
      console.error('❌ Status filter failed:', error.message);
    }
    
    // Test 2: Try to create a minimal request
    console.log('\n2. Testing create request with minimal data...');
    try {
      const request = await client.createRequest({
        subject: 'Test Request - API Debug',
        description: 'Testing minimal request creation'
      });
      console.log('✅ Create request works!');
      console.log('Request ID:', request.id);
    } catch (error) {
      console.error('❌ Create request failed:', error.message);
    }
    
    // Test 3: Try to update a request status
    console.log('\n3. Testing update request status...');
    try {
      const request = await client.updateRequest('216826000006445023', {
        status: 'In Progress'
      });
      console.log('✅ Update request works!');
    } catch (error) {
      console.error('❌ Update request failed:', error.message);
    }
    
    // Test 4: Check if /users endpoint works
    console.log('\n4. Testing /users endpoint...');
    try {
      const response = await client.client.get('/users', {
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 1,
              start_index: 0
            }
          })
        }
      });
      console.log('✅ /users endpoint works!');
      console.log('Users found:', response.data.users?.length || 0);
    } catch (error) {
      console.error('❌ /users endpoint failed:', error.message);
      if (error.response?.status === 404) {
        console.error('   → The /users endpoint does not exist in this SDP instance');
      }
    }
    
    // Test 5: Check metadata
    console.log('\n5. Checking metadata values...');
    await client.ensureMetadata();
    console.log('Priorities:', client.metadata.priorities);
    console.log('Categories:', client.metadata.categories?.slice(0, 3));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIIssues();