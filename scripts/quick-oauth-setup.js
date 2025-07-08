#!/usr/bin/env node

/**
 * Quick OAuth Setup for Service Desk Plus
 * Usage: node quick-oauth-setup.js YOUR_AUTH_CODE
 */

const { SDPOAuthClient } = require('../src/sdp-oauth-client.js');

async function main() {
  const authCode = process.argv[2];
  
  if (!authCode) {
    console.error('❌ Usage: node quick-oauth-setup.js YOUR_AUTH_CODE');
    console.error('');
    console.error('Steps:');
    console.error('1. Go to Zoho API Console');
    console.error('2. Click "Generate Code" for your self-client');
    console.error('3. Use scope: SDPOnDemand.requests.ALL');
    console.error('4. Set time: 10 minutes');
    console.error('5. Copy the code and run this script immediately');
    process.exit(1);
  }
  
  console.log('🔐 Quick OAuth Setup');
  console.log('===================\n');
  
  try {
    const oauth = new SDPOAuthClient({
      clientId: process.env.SDP_CLIENT_ID || '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU',
      clientSecret: process.env.SDP_CLIENT_SECRET || '5752f7060c587171f81b21d58c5b8d0019587ca999',
      dataCenter: process.env.SDP_DATA_CENTER || 'US'
    });
    
    console.log('Exchanging code for tokens...');
    const tokens = await oauth.exchangeAuthCode(authCode, 'https://localhost:3000/callback');
    
    console.log('\n✅ Success! Tokens saved to .sdp-tokens.json');
    console.log(`\nRefresh token: ${tokens.refreshToken}`);
    console.log('\n💡 Add this to your .env file:');
    console.log(`SDP_REFRESH_TOKEN=${tokens.refreshToken}`);
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();