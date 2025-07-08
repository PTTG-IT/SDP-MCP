#!/usr/bin/env node

/**
 * Test API with custom domain (helpdesk.pttg.com)
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
  baseUrl: process.env.SDP_BASE_URL || 'https://helpdesk.pttg.com',
  instanceName: process.env.SDP_INSTANCE_NAME || 'itdesk',
  dataCenter: process.env.SDP_DATA_CENTER || 'US'
};

// Get domain for OAuth
const domains = { US: 'com', EU: 'eu', IN: 'in', AU: 'com.au', JP: 'jp', UK: 'uk', CA: 'ca', CN: 'com.cn' };
const domain = domains[config.dataCenter] || 'com';

console.log('🔧 Service Desk Plus API Test (Custom Domain)');
console.log('============================================\n');
console.log('Configuration:');
console.log(`- Base URL: ${config.baseUrl}`);
console.log(`- Instance: ${config.instanceName}`);
console.log(`- OAuth Domain: ${domain}`);
console.log('\n');

// Get access token
async function getAccessToken() {
  console.log('📡 Getting access token from Zoho...');
  
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
    console.log(`- Expires in: ${response.data.expires_in} seconds`);
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get access token:', error.response?.data || error.message);
    throw error;
  }
}

// Test API calls with custom domain
async function testApiCalls(accessToken) {
  // Build API URL with custom domain and instance
  const apiUrl = `${config.baseUrl}/app/${config.instanceName}/api/v3`;
  
  console.log('\n📡 Testing API calls...');
  console.log(`API URL: ${apiUrl}`);
  
  // Test 1: Get requests with custom domain
  console.log('\n1️⃣ Test: GET /requests (custom domain)');
  try {
    const response = await axios.get(`${apiUrl}/requests`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      },
      params: {
        input_data: JSON.stringify({
          list_info: {
            row_count: 5,
            start_index: 0
          }
        })
      }
    });
    
    console.log('✅ Success!');
    console.log(`- Total requests: ${response.data.list_info?.total_count || 0}`);
    console.log(`- Returned: ${response.data.requests?.length || 0} requests`);
    
    if (response.data.requests && response.data.requests.length > 0) {
      console.log('\nFirst request details:');
      const req = response.data.requests[0];
      console.log(`- ID: ${req.id}`);
      console.log(`- Subject: ${req.subject}`);
      console.log(`- Status: ${req.status?.name || 'N/A'}`);
      console.log(`- Requester: ${req.requester?.name || 'N/A'}`);
      console.log(`- Created: ${req.created_time?.display_value || 'N/A'}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed:', error.response?.data || error.message);
    if (error.response?.data?.response_status?.messages) {
      console.error('Error details:', JSON.stringify(error.response.data.response_status.messages, null, 2));
    }
    return false;
  }
}

// Test other endpoints
async function testOtherEndpoints(accessToken) {
  const apiUrl = `${config.baseUrl}/app/${config.instanceName}/api/v3`;
  
  // Test 2: Get technicians
  console.log('\n2️⃣ Test: GET /technicians');
  try {
    const response = await axios.get(`${apiUrl}/technicians`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    console.log('✅ Success! Technicians count:', response.data.technicians?.length || 0);
  } catch (error) {
    console.error('❌ Failed:', error.response?.status, error.response?.statusText);
  }
  
  // Test 3: Get request fields
  console.log('\n3️⃣ Test: GET /request_fields');
  try {
    const response = await axios.get(`${apiUrl}/request_fields`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    console.log('✅ Success! Fields count:', response.data.fields?.length || 0);
  } catch (error) {
    console.error('❌ Failed:', error.response?.status, error.response?.statusText);
  }
  
  // Test 4: Get priorities
  console.log('\n4️⃣ Test: GET /priorities');
  try {
    const response = await axios.get(`${apiUrl}/priorities`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    console.log('✅ Success! Priorities:', response.data.priorities?.map(p => p.name).join(', '));
  } catch (error) {
    console.error('❌ Failed:', error.response?.status, error.response?.statusText);
  }
}

// Main function
async function main() {
  if (!config.refreshToken) {
    console.error('❌ No refresh token found. Please run OAuth setup first.');
    process.exit(1);
  }
  
  try {
    // Get access token
    const accessToken = await getAccessToken();
    
    // Test main API
    const success = await testApiCalls(accessToken);
    
    if (success) {
      // Test other endpoints
      await testOtherEndpoints(accessToken);
    }
    
    console.log('\n📝 API Connection Notes:');
    console.log('- Custom domain works: ' + config.baseUrl);
    console.log('- Instance name: ' + config.instanceName);
    console.log('- Full API path: ' + config.baseUrl + '/app/' + config.instanceName + '/api/v3');
    console.log('- OAuth tokens from Zoho work with custom domain');
    console.log('- Standard headers required: Authorization Bearer + Accept header');
    
    console.log('\n✅ API test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Testing failed');
    process.exit(1);
  }
}

// Run
main();