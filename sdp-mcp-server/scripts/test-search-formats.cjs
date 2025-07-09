#!/usr/bin/env node

/**
 * Test different search formats to find the correct one
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testSearchFormats() {
  const client = new SDPAPIClientV2();
  
  console.log('Testing different search formats for Service Desk Plus API\n');
  
  const searchTerm = 'test';
  
  // Test 1: Array format for search_criteria
  console.log('Test 1: Using array format for search_criteria');
  try {
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 0,
          search_criteria: [{
            field: 'subject',
            condition: 'contains',
            value: searchTerm
          }]
        }
      })
    };
    
    const response = await client.client.get('/requests', { params });
    console.log('✅ SUCCESS: Array format works!');
    console.log('Found', response.data.list_info?.total_count || 0, 'results');
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status);
  }
  
  // Test 2: Object format for search_criteria
  console.log('\nTest 2: Using object format for search_criteria');
  try {
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 0,
          search_criteria: {
            field: 'subject',
            condition: 'contains',
            value: searchTerm
          }
        }
      })
    };
    
    const response = await client.client.get('/requests', { params });
    console.log('✅ SUCCESS: Object format works!');
    console.log('Found', response.data.list_info?.total_count || 0, 'results');
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status);
  }
  
  // Test 3: Search multiple fields
  console.log('\nTest 3: Search in multiple fields with OR');
  try {
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 0,
          search_criteria: [{
            field: 'subject',
            condition: 'contains',
            value: searchTerm
          }, {
            field: 'description',
            condition: 'contains',
            value: searchTerm,
            logical_operator: 'OR'
          }]
        }
      })
    };
    
    const response = await client.client.get('/requests', { params });
    console.log('✅ SUCCESS: Multi-field search works!');
    console.log('Found', response.data.list_info?.total_count || 0, 'results');
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status);
  }
  
  // Test 4: Check if we need to specify start_index as 1
  console.log('\nTest 4: Using start_index: 1 instead of 0');
  try {
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 1,  // Changed from 0 to 1
          search_criteria: [{
            field: 'subject',
            condition: 'contains',
            value: searchTerm
          }]
        }
      })
    };
    
    const response = await client.client.get('/requests', { params });
    console.log('✅ SUCCESS: start_index: 1 works!');
    console.log('Found', response.data.list_info?.total_count || 0, 'results');
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status);
  }
  
  // Test 5: Check what happens without search_criteria
  console.log('\nTest 5: List all requests (no search)');
  try {
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 1
        }
      })
    };
    
    const response = await client.client.get('/requests', { params });
    console.log('✅ SUCCESS: Basic list works!');
    console.log('Found', response.data.list_info?.total_count || 0, 'total requests');
    if (response.data.requests?.length > 0) {
      console.log('First request:', {
        id: response.data.requests[0].id,
        subject: response.data.requests[0].subject
      });
    }
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status);
  }
}

async function main() {
  try {
    await testSearchFormats();
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main().catch(console.error);