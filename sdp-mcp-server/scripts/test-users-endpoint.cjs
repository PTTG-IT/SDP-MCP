#!/usr/bin/env node

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testUsersEndpoint() {
  try {
    console.log('=== Testing Users Endpoint ===');
    
    const client = new SDPAPIClientV2();
    
    // Test /users endpoint
    console.log('1. Testing /users endpoint...');
    try {
      const response = await client.client.get('/users', {
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 3,
              start_index: 0
            }
          })
        }
      });
      
      console.log('✅ /users endpoint works');
      console.log('Response status:', response.status);
      console.log('Users count:', response.data.users?.length || 0);
      
      if (response.data.users && response.data.users.length > 0) {
        console.log('Sample user:');
        const user = response.data.users[0];
        console.log('  Name:', user.name);
        console.log('  Email:', user.email_id);
        console.log('  Is Technician:', user.is_technician);
        console.log('  Role:', user.role?.name || 'N/A');
      }
      
    } catch (error) {
      console.error('❌ /users endpoint failed:', error.message);
    }
    
    // Test using the users API wrapper
    console.log('\n2. Testing users API wrapper...');
    try {
      const usersList = await client.users.listUsers({ limit: 3 });
      console.log('✅ Users API wrapper works');
      console.log('Users found:', usersList.users.length);
      
      if (usersList.users.length > 0) {
        console.log('Sample user via wrapper:');
        const user = usersList.users[0];
        console.log('  Name:', user.name);
        console.log('  Email:', user.email_id);
      }
      
    } catch (error) {
      console.error('❌ Users API wrapper failed:', error.message);
    }
    
    console.log('\n3. Testing listTechnicians with fallback...');
    try {
      const techList = await client.users.listTechnicians({ limit: 3 });
      console.log('✅ listTechnicians works (with fallback)');
      console.log('Technicians found:', techList.technicians.length);
      
      if (techList.technicians.length > 0) {
        console.log('Sample technician:');
        const tech = techList.technicians[0];
        console.log('  Name:', tech.name);
        console.log('  Email:', tech.email_id);
        console.log('  Is Technician:', tech.is_technician);
      }
      
    } catch (error) {
      console.error('❌ listTechnicians failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUsersEndpoint();