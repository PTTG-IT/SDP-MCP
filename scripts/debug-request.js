#!/usr/bin/env node

import { config } from 'dotenv';
import axios from 'axios';

config();

async function debugRequest() {
  console.log('🔍 Debug Direct API Request\n');
  
  // Get token first
  const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
  const refreshToken = process.env.SDP_REFRESH_TOKEN;
  
  if (!refreshToken) {
    console.error('No refresh token found in environment');
    return;
  }
  
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
  
  // Now make direct API request
  const baseUrl = process.env.SDP_BASE_URL;
  const instanceName = process.env.SDP_INSTANCE_NAME;
  const apiUrl = `${baseUrl}/app/${instanceName}/api/v3/requests`;
  
  // Test different request formats
  const testFormats = [
    {
      name: 'Minimal - Only subject',
      data: {
        request: {
          subject: 'Direct API Test - Minimal'
        }
      }
    },
    {
      name: 'With requester object',
      data: {
        request: {
          subject: 'Direct API Test - With Requester',
          requester: {
            name: 'Test User',
            email_id: 'test@example.com'
          }
        }
      }
    },
    {
      name: 'With requester ID',
      data: {
        request: {
          subject: 'Direct API Test - With Requester ID',
          requester: {
            id: '1'
          }
        }
      }
    },
    {
      name: 'With all fields from handler',
      data: {
        request: {
          subject: 'Direct API Test - All Fields',
          requester: {
            name: 'Test User',
            email_id: 'test@example.com'
          },
          mode: { name: 'E-Mail' },
          request_type: { name: 'Request' },
          urgency: { name: 'Normal' },
          level: { name: 'Tier 1' },
          status: { name: 'Open' },
          priority: { name: 'Low' },
          category: { name: 'General' }
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
      
      console.log('✅ Success!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      // If successful, we found the working format
      console.log('\n🎯 WORKING FORMAT FOUND!');
      console.log('Use this structure for requests:');
      console.log(JSON.stringify(test.data, null, 2));
      
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
  
  console.log('\n❌ All formats failed. Check the error messages above for clues.');
}

debugRequest().catch(console.error);