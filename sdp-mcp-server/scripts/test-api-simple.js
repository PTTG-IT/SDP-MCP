#!/usr/bin/env node

/**
 * Simplified API test with better error handling
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const config = {
  clientId: process.env.SDP_OAUTH_CLIENT_ID,
  clientSecret: process.env.SDP_OAUTH_CLIENT_SECRET,
  refreshToken: process.env.SDP_OAUTH_REFRESH_TOKEN,
  portalName: process.env.SDP_PORTAL_NAME || 'kaltentech',
  dataCenter: process.env.SDP_DATA_CENTER || 'US'
};

// Get domain
const domains = { US: 'com', EU: 'eu', IN: 'in', AU: 'com.au', JP: 'jp', UK: 'uk', CA: 'ca', CN: 'com.cn' };
const domain = domains[config.dataCenter] || 'com';

console.log('🔧 Service Desk Plus API Test (Simplified)');
console.log('=========================================\n');

// Step 1: Get access token
async function getAccessToken() {
  console.log('📡 Getting access token...');
  
  try {
    const response = await axios.post(
      `https://accounts.zoho.${domain}/oauth/v2/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    
    console.log('✅ Access token obtained');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get access token:', error.response?.data || error.message);
    throw error;
  }
}

// Step 2: Test different API calls
async function testApiCalls(accessToken) {
  const baseUrl = `https://sdpondemand.manageengine.${domain}/app/${config.portalName}/api/v3`;
  
  console.log('\n📡 Testing API calls...');
  console.log(`Base URL: ${baseUrl}`);
  
  // Test 1: Simple GET without parameters
  console.log('\n1️⃣ Test: Simple GET /requests');
  try {
    const response = await axios.get(`${baseUrl}/requests`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    console.log('✅ Success! Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    if (error.response?.data?.response_status?.messages) {
      console.error('Error details:', JSON.stringify(error.response.data.response_status.messages, null, 2));
    }
  }
  
  // Test 2: GET with minimal input_data
  console.log('\n2️⃣ Test: GET /requests with minimal input_data');
  try {
    const response = await axios.get(`${baseUrl}/requests`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      },
      params: {
        input_data: JSON.stringify({
          list_info: {
            row_count: 5
          }
        })
      }
    });
    console.log('✅ Success! Total count:', response.data.list_info?.total_count);
    console.log('Returned requests:', response.data.requests?.length || 0);
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    if (error.response?.data?.response_status?.messages) {
      console.error('Error details:', JSON.stringify(error.response.data.response_status.messages, null, 2));
    }
  }
  
  // Test 3: GET with full input_data (as in original)
  console.log('\n3️⃣ Test: GET /requests with full input_data');
  try {
    const response = await axios.get(`${baseUrl}/requests`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      },
      params: {
        input_data: JSON.stringify({
          list_info: {
            row_count: 10,
            start_index: 0,
            sort_field: 'created_time',
            sort_order: 'desc'
          }
        })
      }
    });
    console.log('✅ Success! Response received');
    console.log('List info:', JSON.stringify(response.data.list_info, null, 2));
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    if (error.response?.data?.response_status?.messages) {
      console.error('Error details:', JSON.stringify(error.response.data.response_status.messages, null, 2));
    }
  }
  
  // Test 4: Try a different endpoint
  console.log('\n4️⃣ Test: GET /technicians (different endpoint)');
  try {
    const response = await axios.get(`${baseUrl}/technicians`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    console.log('✅ Success! Technicians count:', response.data.technicians?.length || 0);
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    if (error.response?.data?.response_status?.messages) {
      console.error('Error details:', JSON.stringify(error.response.data.response_status.messages, null, 2));
    }
  }
  
  // Test 5: Test with different sort field
  console.log('\n5️⃣ Test: GET /requests with different sort field');
  try {
    const response = await axios.get(`${baseUrl}/requests`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      },
      params: {
        input_data: JSON.stringify({
          list_info: {
            row_count: 5,
            start_index: 0,
            sort_field: 'id',
            sort_order: 'desc'
          }
        })
      }
    });
    console.log('✅ Success! Response received');
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    if (error.response?.data?.response_status?.messages) {
      console.error('Error details:', JSON.stringify(error.response.data.response_status.messages, null, 2));
    }
  }
}

// Main function
async function main() {
  if (!config.refreshToken) {
    console.error('❌ No refresh token found. Please run the OAuth setup first.');
    process.exit(1);
  }
  
  try {
    const accessToken = await getAccessToken();
    await testApiCalls(accessToken);
    
    console.log('\n📝 API Testing Notes:');
    console.log('- Check which tests succeeded vs failed');
    console.log('- Error 4000 typically means invalid request format');
    console.log('- Error 4001 means JSON parsing error');
    console.log('- Error 4004 means internal server error');
    
  } catch (error) {
    console.error('\n❌ Testing failed');
    process.exit(1);
  }
}

// Run
main();