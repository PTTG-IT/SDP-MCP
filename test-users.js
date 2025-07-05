import { SDPClient } from './dist/api/client.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new SDPClient({
  clientId: process.env.SDP_CLIENT_ID,
  clientSecret: process.env.SDP_CLIENT_SECRET,
  baseUrl: process.env.SDP_BASE_URL,
  instanceName: process.env.SDP_INSTANCE_NAME,
});

async function testUsers() {
  console.log('Testing Users API...\n');
  
  try {
    // Test 1: Search for requesters
    console.log('1. Testing requester search...');
    try {
      const requesters = await client.requesters.search('admin', { limit: 5 });
      console.log('✅ Requester search successful');
      console.log(`Found ${requesters.requesters?.length || 0} requesters`);
      if (requesters.requesters?.[0]) {
        console.log('Sample requester:', {
          name: requesters.requesters[0].name,
          email: requesters.requesters[0].email_id,
          department: requesters.requesters[0].department?.name
        });
      }
    } catch (error) {
      console.log('❌ Requester search failed:', error.message);
    }
    
    console.log('\n2. Testing technician search...');
    try {
      const technicians = await client.technicians.search('admin', { limit: 5 });
      console.log('✅ Technician search successful');
      console.log(`Found ${technicians.technicians?.length || 0} technicians`);
      if (technicians.technicians?.[0]) {
        console.log('Sample technician:', {
          name: technicians.technicians[0].name,
          email: technicians.technicians[0].email_id,
          department: technicians.technicians[0].department?.name
        });
      }
    } catch (error) {
      console.log('❌ Technician search failed:', error.message);
    }
    
    console.log('\n3. Testing technician list...');
    try {
      const techList = await client.technicians.list({ per_page: 10 });
      console.log('✅ Technician list successful');
      console.log(`Listed ${techList.technicians?.length || 0} technicians`);
    } catch (error) {
      console.log('❌ Technician list failed:', error.message);
    }
    
    console.log('\n4. Testing requester list...');
    try {
      const reqList = await client.requesters.list({ per_page: 10 });
      console.log('✅ Requester list successful');
      console.log(`Listed ${reqList.requesters?.length || 0} requesters`);
    } catch (error) {
      console.log('❌ Requester list failed:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testUsers();