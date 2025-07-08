#!/usr/bin/env node

/**
 * Direct API test to understand Service Desk Plus API behavior
 * This bypasses the MCP server to test raw API calls
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration from environment
const config = {
  clientId: process.env.SDP_OAUTH_CLIENT_ID || '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU',
  clientSecret: process.env.SDP_OAUTH_CLIENT_SECRET || '5752f7060c587171f81b21d58c5b8d0019587ca999',
  portalName: process.env.SDP_PORTAL_NAME || 'kaltentech',
  dataCenter: process.env.SDP_DATA_CENTER || 'US',
  redirectUri: process.env.SDP_OAUTH_REDIRECT_URI || 'https://localhost:3000/callback'
};

// Data center to domain mapping
const dataCenterDomains = {
  US: 'com',
  EU: 'eu',
  IN: 'in',
  AU: 'com.au',
  JP: 'jp',
  UK: 'uk',
  CA: 'ca',
  CN: 'com.cn'
};

// Get domain for data center
const domain = dataCenterDomains[config.dataCenter] || 'com';

// API endpoints
const authUrl = `https://accounts.zoho.${domain}/oauth/v2/token`;
const apiBaseUrl = `https://sdpondemand.manageengine.${domain}/app/${config.portalName}/api/v3`;

console.log('🔧 Service Desk Plus API Test');
console.log('============================\n');
console.log('Configuration:');
console.log(`- Portal: ${config.portalName}`);
console.log(`- Data Center: ${config.dataCenter}`);
console.log(`- Domain: ${domain}`);
console.log(`- API Base: ${apiBaseUrl}`);
console.log(`- Client ID: ${config.clientId.substring(0, 20)}...`);
console.log('\n');

// Function to get access token
async function getAccessToken(refreshToken) {
  try {
    console.log('📡 Requesting access token...');
    const response = await axios.post(authUrl, new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('✅ Access token obtained');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting access token:', error.response?.data || error.message);
    throw error;
  }
}

// Function to test API call
async function testApiCall(accessToken) {
  try {
    console.log('\n📡 Testing API call to list requests...');
    
    const response = await axios.get(`${apiBaseUrl}/requests`, {
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

    console.log('✅ API call successful');
    console.log(`- Total requests: ${response.data.list_info?.total_count || 0}`);
    console.log(`- Returned: ${response.data.requests?.length || 0} requests`);
    
    if (response.data.requests && response.data.requests.length > 0) {
      console.log('\nFirst request:');
      const req = response.data.requests[0];
      console.log(`- ID: ${req.id}`);
      console.log(`- Subject: ${req.subject}`);
      console.log(`- Status: ${req.status?.name || 'N/A'}`);
      console.log(`- Created: ${req.created_time?.display_value || 'N/A'}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ API call failed:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      console.log('💡 Token may be expired or invalid');
    }
    throw error;
  }
}

// Main function
async function main() {
  // Check for refresh token
  const refreshToken = process.env.SDP_OAUTH_REFRESH_TOKEN;
  
  if (!refreshToken) {
    console.error('❌ No refresh token found in environment');
    console.error('\nTo get a refresh token:');
    console.error('1. Run: npm run setup:oauth');
    console.error('2. Follow the OAuth flow in your browser');
    console.error('3. The refresh token will be saved to .env');
    process.exit(1);
  }

  try {
    // Get access token
    const accessToken = await getAccessToken(refreshToken);
    
    // Test API call
    await testApiCall(accessToken);
    
    console.log('\n✅ API connection test completed successfully');
    
    // Document findings
    console.log('\n📝 API Behavior Notes:');
    console.log('- Access tokens are obtained using refresh tokens');
    console.log('- API requires "Accept: application/vnd.manageengine.sdp.v3+json" header');
    console.log('- List operations use input_data parameter with JSON');
    console.log('- Pagination uses start_index and row_count in list_info');
    console.log('- API returns structured JSON with requests array and list_info metadata');
    
  } catch (error) {
    console.error('\n❌ Test failed');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { getAccessToken, testApiCall };