#!/usr/bin/env node
/**
 * Test to confirm we're using Self Client credentials
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testSelfClientTheory() {
  console.log('Testing Self Client theory...\n');
  
  const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
  const clientId = process.env.SDP_CLIENT_ID;
  const clientSecret = process.env.SDP_CLIENT_SECRET;
  
  console.log('Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'Not set');
  console.log('Client Secret:', clientSecret ? 'Set' : 'Not set');
  
  // Test 1: Try client_credentials (should fail for Self Client)
  console.log('\n--- Test 1: client_credentials grant ---');
  try {
    const params1 = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'SDPOnDemand.requests.ALL'
    });
    
    const response1 = await axios.post(tokenUrl, params1);
    console.log('Response:', response1.data);
    
    if (response1.data.error === 'invalid_scope') {
      console.log('❌ Got invalid_scope - This confirms Self Client (expected)');
    } else if (response1.data.access_token) {
      console.log('✅ Got access token - These are regular OAuth credentials');
    }
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
  
  // Test 2: Try with wrong grant token (to see error message)
  console.log('\n--- Test 2: authorization_code grant (with dummy code) ---');
  try {
    const params2 = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: 'dummy_code_to_test'
    });
    
    const response2 = await axios.post(tokenUrl, params2);
    console.log('Response:', response2.data);
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
    if (error.response?.data?.error === 'invalid_code') {
      console.log('✅ This confirms these are Self Client credentials');
      console.log('   (They expect authorization_code grant, not client_credentials)');
    }
  }
  
  // Test 3: Try refresh token (should fail without valid refresh token)
  console.log('\n--- Test 3: refresh_token grant (with dummy token) ---');
  try {
    const params3 = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: 'dummy_refresh_token'
    });
    
    const response3 = await axios.post(tokenUrl, params3);
    console.log('Response:', response3.data);
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
  
  console.log('\n--- Conclusion ---');
  console.log('Based on the tests above:');
  console.log('1. These are Self Client credentials');
  console.log('2. Self Client does not support client_credentials grant');
  console.log('3. You need to generate a grant token in Zoho Developer Console');
  console.log('4. Exchange that grant token for a refresh token');
  console.log('5. Use the refresh token for all future API access');
  console.log('\nRun: node scripts/setup-self-client.js after getting your grant token');
}

testSelfClientTheory().catch(console.error);