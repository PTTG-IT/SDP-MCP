#!/usr/bin/env node
/**
 * Quick test to check if OAuth rate limit has cleared
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function checkRateLimit() {
  console.log('Checking OAuth rate limit status...\n');
  
  const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
  
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SDP_CLIENT_ID,
    client_secret: process.env.SDP_CLIENT_SECRET,
    scope: 'SDPOnDemand.requests.ALL',
  });

  try {
    console.log('Attempting to request OAuth token...');
    const startTime = Date.now();
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    const endTime = Date.now();
    console.log(`Response received in ${endTime - startTime}ms`);
    
    if (response.data.access_token) {
      console.log('\n✅ SUCCESS: Rate limit has cleared!');
      console.log('Token Type:', response.data.token_type);
      console.log('Expires In:', response.data.expires_in, 'seconds');
      console.log('Scope:', response.data.scope || 'Not specified');
      console.log('\nYou can now use the API again.');
    } else if (response.data.error) {
      console.log('\n⚠️  OAuth error:', response.data.error);
      console.log('Description:', response.data.error_description || 'No description');
    } else {
      console.log('\n❓ Unexpected response:', response.data);
    }
    
  } catch (error) {
    if (error.response?.data?.error_description?.includes('too many requests')) {
      console.log('\n❌ RATE LIMITED: Still need to wait');
      console.log('Error:', error.response.data.error_description);
      
      // Try to estimate wait time
      const now = new Date();
      console.log('\nCurrent time:', now.toLocaleTimeString());
      console.log('Try again after 10 minutes from your last attempt.');
    } else {
      console.log('\n❌ Error:', error.response?.data || error.message);
    }
  }
}

checkRateLimit().catch(console.error);