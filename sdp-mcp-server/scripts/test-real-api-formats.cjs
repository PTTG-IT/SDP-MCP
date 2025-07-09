#!/usr/bin/env node

/**
 * Test actual API formats that work with Service Desk Plus
 */

const axios = require('axios');
const { SDPOAuthClient } = require('../src/sdp-oauth-client.cjs');

async function testRealAPIFormats() {
  try {
    console.log('=== Testing Real API Formats ===\n');
    
    // Wait a bit to avoid rate limits
    console.log('Waiting 30 seconds to avoid rate limits...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const oauth = SDPOAuthClient.getInstance();
    const token = await oauth.getAccessToken();
    
    const baseURL = 'https://helpdesk.pttg.com/app/itdesk/api/v3';
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.manageengine.sdp.v3+json'
    };
    
    // Test 1: Get metadata to see actual formats
    console.log('1. Getting metadata to understand formats...');
    try {
      const priorities = await axios.get(`${baseURL}/priorities`, { headers });
      console.log('Priority formats:');
      priorities.data.priorities?.slice(0, 5).forEach(p => {
        console.log(`  - ID: ${p.id}, Name: "${p.name}"`);
      });
    } catch (error) {
      console.error('Priorities error:', error.response?.status || error.message);
    }
    
    // Test 2: Get a request to see structure
    console.log('\n2. Getting an existing request to see structure...');
    try {
      const request = await axios.get(`${baseURL}/requests/216826000006445023`, { headers });
      console.log('Request structure:');
      console.log('  Priority:', JSON.stringify(request.data.request.priority));
      console.log('  Status:', JSON.stringify(request.data.request.status));
      console.log('  Category:', JSON.stringify(request.data.request.category));
      console.log('  Urgency:', JSON.stringify(request.data.request.urgency));
      console.log('  Impact:', JSON.stringify(request.data.request.impact));
    } catch (error) {
      console.error('Get request error:', error.response?.status || error.message);
    }
    
    // Test 3: Try different priority formats
    console.log('\n3. Testing priority formats in update...');
    const testPriorities = [
      { priority: { id: '216826000000006805' } },  // ID format
      { priority: { name: '3 - High' } },          // Name format
      { priority: { name: 'High' } },              // Simple name
    ];
    
    for (const test of testPriorities) {
      try {
        console.log(`  Testing: ${JSON.stringify(test)}`);
        const response = await axios.put(
          `${baseURL}/requests/216826000006445023`,
          null,
          {
            headers,
            params: {
              input_data: JSON.stringify({ request: test })
            }
          }
        );
        console.log('  ✅ Success!');
        break;
      } catch (error) {
        console.log(`  ❌ Failed: ${error.response?.data?.response_status?.messages?.[0]?.field || error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testRealAPIFormats();