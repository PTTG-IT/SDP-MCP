#!/usr/bin/env node

/**
 * Setup OAuth for Service Desk Plus
 * Run this once to exchange authorization code for tokens
 */

const { SDPOAuthClient } = require('../src/sdp-oauth-client.js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
  console.log('🔐 Service Desk Plus OAuth Setup');
  console.log('================================\n');
  
  // Check for environment variables
  const clientId = process.env.SDP_CLIENT_ID;
  const clientSecret = process.env.SDP_CLIENT_SECRET;
  const dataCenter = process.env.SDP_DATA_CENTER || 'US';
  
  if (!clientId || !clientSecret) {
    console.error('❌ Missing OAuth credentials in environment');
    console.error('Please set SDP_CLIENT_ID and SDP_CLIENT_SECRET');
    process.exit(1);
  }
  
  console.log('📋 OAuth Configuration:');
  console.log(`   Client ID: ${clientId.substring(0, 20)}...`);
  console.log(`   Data Center: ${dataCenter}`);
  console.log('');
  
  // Get authorization code
  const authCode = await question('🔑 Enter your authorization code (expires in 10 minutes): ');
  const redirectUri = await question('🔗 Enter redirect URI (default: https://localhost:3000/callback): ') 
    || 'https://localhost:3000/callback';
  
  console.log('\n🔄 Exchanging authorization code...');
  
  try {
    const oauth = new SDPOAuthClient({
      clientId,
      clientSecret,
      dataCenter
    });
    
    const tokens = await oauth.exchangeAuthCode(authCode.trim(), redirectUri);
    
    console.log('\n✅ OAuth setup successful!');
    console.log(`   Access Token: ${tokens.accessToken.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${tokens.refreshToken.substring(0, 20)}...`);
    console.log(`   Expires In: ${tokens.expiresIn} seconds`);
    console.log('\n📁 Tokens saved to .sdp-tokens.json');
    console.log('\n🚀 You can now start using the MCP server!');
    
    // Also show how to set refresh token as env variable
    console.log('\n💡 For production, add to your .env:');
    console.log(`SDP_REFRESH_TOKEN=${tokens.refreshToken}`);
    
  } catch (error) {
    console.error('\n❌ OAuth setup failed:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
    process.exit(1);
  }
  
  rl.close();
}

main().catch(console.error);