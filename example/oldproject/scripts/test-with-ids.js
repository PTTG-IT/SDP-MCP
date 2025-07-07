#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';

config();

async function testWithIds() {
  console.log('🔍 Testing with Common IDs\n');
  
  // Get token
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
  
  // Valid requester ID from earlier
  const validRequesterId = '216826000000549517';
  
  // Common ID patterns for Service Desk Plus
  const testFormats = [
    {
      name: 'Using common ID pattern 1',
      data: {
        request: {
          subject: 'Test - Using IDs Pattern 1',
          requester: { id: validRequesterId },
          mode: { id: '1' },
          request_type: { id: '1' },
          urgency: { id: '1' },
          level: { id: '1' },
          impact: { id: '1' },
          category: { id: '1' },
          subcategory: { id: '1' },
          status: { id: '1' }
        }
      }
    },
    {
      name: 'Using common ID pattern 2',
      data: {
        request: {
          subject: 'Test - Using IDs Pattern 2',
          requester: { id: validRequesterId },
          mode: { id: '216826000000006685' },
          request_type: { id: '216826000000006655' },
          urgency: { id: '216826000000006755' },
          level: { id: '216826000000006785' },
          impact: { id: '216826000000006765' },
          category: { id: '216826000000006705' },
          status: { id: '216826000000006659' }
        }
      }
    },
    {
      name: 'Mixed approach - some names, some IDs',
      data: {
        request: {
          subject: 'Test - Mixed Approach',
          requester: { id: validRequesterId },
          mode: { name: 'Phone' },
          request_type: { name: 'Incident' },
          urgency: { id: '1' },
          level: { id: '1' },
          impact: { id: '1' },
          category: { name: 'Software' },
          status: { name: 'Open' }
        }
      }
    },
    {
      name: 'Without optional fields',
      data: {
        request: {
          subject: 'Test - Minimal Required',
          requester: { id: validRequesterId },
          mode: { id: '1' },
          request_type: { id: '1' },
          urgency: { id: '1' },
          level: { id: '1' },
          impact: { id: '1' },
          category: { id: '1' },
          status: { id: '1' }
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
      
      // Clean up
      const requestId = response.data.request.id;
      console.log('\n🧹 Cleaning up - closing request...');
      
      const closeParams = new URLSearchParams();
      closeParams.append('input_data', JSON.stringify({
        request: {
          status: { id: '3' }, // Common ID for Closed status
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

testWithIds().catch(console.error);