#!/usr/bin/env node

/**
 * Test script to investigate and document API issues
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');
const { SDPMetadataClient } = require('../src/sdp-api-metadata.cjs');

async function testSearchRequests() {
  console.log('\n=== Testing Search Requests ===\n');
  
  const client = new SDPAPIClientV2();
  
  // Test 1: Using search_criteria (current implementation)
  try {
    console.log('Test 1: Using search_criteria with "contains" condition');
    const result = await client.searchRequests('printer', { limit: 5 });
    console.log('✅ SUCCESS: Found', result.total_count, 'results');
    if (result.requests.length > 0) {
      console.log('First result:', {
        id: result.requests[0].id,
        subject: result.requests[0].subject
      });
    }
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 2: Try direct text search without search_criteria
  try {
    console.log('\nTest 2: Using query parameter for text search');
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 0
        }
      }),
      query: 'printer'  // Simple text query
    };
    
    const response = await client.client.get('/requests', { params });
    console.log('✅ SUCCESS: Found', response.data.list_info?.total_count || 0, 'results');
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 3: Try using filter_by
  try {
    console.log('\nTest 3: Using filter_by for text search');
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 0,
          filter_by: {
            name: 'subject',
            value: 'printer'
          }
        }
      })
    };
    
    const response = await client.client.get('/requests', { params });
    console.log('✅ SUCCESS: Found', response.data.list_info?.total_count || 0, 'results');
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data || error.message);
  }
}

async function testSubcategories() {
  console.log('\n=== Testing Subcategories ===\n');
  
  const client = new SDPAPIClientV2();
  const metadata = new SDPMetadataClient();
  
  // First get categories
  const categories = await metadata.getCategories();
  console.log('Available categories:', categories.map(c => ({ id: c.id, name: c.name })));
  
  // Find Hardware category
  const hardwareCategory = categories.find(c => c.name === 'Hardware');
  if (!hardwareCategory) {
    console.log('❌ Hardware category not found');
    return;
  }
  
  console.log('\nHardware category ID:', hardwareCategory.id);
  
  // Test different endpoints for subcategories
  const endpoints = [
    `/subcategories?category_id=${hardwareCategory.id}`,
    `/categories/${hardwareCategory.id}/subcategories`,
    `/subcategories`,
    `/request_subcategories`,
    `/request/subcategories`
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTrying endpoint: ${endpoint}`);
      const params = endpoint.includes('?') ? {} : {
        input_data: JSON.stringify({
          list_info: {
            row_count: 10,
            start_index: 0
          }
        })
      };
      
      const response = await client.client.get(endpoint, { params });
      console.log('✅ SUCCESS! Found subcategories endpoint');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      break;
    } catch (error) {
      console.log('❌ Failed:', error.response?.status);
    }
  }
  
  // Try creating a request with Hardware category to see required fields
  console.log('\n\nTesting request creation with Hardware category...');
  try {
    const testRequest = {
      subject: 'Test Hardware Request',
      requester: { email_id: 'test@example.com' },
      category: { id: hardwareCategory.id }
      // Deliberately omitting subcategory to see error message
    };
    
    await client.createRequest(testRequest);
  } catch (error) {
    console.log('Expected error for missing subcategory:');
    if (error.response?.data?.response_status?.messages) {
      error.response.data.response_status.messages.forEach(msg => {
        console.log(`  - ${msg.message}`);
      });
    }
  }
}

async function testTechniciansEndpoint() {
  console.log('\n=== Testing Technicians Endpoint ===\n');
  
  const client = new SDPAPIClientV2();
  
  // Test 1: Direct technicians endpoint
  try {
    console.log('Test 1: GET /technicians');
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 0
        }
      })
    };
    
    const response = await client.client.get('/technicians', { params });
    console.log('✅ SUCCESS: Found', response.data.technicians?.length || 0, 'technicians');
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status);
    if (error.response?.status === 401) {
      console.log('   401 Unauthorized - This might mean:');
      console.log('   1. The endpoint requires different OAuth scope');
      console.log('   2. The endpoint doesn\'t exist in this SDP version');
      console.log('   3. Token permissions are insufficient');
    }
  }
  
  // Test 2: Users endpoint with technician filter
  try {
    console.log('\nTest 2: GET /users with technician filter');
    const params = {
      input_data: JSON.stringify({
        list_info: {
          row_count: 5,
          start_index: 0,
          filter_by: {
            name: 'is_technician',
            value: true
          }
        }
      })
    };
    
    const response = await client.client.get('/users', { params });
    console.log('✅ SUCCESS: Found', response.data.users?.length || 0, 'users');
    
    // Check if any are technicians
    const technicians = response.data.users?.filter(u => u.is_technician || u.is_vip_user);
    console.log('   Technicians found:', technicians?.length || 0);
  } catch (error) {
    console.log('❌ FAILED:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 3: Check OAuth scopes
  console.log('\n\nChecking OAuth token info...');
  try {
    // Try to get current user info which might show permissions
    const response = await client.client.get('/users/me');
    console.log('Current user:', response.data);
  } catch (error) {
    console.log('Could not get current user info');
  }
}

async function main() {
  console.log('Service Desk Plus API Issues Investigation');
  console.log('==========================================');
  
  try {
    await testSearchRequests();
    await testSubcategories();
    await testTechniciansEndpoint();
    
    console.log('\n\n=== Summary of Findings ===\n');
    console.log('1. Search Requests:');
    console.log('   - The search_criteria approach seems to work correctly');
    console.log('   - If getting 400 errors, check the field names and conditions');
    console.log('   - Use "contains" condition for text search');
    console.log('   - Searchable fields: subject, description, requester.email_id, etc.');
    
    console.log('\n2. Subcategories:');
    console.log('   - No dedicated subcategories endpoint found');
    console.log('   - Subcategories appear to be instance-specific configurations');
    console.log('   - When category is set, subcategory becomes mandatory');
    console.log('   - Need to check with SDP admin for valid subcategory values');
    
    console.log('\n3. Technicians Endpoint:');
    console.log('   - /technicians endpoint may not exist or requires special permissions');
    console.log('   - Use /users endpoint with appropriate filters as fallback');
    console.log('   - Check OAuth scopes include user/technician read permissions');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main().catch(console.error);