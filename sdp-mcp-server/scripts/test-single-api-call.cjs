#!/usr/bin/env node

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testSingleAPICall() {
  try {
    console.log('=== Single API Call Test ===');
    
    const client = new SDPAPIClientV2();
    
    // Test a simple call that should work
    console.log('Making a single API call to /technicians...');
    
    const response = await client.client.get('/technicians', {
      params: {
        input_data: JSON.stringify({
          list_info: {
            row_count: 1,
            start_index: 0
          }
        })
      }
    });
    
    console.log('✅ API call successful');
    console.log('Response status:', response.status);
    console.log('Response data keys:', Object.keys(response.data));
    
    if (response.data.technicians) {
      console.log('Technicians count:', response.data.technicians.length);
    }
    
  } catch (error) {
    console.error('❌ API call failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testSingleAPICall();