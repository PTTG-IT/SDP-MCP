#!/usr/bin/env node

const { SDPOAuthClient } = require('../src/sdp-oauth-client.cjs');

async function testTokenRefresh() {
  try {
    console.log('Testing token refresh...');
    
    const oauth = new SDPOAuthClient();
    
    // First call
    console.log('1. First getAccessToken call:');
    const token1 = await oauth.getAccessToken();
    console.log('Got token:', token1.substring(0, 20) + '...');
    
    // Second call - should not refresh
    console.log('2. Second getAccessToken call:');
    const token2 = await oauth.getAccessToken();
    console.log('Got token:', token2.substring(0, 20) + '...');
    
    console.log('Tokens match:', token1 === token2);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testTokenRefresh();