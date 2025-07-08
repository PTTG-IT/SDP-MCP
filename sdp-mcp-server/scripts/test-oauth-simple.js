#!/usr/bin/env node

/**
 * Simple OAuth connection test - no dependencies on compiled TypeScript
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

async function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  
  try {
    const content = await fs.readFile(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    });
    return env;
  } catch (error) {
    console.error('❌ Could not read .env file');
    process.exit(1);
  }
}

async function testConnection() {
  console.log('🧪 Testing OAuth Connection (Simple Mode)');
  console.log('========================================\n');
  
  const env = await loadEnv();
  
  // Load tokens
  let tokens;
  try {
    const tokenFile = path.join(__dirname, '..', '.tokens.json');
    const content = await fs.readFile(tokenFile, 'utf8');
    tokens = JSON.parse(content).tokens;
  } catch (error) {
    console.error('❌ No tokens found. Please run:');
    console.error('   npm run setup:oauth:js <authorization-code>');
    process.exit(1);
  }
  
  const dataCenter = env.SDP_DATA_CENTER || 'US';
  const portalName = env.SDP_PORTAL_NAME;
  
  if (!portalName) {
    console.error('❌ Missing SDP_PORTAL_NAME in .env file');
    process.exit(1);
  }
  
  // API endpoints by data center
  const apiHosts = {
    US: 'sdpondemand.manageengine.com',
    EU: 'sdpondemand.manageengine.eu',
    IN: 'sdpondemand.manageengine.in',
    AU: 'sdpondemand.manageengine.com.au',
    JP: 'sdpondemand.manageengine.jp',
    UK: 'sdpondemand.manageengine.uk',
    CA: 'sdpondemand.manageengine.ca',
    CN: 'sdpondemand.manageengine.cn',
  };
  
  const hostname = apiHosts[dataCenter] || apiHosts.US;
  const requestPath = `/app/${portalName}/api/v3/requests?` + 
    `input_data=${encodeURIComponent(JSON.stringify({
      list_info: { row_count: 1, start_index: 0 }
    }))}`;
  
  console.log('📋 Configuration:');
  console.log(`   Data Center: ${dataCenter}`);
  console.log(`   Portal: ${portalName}`);
  console.log(`   Host: ${hostname}`);
  console.log(`   Token: ${tokens.access_token.substring(0, 20)}...`);
  
  const options = {
    hostname,
    port: 443,
    path: requestPath,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Accept': 'application/vnd.manageengine.sdp.v3+json'
    }
  };
  
  console.log('\n🔍 Making API request...');
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('\n✅ Connection Successful!');
        console.log(`   Status: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          console.log(`   Total Requests: ${response.list_info?.total_count || 0}`);
          
          if (response.requests?.[0]) {
            const req = response.requests[0];
            console.log('\n📄 Sample Request:');
            console.log(`   ID: ${req.id}`);
            console.log(`   Subject: ${req.subject}`);
            console.log(`   Status: ${req.status?.name}`);
          }
        } catch (e) {
          console.log('   Response received (could not parse details)');
        }
        
        // Check token expiry
        const expiresAt = new Date(tokens.expires_at || 
          new Date(tokens.obtained_at).getTime() + tokens.expires_in * 1000);
        const remaining = Math.floor((expiresAt - new Date()) / 1000 / 60);
        
        console.log('\n⏰ Token Status:');
        console.log(`   Expires in: ${remaining} minutes`);
        
        if (remaining < 10) {
          console.log('   ⚠️  Token expires soon!');
        }
        
        console.log('\n🎉 OAuth is working correctly!');
        
      } else if (res.statusCode === 401) {
        console.error('\n❌ Authentication Failed (401)');
        console.error('   Token may have expired. Generate a new authorization code.');
      } else {
        console.error(`\n❌ Request Failed: ${res.statusCode}`);
        console.error(`   Response: ${data}`);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('\n❌ Connection Error:', error.message);
  });
  
  req.end();
}

testConnection().catch(console.error);