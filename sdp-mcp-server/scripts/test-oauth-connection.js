#!/usr/bin/env node

/**
 * Test OAuth connection to Service Desk Plus
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Get SDP API base URL based on data center
 */
function getAPIBaseURL(dataCenter) {
  const urls = {
    US: 'https://sdpondemand.manageengine.com',
    EU: 'https://sdpondemand.manageengine.eu',
    IN: 'https://sdpondemand.manageengine.in',
    AU: 'https://sdpondemand.manageengine.com.au',
    JP: 'https://sdpondemand.manageengine.jp',
    UK: 'https://sdpondemand.manageengine.uk',
    CA: 'https://sdpondemand.manageengine.ca',
    CN: 'https://sdpondemand.manageengine.cn',
  };
  
  return urls[dataCenter] || urls.US;
}

/**
 * Test API connection with token
 */
async function testConnection() {
  console.log('🧪 Testing Service Desk Plus OAuth Connection');
  console.log('============================================\n');
  
  try {
    // Load tokens from file
    const { promises: fs } = await import('fs');
    const tokenFile = path.join(__dirname, '..', '.tokens.json');
    
    let tokenData;
    try {
      const content = await fs.readFile(tokenFile, 'utf8');
      tokenData = JSON.parse(content);
    } catch (error) {
      console.error('❌ No tokens found. Please run setup-oauth-tokens.js first.');
      process.exit(1);
    }
    
    const { tokens } = tokenData;
    const dataCenter = process.env.SDP_DATA_CENTER || 'US';
    const baseURL = getAPIBaseURL(dataCenter);
    const portalName = process.env.SDP_PORTAL_NAME;
    
    if (!portalName) {
      console.error('❌ Missing SDP_PORTAL_NAME in .env file');
      process.exit(1);
    }
    
    console.log('📋 Configuration:');
    console.log(`   Data Center: ${dataCenter}`);
    console.log(`   Portal Name: ${portalName}`);
    console.log(`   API URL: ${baseURL}`);
    console.log(`   Token: ${tokens.access_token.substring(0, 20)}...`);
    
    // Test API call - Get first request
    console.log('\n🔍 Testing API access...');
    
    const response = await axios.get(
      `${baseURL}/app/${portalName}/api/v3/requests`,
      {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/vnd.manageengine.sdp.v3+json',
        },
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 1,
              start_index: 0,
            },
          }),
        },
      }
    );
    
    console.log('\n✅ API Connection Successful!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Total Requests: ${response.data.list_info?.total_count || 0}`);
    
    if (response.data.requests && response.data.requests.length > 0) {
      const request = response.data.requests[0];
      console.log('\n📄 Sample Request:');
      console.log(`   ID: ${request.id}`);
      console.log(`   Subject: ${request.subject}`);
      console.log(`   Status: ${request.status?.name}`);
      console.log(`   Created: ${new Date(parseInt(request.created_time.value)).toLocaleString()}`);
    }
    
    // Check token expiry
    const obtainedAt = new Date(tokens.obtained_at);
    const expiresAt = new Date(obtainedAt.getTime() + (tokens.expires_in * 1000));
    const now = new Date();
    const remainingTime = Math.floor((expiresAt - now) / 1000 / 60);
    
    console.log('\n⏰ Token Status:');
    console.log(`   Obtained: ${obtainedAt.toLocaleString()}`);
    console.log(`   Expires: ${expiresAt.toLocaleString()}`);
    console.log(`   Remaining: ${remainingTime} minutes`);
    
    if (remainingTime < 10) {
      console.log('\n⚠️  Token will expire soon! The server will auto-refresh it.');
    }
    
    console.log('\n🎉 Everything is working! Your OAuth setup is complete.');
    
  } catch (error) {
    console.error('\n❌ Connection test failed:');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.error('\n⚠️  Authentication failed. Your token may have expired.');
        console.error('   Run setup-oauth-tokens.js with a new authorization code.');
      }
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testConnection().catch(console.error);