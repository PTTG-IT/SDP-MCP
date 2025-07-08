#!/usr/bin/env node

/**
 * Simple test of create request with minimal fields
 */

const axios = require('axios');
const { SDPOAuthClient } = require('../src/sdp-oauth-client.cjs');

async function testSimpleCreate() {
  try {
    console.log('Testing simple create request...\n');
    
    // Initialize OAuth
    const oauth = new SDPOAuthClient();
    const token = await oauth.getAccessToken();
    
    // Create axios client
    const client = axios.create({
      baseURL: 'https://helpdesk.pttg.com/app/itdesk/api/v3',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    
    // Test 1: Minimal request
    console.log('Test 1: Minimal request with only subject...');
    const request1 = {
      subject: 'Test Minimal Request'
    };
    
    try {
      const response = await client.post('/requests', null, {
        params: {
          input_data: JSON.stringify({ request: request1 })
        }
      });
      console.log('✅ Success:', response.data);
    } catch (error) {
      console.log('❌ Failed:', error.response?.data || error.message);
    }
    
    // Test 2: With all required fields from error
    console.log('\nTest 2: With all required fields...');
    const request2 = {
      subject: 'Test Full Request',
      description: 'Testing with all fields',
      mode: { name: 'Web Form' },
      request_type: { name: 'Incident' },
      urgency: { name: 'Normal' },
      level: { name: 'Tier 1' },
      impact: { name: '1 - Affects User' },
      status: { name: 'Open' },
      priority: { name: '2 - Normal' }
    };
    
    try {
      const response = await client.post('/requests', null, {
        params: {
          input_data: JSON.stringify({ request: request2 })
        }
      });
      console.log('✅ Success:', response.data);
    } catch (error) {
      console.log('❌ Failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testSimpleCreate();