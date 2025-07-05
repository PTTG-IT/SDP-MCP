#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';

config();

async function testDirectWithRequester() {
  console.log('🔍 Direct API Test with Valid Requester\n');
  
  // Get token first
  const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
  const refreshToken = process.env.SDP_REFRESH_TOKEN;
  
  console.log('Getting access token...');
  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.SDP_CLIENT_ID,
    client_secret: process.env.SDP_CLIENT_SECRET,
  });
  
  const tokenResponse = await axios.post(tokenUrl, tokenParams);
  const accessToken = tokenResponse.data.access_token;
  console.log('✅ Got access token\n');
  
  const baseUrl = process.env.SDP_BASE_URL;
  const instanceName = process.env.SDP_INSTANCE_NAME;
  const apiUrl = `${baseUrl}/app/${instanceName}/api/v3/requests`;
  
  // Valid requester ID from previous test
  const validRequesterId = '216826000000549517';
  
  // Test different formats with valid requester ID
  const testFormats = [
    {
      name: 'Valid requester ID with all required fields',
      data: {
        request: {
          subject: 'Direct API Test - Valid Requester',
          requester: { id: validRequesterId },
          mode: { name: 'E-Mail' },
          request_type: { name: 'Service Request' },
          urgency: { name: 'Low' },
          level: { name: 'Tier 1' },
          impact: { name: 'Affects User' },
          category: { name: 'General' },
          subcategory: { name: 'General' },
          status: { name: 'Open' }
        }
      }
    },
    {
      name: 'Try without subcategory',
      data: {
        request: {
          subject: 'Direct API Test - No Subcategory',
          requester: { id: validRequesterId },
          mode: { name: 'E-Mail' },
          request_type: { name: 'Service Request' },
          urgency: { name: 'Low' },
          level: { name: 'Tier 1' },
          impact: { name: 'Affects User' },
          category: { name: 'General' },
          status: { name: 'Open' }
        }
      }
    },
    {
      name: 'Try with only required fields from error',
      data: {
        request: {
          subject: 'Direct API Test - Only Required',
          requester: { id: validRequesterId },
          mode: { name: 'E-Mail' },
          request_type: { name: 'Service Request' },
          urgency: { name: 'Low' },
          level: { name: 'Tier 1' },
          impact: { name: 'Affects User' },
          category: { name: 'General' },
          subcategory: { name: 'General' },
          status: { name: 'Open' }
        }
      }
    }
  ];
  
  for (const test of testFormats) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log('Request data:', JSON.stringify(test.data, null, 2));
    
    try {
      const params = new URLSearchParams();
      params.append('input_data', JSON.stringify(test.data));
      
      const response = await axios.post(apiUrl, params, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.manageengine.sdp.v3+json',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('✅ SUCCESS!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      // Clean up - close the request
      const requestId = response.data.request.id;
      console.log('\n🧹 Cleaning up - closing request...');
      
      const closeParams = new URLSearchParams();
      closeParams.append('input_data', JSON.stringify({
        request: {
          status: { name: 'Closed' },
          closure_info: {
            closure_comments: 'Test completed - closing request'
          }
        }
      }));
      
      try {
        await axios.put(`${apiUrl}/${requestId}`, closeParams, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.manageengine.sdp.v3+json',
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        console.log('✅ Request closed successfully');
      } catch (e) {
        console.log('⚠️  Could not close request:', e.message);
      }
      
      return;
    } catch (error) {
      console.log('❌ Failed');
      if (error.response?.data) {
        console.log('Error response:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('Error:', error.message);
      }
    }
  }
  
  console.log('\n❌ All formats failed.');
}

testDirectWithRequester().catch(console.error);