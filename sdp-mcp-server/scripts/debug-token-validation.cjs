#!/usr/bin/env node

const { SDPOAuthClient } = require('../src/sdp-oauth-client.cjs');

async function debugTokenValidation() {
  try {
    console.log('=== Token Validation Debug ===');
    
    const oauth = SDPOAuthClient.getInstance();
    
    // Load tokens manually
    await oauth.loadTokens();
    
    console.log('Current time:', new Date().toISOString());
    console.log('Token expiry:', oauth.tokenExpiry?.toISOString());
    console.log('Token expiry object:', oauth.tokenExpiry);
    console.log('Token expiry type:', typeof oauth.tokenExpiry);
    
    if (oauth.tokenExpiry) {
      const now = new Date().getTime();
      const expiry = oauth.tokenExpiry.getTime();
      const timeLeft = expiry - now;
      const minutesLeft = Math.floor(timeLeft / (1000 * 60));
      
      console.log('Time left (ms):', timeLeft);
      console.log('Minutes left:', minutesLeft);
      
      const expiryBuffer = 5 * 60 * 1000; // 5 minutes
      const isValid = now < (expiry - expiryBuffer);
      console.log('Buffer check:', now, '<', (expiry - expiryBuffer));
      console.log('Is valid (manual):', isValid);
    }
    
    console.log('Is token valid (method):', oauth.isTokenValid());
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error(error.stack);
  }
}

debugTokenValidation();