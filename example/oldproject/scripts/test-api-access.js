#!/usr/bin/env node
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testAPIAccess() {
  console.log('Testing API access with current credentials...\n');
  
  // Get token first
  const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SDP_CLIENT_ID,
    client_secret: process.env.SDP_CLIENT_SECRET,
    scope: 'SDPOnDemand.requests.ALL'
  });

  try {
    const tokenResponse = await axios.post(tokenUrl, params);
    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Got access token\n');
    
    // Test requests endpoint
    console.log('Testing /requests endpoint...');
    const requestsResponse = await axios.get(
      `${process.env.SDP_BASE_URL}/api/v3/requests`,
      {
        params: {
          input_data: JSON.stringify({
            list_info: { row_count: 2 }
          })
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.manageengine.sdp.v3+json'
        }
      }
    );
    console.log('✅ Requests API works!');
    console.log(`Found ${requestsResponse.data.requests?.length || 0} requests\n`);
    
    // Test projects endpoint (should fail with scope error)
    console.log('Testing /projects endpoint...');
    try {
      const projectsResponse = await axios.get(
        `${process.env.SDP_BASE_URL}/api/v3/projects`,
        {
          params: {
            input_data: JSON.stringify({
              list_info: { row_count: 2 }
            })
          },
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.manageengine.sdp.v3+json'
          }
        }
      );
      console.log('✅ Projects API works!');
      console.log(`Found ${projectsResponse.data.projects?.length || 0} projects`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('❌ Projects API returned 401 - Insufficient scope (expected)');
      } else {
        console.log('❌ Projects API error:', error.response?.status || error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }
}

testAPIAccess();