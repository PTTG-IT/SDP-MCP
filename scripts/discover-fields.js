#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';

config();

async function discoverRequiredFields() {
  console.log('🔍 Discovering Required Fields for Request Creation\n');
  
  const client = getClient();
  
  try {
    // Method 1: Try to get templates
    console.log('📋 Method 1: Checking for request templates...');
    const templates = await client.templates.listTemplates();
    if (templates.length > 0) {
      console.log(`✅ Found ${templates.length} templates:`);
      templates.forEach(template => {
        console.log(`\n  Template: ${template.name}`);
        if (template.fields) {
          const mandatoryFields = template.fields.filter(f => f.is_mandatory);
          console.log(`  Mandatory fields: ${mandatoryFields.map(f => f.name).join(', ')}`);
        }
      });
    } else {
      console.log('❌ No templates found or endpoint not available');
    }
    
    // Method 2: Try request types
    console.log('\n📋 Method 2: Checking for request types...');
    const requestTypes = await client.templates.listRequestTypes();
    if (requestTypes.length > 0) {
      console.log(`✅ Found ${requestTypes.length} request types`);
    } else {
      console.log('❌ No request types found or endpoint not available');
    }
    
    // Method 3: Analyze fields through various endpoints
    console.log('\n📋 Method 3: Analyzing request fields...');
    const fieldAnalysis = await client.templates.analyzeRequestFields();
    if (fieldAnalysis) {
      console.log('✅ Field analysis results:', JSON.stringify(fieldAnalysis, null, 2));
    }
    
    // Method 4: Discover through validation error
    console.log('\n📋 Method 4: Discovering required fields through validation...');
    try {
      const discovery = await client.templates.discoverRequiredFields();
      
      console.log('\n🎯 Required Fields Discovery Results:');
      console.log('=====================================');
      console.log('Required fields:', discovery.requiredFields);
      console.log('\nField Details:');
      Object.entries(discovery.fieldDetails).forEach(([field, details]) => {
        console.log(`\n  ${field}:`);
        console.log(`    - Status Code: ${details.statusCode}`);
        console.log(`    - Type: ${details.type}`);
        console.log(`    - Message: ${details.message}`);
      });
    } catch (error) {
      console.log('❌ Could not discover fields through validation:', error.message);
      if (error.validationErrors || error.details) {
        console.log('Validation error details:', JSON.stringify(error.validationErrors || error.details, null, 2));
      }
    }
    
    // Method 5: Try to get valid values for discovered fields
    console.log('\n📋 Method 5: Getting valid values for fields...');
    const fieldsToCheck = ['impact', 'urgency', 'priority', 'mode', 'level', 'request_type'];
    
    for (const field of fieldsToCheck) {
      try {
        let values = [];
        switch(field) {
          case 'impact':
            values = await client.lookups.getImpacts();
            break;
          case 'urgency':
            values = await client.lookups.getUrgencies();
            break;
          case 'priority':
            values = await client.lookups.getPriorities();
            break;
          case 'mode':
            values = await client.lookups.getModes();
            break;
          case 'level':
            values = await client.lookups.getLevels();
            break;
          case 'request_type':
            values = await client.lookups.getRequestTypes();
            break;
        }
        
        if (values.length > 0) {
          console.log(`\n  Valid ${field} values:`);
          values.slice(0, 5).forEach(v => {
            console.log(`    - ${v.name} (ID: ${v.id})`);
          });
          if (values.length > 5) {
            console.log(`    ... and ${values.length - 5} more`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Could not fetch ${field} values: ${error.message}`);
      }
    }
    
    // Create a recommended request structure
    console.log('\n📝 Recommended Request Structure:');
    console.log('===================================');
    console.log(JSON.stringify({
      subject: "Your request subject",
      description: "Detailed description",
      requester: {
        name: "User Name",
        email_id: "user@example.com"
      },
      priority: { name: "Low" },
      status: { name: "Open" },
      mode: { name: "Web Form" },
      urgency: { name: "Low" },
      level: { name: "Tier 1" },
      request_type: { name: "Service Request" },
      impact: { name: "Low" },
      category: { name: "General" }
    }, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error during field discovery:', error.message);
    if (error.validationErrors || error.details) {
      console.error('Validation details:', JSON.stringify(error.validationErrors || error.details, null, 2));
    }
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the discovery
discoverRequiredFields().catch(console.error);