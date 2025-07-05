#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';

config();

async function testMinimalRequest() {
  console.log('🧪 Testing Minimal Request Creation\n');
  
  const client = getClient();
  
  // Test 1: Only subject (as per documentation)
  console.log('Test 1: Creating request with only subject...');
  try {
    const request1 = await client.requests.create({
      subject: 'Test - Only Subject'
    });
    console.log('✅ Success! Only subject is required');
    console.log('Request ID:', request1.id);
    return;
  } catch (error) {
    console.log('❌ Failed with only subject');
    if (error.validationErrors?.response_status?.messages) {
      console.log('Missing fields:');
      error.validationErrors.response_status.messages.forEach(msg => {
        console.log(`  - ${msg.field} (code: ${msg.status_code})`);
      });
    }
  }
  
  // Test 2: Add requester
  console.log('\nTest 2: Adding requester...');
  try {
    const request2 = await client.requests.create({
      subject: 'Test - With Requester',
      requester: {
        name: 'Test User',
        email_id: 'test@example.com'
      }
    });
    console.log('✅ Success! Subject + requester is enough');
    console.log('Request ID:', request2.id);
    return;
  } catch (error) {
    console.log('❌ Failed with subject + requester');
    if (error.validationErrors?.response_status?.messages) {
      console.log('Missing fields:');
      error.validationErrors.response_status.messages.forEach(msg => {
        console.log(`  - ${msg.field} (code: ${msg.status_code})`);
      });
    }
  }
  
  // Test 3: Add mode
  console.log('\nTest 3: Adding mode...');
  try {
    const request3 = await client.requests.create({
      subject: 'Test - With Mode',
      requester: {
        name: 'Test User',
        email_id: 'test@example.com'
      },
      mode: { name: 'E-Mail' }
    });
    console.log('✅ Success! Subject + requester + mode is enough');
    console.log('Request ID:', request3.id);
    return;
  } catch (error) {
    console.log('❌ Failed with subject + requester + mode');
    if (error.validationErrors?.response_status?.messages) {
      console.log('Missing fields:');
      error.validationErrors.response_status.messages.forEach(msg => {
        console.log(`  - ${msg.field} (code: ${msg.status_code})`);
      });
    }
  }
  
  // Test 4: Add request_type
  console.log('\nTest 4: Adding request_type...');
  try {
    const request4 = await client.requests.create({
      subject: 'Test - With Request Type',
      requester: {
        name: 'Test User',
        email_id: 'test@example.com'
      },
      mode: { name: 'E-Mail' },
      request_type: { name: 'Request' }
    });
    console.log('✅ Success!');
    console.log('Request ID:', request4.id);
    return;
  } catch (error) {
    console.log('❌ Failed');
    if (error.validationErrors?.response_status?.messages) {
      console.log('Missing fields:');
      error.validationErrors.response_status.messages.forEach(msg => {
        console.log(`  - ${msg.field} (code: ${msg.status_code})`);
      });
    }
  }
  
  // Test 5: Try different field values
  console.log('\nTest 5: Testing different field values...');
  const fieldVariations = [
    { impact: { name: 'Low' } },
    { impact: { name: 'Medium' } },
    { impact: { name: 'High' } },
    { impact: { name: 'None' } },
    { impact: { name: 'User' } },
    { impact: { name: 'Affects User' } },
    { impact: { name: 'Affects Group' } },
    { impact: { name: 'Affects Department' } },
    { impact: { name: 'Affects Business' } }
  ];
  
  for (const variation of fieldVariations) {
    try {
      console.log(`\nTrying impact: "${variation.impact.name}"`);
      const request = await client.requests.create({
        subject: 'Test - Impact Variation',
        requester: {
          name: 'Test User',
          email_id: 'test@example.com'
        },
        mode: { name: 'E-Mail' },
        request_type: { name: 'Request' },
        ...variation
      });
      console.log(`✅ Success with impact: "${variation.impact.name}"`);
      console.log('Request ID:', request.id);
      
      // Clean up - close the request
      try {
        await client.requests.update(request.id, {
          status: { name: 'Closed' }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
      return;
    } catch (error) {
      console.log(`❌ Failed with impact: "${variation.impact.name}"`);
    }
  }
}

testMinimalRequest().catch(console.error);