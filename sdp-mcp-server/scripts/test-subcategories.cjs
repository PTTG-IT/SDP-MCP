#!/usr/bin/env node

/**
 * Test script to see what subcategories are available for different categories
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testSubcategories() {
  try {
    console.log('🔍 Testing subcategories...');
    
    const client = new SDPAPIClientV2();
    
    // Get all metadata
    const metadata = await client.getMetadata();
    
    console.log('\n📋 Available Categories:');
    metadata.categories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`);
    });
    
    // Get subcategories for Software category (ID: 216826000000006689)
    console.log('\n🔍 Subcategories for Software category:');
    const softwareSubcategories = await client.metadata.getSubcategories('216826000000006689');
    softwareSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    
    console.log('\n✅ Subcategory test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  process.exit(0);
}

testSubcategories();