#!/usr/bin/env node

/**
 * Test create request with requester email
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testWithRequester() {
  try {
    console.log('Testing create request with requester...\n');
    
    const client = new SDPAPIClientV2();
    
    // Test with requester email from existing request
    console.log('Creating request with requester email...');
    
    // First, let's manually test without going through createRequest
    const oauth = client.oauth;
    const token = await oauth.getAccessToken();
    
    const axios = require('axios');
    const directClient = axios.create({
      baseURL: 'https://helpdesk.pttg.com/app/itdesk/api/v3',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    
    const testRequest = {
      subject: 'Test Request from API',
      description: 'This is a test request created via API',
      status: { name: 'Open' },
      requester: { email_id: 'office365alerts@microsoft.com' }
    };
    
    console.log('Sending request without priority field...');
    const response = await directClient.post('/requests', null, {
      params: {
        input_data: JSON.stringify({ request: testRequest })
      }
    });
    
    console.log('✅ Success! Request created:', response.data.request.id);
    console.log('Details:', JSON.stringify(response.data.request, null, 2));
    
    console.log('✅ Success! Request created:', request.id);
    console.log('Details:', JSON.stringify(request, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

testWithRequester();