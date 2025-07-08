#!/usr/bin/env node

/**
 * Test create request using a template
 */

const axios = require('axios');
const { SDPOAuthClient } = require('../src/sdp-oauth-client.cjs');

async function testWithTemplate() {
  try {
    console.log('Testing create request with template...\n');
    
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
    
    // Test with template
    console.log('Using Default Incident template...');
    const request = {
      subject: 'Test Request with Template',
      description: 'Testing create request using template',
      template: { id: '216826000000006655' },  // Default Incident template
      priority: { id: '216826000000006801' },  // 2 - Normal
      impact: { id: '216826000000008042' },    // 1 - Affects User
      category: { id: '216826000000288100' }   // Hardware
    };
    
    try {
      console.log('Sending request:', JSON.stringify(request, null, 2));
      const response = await client.post('/requests', null, {
        params: {
          input_data: JSON.stringify({ request })
        }
      });
      console.log('✅ Success! Request created:', response.data.request.id);
      console.log('Details:', JSON.stringify(response.data.request, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.response?.data || error.message);
      if (error.response?.data?.response_status?.messages) {
        error.response.data.response_status.messages.forEach(msg => {
          console.log(`  - ${msg.field || 'General'}: ${msg.message || 'Error'}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testWithTemplate();