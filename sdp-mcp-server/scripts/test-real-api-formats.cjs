#!/usr/bin/env node

/**
 * Test real API response formats
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testRequesterFormats() {
  const client = new SDPAPIClientV2();
  
  console.log('Testing requester formats\n');
  
  // First get a real request to see requester format
  try {
    console.log('Getting sample request to check requester format...');
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 1,
          start_index: 1
        }
      })
    };
    
    const response = await client.client.get('/requests', { params });
    if (response.data.requests?.length > 0) {
      const sampleRequest = response.data.requests[0];
      console.log('Sample requester format:');
      console.log(JSON.stringify(sampleRequest.requester, null, 2));
      
      // Get full request details
      const fullRequest = await client.getRequest(sampleRequest.id);
      console.log('\nFull requester details:');
      console.log(JSON.stringify(fullRequest.requester, null, 2));
    }
  } catch (error) {
    console.error('Failed to get sample request:', error.message);
  }
  
  // Test different requester formats
  const requesterFormats = [
    { email_id: 'test@example.com' },
    { email_id: 'test@example.com', name: 'Test User' },
    { name: 'Kalten Morris', email_id: 'kalten.morris@kaltenberg.com' },
    { id: '216826000000005323', name: 'Office 365 Account' }  // Known requester
  ];
  
  for (const requester of requesterFormats) {
    console.log(`\nTesting requester format: ${JSON.stringify(requester)}`);
    
    try {
      const testRequest = {
        subject: 'Test Request - Requester Format',
        description: 'Testing different requester formats',
        mode: { name: 'Web Form' },
        request_type: { name: 'Incident' },
        urgency: { name: '2 - General Concern' },
        level: { name: '1 - Frontline' },
        impact: { name: '1 - Affects User' },
        category: { name: 'Software' },
        subcategory: { name: 'Application' },
        status: { name: 'Open' },
        priority: { name: 'z - Medium' },
        requester: requester
      };
      
      const params = {
        input_data: JSON.stringify({ request: testRequest })
      };
      
      const response = await client.client.post('/requests', null, { params });
      console.log('✅ SUCCESS! Request created with ID:', response.data.request.id);
      
      // Clean up - close the request
      await client.closeRequest(response.data.request.id, {
        closure_code: { name: 'Resolved' },
        closure_comments: 'Test completed'
      });
      console.log('   Request closed successfully');
      break;  // Stop on first success
      
    } catch (error) {
      console.log('❌ FAILED:', error.response?.status);
      if (error.response?.data?.response_status?.messages) {
        error.response.data.response_status.messages.forEach(msg => {
          console.log(`   ${msg.field || 'Error'}: ${msg.message}`);
        });
      }
    }
  }
}

async function main() {
  try {
    await testRequesterFormats();
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main().catch(console.error);