#!/usr/bin/env node

/**
 * Debug create request API
 */

const axios = require('axios');
const { SDPOAuthClient } = require('../src/sdp-oauth-client.cjs');

async function debugCreate() {
  try {
    console.log('Debug create request API...\n');
    
    const oauth = new SDPOAuthClient();
    const token = await oauth.getAccessToken();
    
    const client = axios.create({
      baseURL: 'https://helpdesk.pttg.com/app/itdesk/api/v3',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    
    // Add response interceptor to see full error
    client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          console.log('Error Response Status:', error.response.status);
          console.log('Error Response Headers:', error.response.headers);
          console.log('Error Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        return Promise.reject(error);
      }
    );
    
    // Test minimal request
    const request = {
      subject: 'API Test Request'
    };
    
    console.log('Sending minimal request:', JSON.stringify(request, null, 2));
    
    try {
      const response = await client.post('/requests', null, {
        params: {
          input_data: JSON.stringify({ request })
        }
      });
      console.log('✅ Success:', response.data);
    } catch (error) {
      console.log('\n❌ Failed with minimal request\n');
    }
    
    // Test with more fields
    const request2 = {
      subject: 'API Test Request 2',
      requester: { 
        email_id: 'test@pttg.com'
      },
      mode: { name: 'Web Form' },
      request_type: { name: 'Incident' }
    };
    
    console.log('\nSending request with more fields:', JSON.stringify(request2, null, 2));
    
    try {
      const response = await client.post('/requests', null, {
        params: {
          input_data: JSON.stringify({ request: request2 })
        }
      });
      console.log('✅ Success:', response.data);
    } catch (error) {
      console.log('\n❌ Failed with more fields\n');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

debugCreate();