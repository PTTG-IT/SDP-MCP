#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';

config();

async function findValidRequester() {
  console.log('🔍 Finding Valid Requester Format\n');
  
  const client = getClient();
  
  // First, try to get a list of users to find a valid requester
  console.log('📋 Fetching existing users...');
  try {
    const users = await client.requesters.list({ page: 1, per_page: 5 });
    if (users.data.length > 0) {
      console.log(`✅ Found ${users.data.length} users:`);
      users.data.forEach(user => {
        console.log(`  - ${user.name} (ID: ${user.id}, Email: ${user.email || user.email_id || 'N/A'})`);
      });
      
      // Try creating a request with the first user's ID
      const testUser = users.data[0];
      console.log(`\n🧪 Testing request creation with user ID: ${testUser.id}`);
      
      try {
        const request = await client.requests.create({
          subject: 'Test - With Valid Requester ID',
          requester: { id: testUser.id }
        });
        console.log('✅ Success with just requester ID!');
        console.log('Request created:', request.id);
        
        // Clean up
        try {
          await client.requests.update(request.id, {
            status: { name: 'Closed' }
          });
        } catch (e) {}
        
        return;
      } catch (error) {
        console.log('❌ Failed with requester ID');
        if (error.validationErrors?.response_status?.messages) {
          console.log('Error details:');
          error.validationErrors.response_status.messages.forEach(msg => {
            console.log(`  - Field: ${msg.field}, Code: ${msg.status_code}`);
          });
        }
      }
    }
  } catch (error) {
    console.log('❌ Could not fetch users:', error.message);
  }
  
  // Try different requester formats
  console.log('\n📋 Testing different requester formats...');
  
  const requesterFormats = [
    { requester: { email_id: 'test@example.com' } },
    { requester: { email: 'test@example.com' } },
    { requester: { name: 'Test User' } },
    { requester: { name: 'Test User', email_id: 'test@example.com' } },
    { requester: { name: 'Test User', email: 'test@example.com' } },
    { requester: { id: '1' } },
    { requester: { id: 1 } },
    { requester_email: 'test@example.com' },
    { requester_name: 'Test User' }
  ];
  
  for (let i = 0; i < requesterFormats.length; i++) {
    const format = requesterFormats[i];
    console.log(`\nTest ${i + 1}: ${JSON.stringify(format)}`);
    
    try {
      const requestData = {
        subject: `Test - Requester Format ${i + 1}`,
        ...format
      };
      
      const request = await client.requests.create(requestData);
      console.log(`✅ Success! Request ID: ${request.id}`);
      
      // Found working format, show details
      console.log('\n🎯 Working requester format:');
      console.log(JSON.stringify(format, null, 2));
      
      // Clean up
      try {
        await client.requests.update(request.id, {
          status: { name: 'Closed' }
        });
      } catch (e) {}
      
      return;
    } catch (error) {
      console.log('❌ Failed');
      if (error.validationErrors?.response_status?.messages) {
        error.validationErrors.response_status.messages.forEach(msg => {
          console.log(`   - ${msg.field || 'Unknown field'} (code: ${msg.status_code})`);
        });
      }
    }
  }
  
  console.log('\n❌ Could not find a working requester format');
  console.log('Your Service Desk Plus instance may have specific configuration requirements.');
}

findValidRequester().catch(console.error);