#!/usr/bin/env node

/**
 * Test the mock SDP API server
 */

const axios = require('axios');

async function testMockAPI() {
  const baseURL = 'http://localhost:3457/app/itdesk/api/v3';
  
  // Create client with mock bearer token
  const client = axios.create({
    baseURL,
    headers: {
      'Authorization': 'Bearer mock-token-for-testing',
      'Accept': 'application/vnd.manageengine.sdp.v3+json'
    }
  });
  
  try {
    console.log('🧪 Testing Mock SDP API Server...\n');
    
    // Test 1: List requests
    console.log('1. Testing list requests...');
    const listResponse = await client.get('/requests', {
      params: {
        input_data: JSON.stringify({
          list_info: {
            row_count: 10,
            start_index: 0
          }
        })
      }
    });
    console.log(`✅ Found ${listResponse.data.requests.length} mock tickets`);
    listResponse.data.requests.forEach(req => {
      console.log(`   - ${req.id}: ${req.subject} (${req.status.name})`);
    });
    
    // Test 2: Get specific request
    console.log('\n2. Testing get request...');
    const requestId = listResponse.data.requests[0].id;
    const getResponse = await client.get(`/requests/${requestId}`);
    console.log(`✅ Retrieved ticket: ${getResponse.data.request.subject}`);
    console.log(`   Mock indicator: ${getResponse.data.request.is_mock}`);
    
    // Test 3: Create request with missing fields (should fail)
    console.log('\n3. Testing create with missing mandatory fields...');
    try {
      await client.post('/requests', null, {
        params: {
          input_data: JSON.stringify({
            request: {
              subject: 'Test without required fields'
            }
          })
        }
      });
      console.log('❌ Should have failed!');
    } catch (error) {
      console.log('✅ Correctly rejected - missing mandatory fields:', error.response.data.response_status.messages[0].fields);
    }
    
    // Test 4: Create valid request
    console.log('\n4. Testing create with all fields...');
    const createResponse = await client.post('/requests', null, {
      params: {
        input_data: JSON.stringify({
          request: {
            subject: 'Mock Test Ticket',
            description: 'Created via mock API test',
            mode: { name: 'Web Form' },
            request_type: { name: 'Incident' },
            urgency: { name: '2 - General Concern' },
            level: { name: '1 - Frontline' },
            impact: { name: '1 - Affects User' },
            category: { name: 'Software' },
            status: { name: 'Open' },
            priority: { name: '2 - Normal' }
          }
        })
      }
    });
    console.log(`✅ Created ticket: ${createResponse.data.request.id}`);
    console.log(`   Subject: ${createResponse.data.request.subject}`);
    console.log(`   Is Mock: ${createResponse.data.request.is_mock}`);
    
    // Test 5: Update closed ticket (should fail)
    console.log('\n5. Testing update on closed ticket...');
    const closedTicket = listResponse.data.requests.find(r => r.status.name === 'Closed');
    if (closedTicket) {
      try {
        await client.put(`/requests/${closedTicket.id}`, null, {
          params: {
            input_data: JSON.stringify({
              request: {
                priority: { name: '4 - Critical' }
              }
            })
          }
        });
        console.log('❌ Should have failed!');
      } catch (error) {
        console.log('✅ Correctly rejected - cannot update closed ticket');
        console.log(`   Error: ${error.response.data.response_status.messages[0].message}`);
      }
    }
    
    console.log('\n✅ All mock API tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Check if mock server is running
console.log('Checking if mock server is running on port 3457...');
axios.get('http://localhost:3457/app/itdesk/api/v3/priorities', {
  headers: { 'Authorization': 'Bearer test' }
})
  .then(() => {
    console.log('✅ Mock server is running\n');
    testMockAPI();
  })
  .catch(() => {
    console.log('❌ Mock server not running. Start it with: npm run mock:api');
    process.exit(1);
  });