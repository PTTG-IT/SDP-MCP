#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';

config();

async function testWithValidRequester() {
  console.log('🔍 Testing with Valid Requester ID\n');
  
  const client = getClient();
  
  // First, get a list of valid requesters
  console.log('📋 Fetching requesters...');
  try {
    const response = await client.requesters.list({ per_page: 5 });
    const requesters = response.requesters || [];
    
    if (requesters.length === 0) {
      console.log('❌ No requesters found. Creating one...');
      
      // Create a requester
      const newRequester = await client.requesters.create({
        name: 'Test Requester',
        email_id: 'test.requester@example.com',
        first_name: 'Test',
        last_name: 'Requester'
      });
      
      console.log('✅ Created requester:', newRequester.id);
      requesters.push(newRequester);
    } else {
      console.log(`✅ Found ${requesters.length} requesters:`);
      requesters.forEach(req => {
        console.log(`  - ${req.name} (ID: ${req.id}, Email: ${req.email_id || 'N/A'})`);
      });
    }
    
    // Now try to create a request with the first requester's ID
    const testRequester = requesters[0];
    console.log(`\n🧪 Creating request with requester ID: ${testRequester.id}`);
    
    // First, discover required fields
    console.log('\n📋 Discovering required fields...');
    const discovery = await client.templates.discoverRequiredFields();
    console.log('Required fields:', discovery.requiredFields);
    
    // Try different combinations
    const testCombinations = [
      {
        name: 'With requester ID only',
        data: {
          subject: 'Test - Valid Requester ID',
          requester: { id: testRequester.id }
        }
      },
      {
        name: 'With all required fields (using names)',
        data: {
          subject: 'Test - All Required Fields',
          requester: { id: testRequester.id },
          mode: { name: 'E-Mail' },
          request_type: { name: 'Service Request' },
          urgency: { name: 'Low' },
          level: { name: 'Tier 1' },
          impact: { name: 'Affects User' },
          category: { name: 'General' },
          subcategory: { name: 'General' },
          status: { name: 'Open' }
        }
      },
      {
        name: 'With required fields (different values)',
        data: {
          subject: 'Test - Different Values',
          requester: { id: testRequester.id },
          mode: { name: 'Web Form' },
          request_type: { name: 'Request' },
          urgency: { name: 'Normal' },
          level: { name: 'Level 1' },
          impact: { name: 'Low' },
          category: { name: 'Application' },
          subcategory: { name: 'Application' },
          status: { name: 'Open' }
        }
      }
    ];
    
    for (const test of testCombinations) {
      console.log(`\n📋 ${test.name}`);
      console.log('Data:', JSON.stringify(test.data, null, 2));
      
      try {
        const request = await client.requests.create(test.data);
        console.log('✅ SUCCESS! Request created with ID:', request.id);
        console.log('Request details:', {
          subject: request.subject,
          requester: request.requester?.name,
          status: request.status?.name
        });
        
        // Clean up - close the request
        console.log('\n🧹 Cleaning up - closing request...');
        try {
          await client.requests.update(request.id, {
            status: { name: 'Closed' },
            closure_info: {
              closure_comments: 'Test completed - closing request'
            }
          });
          console.log('✅ Request closed successfully');
        } catch (closeError) {
          console.log('⚠️  Could not close request:', closeError.message);
        }
        
        return;
      } catch (error) {
        console.log('❌ Failed:', error.message);
        if (error.validationErrors?.response_status?.messages) {
          console.log('Validation errors:');
          error.validationErrors.response_status.messages.forEach(msg => {
            console.log(`  - Field: ${msg.field || msg.fields?.join(', ')}, Code: ${msg.status_code}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWithValidRequester().catch(console.error);