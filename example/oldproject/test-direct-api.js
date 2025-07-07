#!/usr/bin/env node

import { config } from 'dotenv';
import { getClientV2 } from './dist/utils/clientFactoryV2.js';

config();

async function testDirectAPI() {
  console.log('🧪 Testing Direct API with Self-Client Auth\n');
  
  try {
    // Create client with credentials
    const client = getClientV2({
      clientId: '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU',
      clientSecret: '5752f7060c587171f81b21d58c5b8d0019587ca999',
      baseUrl: 'https://helpdesk.pttg.com',
      instanceName: 'itdesk',
      authCode: '',
      refreshToken: '1000.230f6615807edcbeb20dbe397b50e836.635ca41b7d8dd576174f07ea1232ef7d'
    });
    
    console.log('✅ Client created\n');
    
    // Test 1: Create a request
    console.log('📝 Creating test request...');
    const request = await client.requests.create({
      subject: 'Test Request - Self-Client Auth Implementation',
      description: 'This is a test request created to verify the self-client authentication implementation is working correctly.',
      requester: {
        email_id: 'test@example.com',
        name: 'Test User'
      },
      priority: { name: 'Low' },
      mode: { name: 'E-Mail' },
      request_type: { name: 'Incident' }
    });
    
    console.log('✅ Request created successfully!');
    console.log(`   ID: ${request.id}`);
    console.log(`   Subject: ${request.subject}`);
    console.log(`   Status: ${request.status?.name}`);
    
    // Test 2: Get the request
    console.log('\n🔍 Fetching request details...');
    const fetchedRequest = await client.requests.get(request.id);
    console.log('✅ Request fetched successfully!');
    console.log(`   Created: ${fetchedRequest.created_time}`);
    
    // Test 3: Add a note
    console.log('\n💬 Adding a note...');
    await client.requests.addNote(request.id, {
      content: 'Test note - Self-client authentication verified',
      is_public: true
    });
    console.log('✅ Note added successfully!');
    
    // Test 4: Close the request
    console.log('\n🔒 Closing the request...');
    await client.requests.close(request.id, {
      closure_comments: 'Test completed successfully - Self-client auth working',
      closure_code: { name: 'Completed' }
    });
    console.log('✅ Request closed successfully!');
    
    console.log('\n🎉 All tests passed! Self-client authentication is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\nError details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });
    process.exit(1);
  }
}

testDirectAPI().catch(console.error);