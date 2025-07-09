#!/usr/bin/env node

/**
 * Test technician/user management functionality with mock API
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testTechnicians() {
  try {
    console.log('Testing technician management with mock API...\n');
    
    // Force mock API usage
    process.env.SDP_USE_MOCK = 'true';
    process.env.SDP_BASE_URL = 'http://localhost:3457';
    
    const client = new SDPAPIClientV2();
    
    // Test 1: List technicians
    console.log('1. Listing technicians...');
    const techList = await client.users.listTechnicians({ limit: 5 });
    console.log(`Found ${techList.total_count} technicians`);
    
    if (techList.technicians.length > 0) {
      console.log('Sample technicians:');
      techList.technicians.forEach(tech => {
        console.log(`  - ${tech.name} (${tech.email_id}) - ID: ${tech.id}`);
        console.log(`    Department: ${tech.department?.name || 'N/A'}`);
        console.log(`    Job Title: ${tech.job_title || 'N/A'}`);
        console.log(`    Is Mock: ${tech.is_mock ? '✅' : '❌'}`);
      });
      
      // Test 2: Get specific technician
      const techId = techList.technicians[0].id;
      console.log(`\n2. Getting details for technician ID: ${techId}...`);
      const techDetails = await client.users.getTechnician(techId);
      console.log('Technician details:');
      console.log(`  Name: ${techDetails.name}`);
      console.log(`  Email: ${techDetails.email_id}`);
      console.log(`  Phone: ${techDetails.phone || 'N/A'}`);
      console.log(`  Mobile: ${techDetails.mobile || 'N/A'}`);
      console.log(`  Cost per hour: ${techDetails.cost_per_hour || 'N/A'}`);
      console.log(`  Is Mock: ${techDetails.is_mock ? '✅' : '❌'}`);
      
      // Test 3: Find technician by email
      const searchEmail = techList.technicians[0].email_id;
      console.log(`\n3. Finding technician by email: ${searchEmail}...`);
      const foundTech = await client.users.findTechnician(searchEmail);
      if (foundTech) {
        console.log(`✅ Found: ${foundTech.name} (ID: ${foundTech.id})`);
        console.log(`   Is Mock: ${foundTech.is_mock ? '✅' : '❌'}`);
      } else {
        console.log('❌ Not found');
      }
      
      // Test 4: Search technicians
      console.log('\n4. Searching for technicians with "admin"...');
      const searchResults = await client.users.listTechnicians({ 
        searchTerm: 'admin',
        limit: 3 
      });
      console.log(`Found ${searchResults.technicians.length} matches`);
      
    } else {
      console.log('No technicians found in the system');
    }
    
    // Test 5: List users
    console.log('\n5. Listing users (requesters)...');
    const userList = await client.users.listUsers({ limit: 5 });
    console.log(`Found ${userList.total_count} users`);
    
    if (userList.users.length > 0) {
      console.log('Sample users:');
      userList.users.slice(0, 3).forEach(user => {
        console.log(`  - ${user.name} (${user.email_id})`);
        console.log(`    Is Mock: ${user.is_mock ? '✅' : '❌'}`);
      });
    }
    
    console.log('\n✅ All technician tests completed with mock API!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }
    process.exit(1);
  }
}

testTechnicians();