#!/usr/bin/env node

/**
 * Test script to verify fixes for API issues
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');
const { SDPMetadataClient } = require('../src/sdp-api-metadata.cjs');

async function testSearchFix() {
  console.log('\n=== Testing Search Fix ===\n');
  
  const client = new SDPAPIClientV2();
  
  try {
    console.log('Testing searchRequests with "test" query...');
    const result = await client.searchRequests('test', { limit: 5 });
    console.log('✅ SUCCESS: Search works!');
    console.log(`Found ${result.total_count} results`);
    if (result.requests.length > 0) {
      console.log('Sample results:');
      result.requests.slice(0, 3).forEach(req => {
        console.log(`  - ${req.id}: ${req.subject}`);
      });
    }
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    if (error.response?.data) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function testSubcategoriesFix() {
  console.log('\n=== Testing Subcategories Fix ===\n');
  
  const metadata = new SDPMetadataClient();
  
  try {
    // Get categories first
    const categories = await metadata.getCategories();
    const hardwareCategory = categories.find(c => c.name === 'Hardware');
    
    if (!hardwareCategory) {
      console.log('❌ Hardware category not found');
      return;
    }
    
    console.log(`Getting subcategories for Hardware (ID: ${hardwareCategory.id})...`);
    const subcategories = await metadata.getSubcategories(hardwareCategory.id);
    
    console.log('✅ SUCCESS: Found', subcategories.length, 'subcategories');
    console.log('Available subcategories:');
    subcategories.forEach(sc => {
      console.log(`  - ${sc.name} (ID: ${sc.id})${sc.deleted ? ' [DELETED]' : ''}`);
    });
    
    // Test subcategory ID lookup
    console.log('\nTesting subcategory ID lookup...');
    const computerId = await metadata.getSubcategoryId(hardwareCategory.id, 'Computer');
    console.log(`'Computer' subcategory ID: ${computerId}`);
    
  } catch (error) {
    console.log('❌ FAILED:', error.message);
  }
}

async function testTechniciansFix() {
  console.log('\n=== Testing Technicians Fix ===\n');
  
  const client = new SDPAPIClientV2();
  
  try {
    console.log('Listing technicians using /users endpoint...');
    const result = await client.users.listTechnicians({ limit: 10 });
    
    console.log('✅ SUCCESS: Found', result.technicians.length, 'technicians');
    if (result.technicians.length > 0) {
      console.log('Sample technicians:');
      result.technicians.slice(0, 3).forEach(tech => {
        console.log(`  - ${tech.name} (${tech.email || 'no email'})${tech.department ? ` - ${tech.department.name}` : ''}`);
      });
    }
    
    // Test getting specific technician
    if (result.technicians.length > 0) {
      console.log('\nTesting get specific technician...');
      const techId = result.technicians[0].id;
      const tech = await client.users.getTechnician(techId);
      console.log('✅ SUCCESS: Got technician details');
      console.log(`  Name: ${tech.name}`);
      console.log(`  Email: ${tech.email_id || 'N/A'}`);
      console.log(`  Department: ${tech.department?.name || 'N/A'}`);
    }
    
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    if (error.response?.status === 401) {
      console.log('  Note: 401 suggests missing OAuth scope for users');
      console.log('  Required scope: SDPOnDemand.users.READ');
    }
  }
}

async function testRequestCreationWithSubcategory() {
  console.log('\n=== Testing Request Creation with Subcategory ===\n');
  
  const client = new SDPAPIClientV2();
  const metadata = new SDPMetadataClient();
  
  try {
    // Get Hardware category and Computer subcategory
    const categories = await metadata.getCategories();
    const hardwareCategory = categories.find(c => c.name === 'Hardware');
    
    if (!hardwareCategory) {
      console.log('❌ Hardware category not found');
      return;
    }
    
    const subcategories = await metadata.getSubcategories(hardwareCategory.id);
    const computerSubcategory = subcategories.find(sc => sc.name === 'Computer' && !sc.deleted);
    
    if (!computerSubcategory) {
      console.log('❌ Computer subcategory not found');
      return;
    }
    
    console.log('Creating test request with Hardware/Computer...');
    const testRequest = {
      subject: 'Test Request with Subcategory',
      description: 'Testing subcategory requirement',
      requester: { email_id: 'test@example.com' },
      category: { id: hardwareCategory.id },
      subcategory: { id: computerSubcategory.id }
    };
    
    const result = await client.createRequest(testRequest);
    console.log('✅ SUCCESS: Request created with subcategory');
    console.log(`  Request ID: ${result.id}`);
    console.log(`  Category: ${result.category?.name}`);
    console.log(`  Subcategory: ${result.subcategory?.name}`);
    
    // Clean up - close the request
    await client.closeRequest(result.id, {
      closure_code: { name: 'Resolved' },
      closure_comments: 'Test completed'
    });
    console.log('✅ Request closed successfully');
    
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    if (error.response?.data?.response_status?.messages) {
      console.log('Error details:');
      error.response.data.response_status.messages.forEach(msg => {
        console.log(`  - ${msg.field || 'General'}: ${msg.message}`);
      });
    }
  }
}

async function main() {
  console.log('Testing API Fixes');
  console.log('=================');
  
  try {
    await testSearchFix();
    await testSubcategoriesFix();
    await testTechniciansFix();
    await testRequestCreationWithSubcategory();
    
    console.log('\n\n=== Summary ===\n');
    console.log('1. Search: Use object format for search_criteria (not array)');
    console.log('2. Subcategories: Use /categories/{id}/subcategories endpoint');
    console.log('3. Technicians: Use /users endpoint (no dedicated /technicians endpoint)');
    console.log('4. When category is set, subcategory is mandatory');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main().catch(console.error);