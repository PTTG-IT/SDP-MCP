#!/usr/bin/env node

/**
 * Test create request without priority field at all
 */

const axios = require('axios');
const { SDPOAuthClient } = require('../src/sdp-oauth-client.cjs');

async function testNoPriority() {
  try {
    console.log('Testing create request without priority field...\n');
    
    const oauth = new SDPOAuthClient();
    const token = await oauth.getAccessToken();
    
    const client = axios.create({
      baseURL: 'https://helpdesk.pttg.com/app/itdesk/api/v3',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    
    const request = {
      subject: 'Test Request without Priority',
      description: 'Testing create request without priority field',
      mode: { name: 'Web Form' },
      request_type: { name: 'Incident' },
      urgency: { name: '2 - General Concern' },
      level: { name: '1 - Frontline' },
      impact: { name: '1 - Affects User' },
      category: { name: 'Software' },
      status: { name: 'Open' },
      requester: { email_id: 'office365alerts@microsoft.com' }
    };
    
    console.log('Sending request:', JSON.stringify(request, null, 2));
    
    try {
      const response = await client.post('/requests', null, {
        params: {
          input_data: JSON.stringify({ request })
        }
      });
      console.log('✅ Success! Request created:', response.data.request.id);
      console.log('Full response:', JSON.stringify(response.data.request, null, 2));
    } catch (error) {
      console.log('❌ Failed:', error.response?.data || error.message);
      if (error.response?.data?.response_status?.messages) {
        error.response.data.response_status.messages.forEach(msg => {
          console.log(`  Field: ${msg.field}, Code: ${msg.status_code}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testNoPriority();