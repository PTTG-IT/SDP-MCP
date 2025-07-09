#!/usr/bin/env node

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function testCategoriesAndSubcategories() {
  try {
    console.log('=== Testing Categories and Subcategories ===');
    
    const client = new SDPAPIClientV2();
    
    // First ensure metadata is loaded
    await client.ensureMetadata();
    
    // Get all categories
    console.log('\n1. Getting all categories...');
    const categories = await client.metadata.getCategories();
    console.log(`Found ${categories.length} categories:`);
    
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`);
    });
    
    // Find Hardware category
    const hardwareCategory = categories.find(c => c.name.toLowerCase() === 'hardware');
    if (!hardwareCategory) {
      console.error('❌ Hardware category not found!');
      return;
    }
    
    console.log(`\n2. Getting subcategories for Hardware (ID: ${hardwareCategory.id})...`);
    
    try {
      const subcategories = await client.metadata.getSubcategories(hardwareCategory.id);
      console.log(`Found ${subcategories.length} subcategories for Hardware:`);
      
      subcategories.forEach(subcat => {
        console.log(`  - ${subcat.name} (ID: ${subcat.id})`);
      });
      
      // Check if "Printer" is valid
      const printerSubcat = subcategories.find(sc => sc.name.toLowerCase() === 'printer');
      if (printerSubcat) {
        console.log(`\n✅ "Printer" is a valid subcategory with ID: ${printerSubcat.id}`);
      } else {
        console.log('\n❌ "Printer" is NOT a valid subcategory for Hardware');
        console.log('Valid subcategory names:', subcategories.map(sc => sc.name).join(', '));
      }
      
    } catch (error) {
      console.error('Failed to get subcategories:', error.message);
      
      // Try direct API call to see raw error
      console.log('\n3. Trying direct API call...');
      try {
        const response = await client.client.get(`/categories/${hardwareCategory.id}/subcategories`, {
          params: {
            input_data: JSON.stringify({
              list_info: {
                row_count: 100,
                start_index: 1
              }
            })
          }
        });
        console.log('Direct API response:', JSON.stringify(response.data, null, 2));
      } catch (apiError) {
        console.error('Direct API error:', apiError.response?.data || apiError.message);
      }
    }
    
    // Test Software category too
    const softwareCategory = categories.find(c => c.name.toLowerCase() === 'software');
    if (softwareCategory) {
      console.log(`\n4. Getting subcategories for Software (ID: ${softwareCategory.id})...`);
      try {
        const subcategories = await client.metadata.getSubcategories(softwareCategory.id);
        console.log(`Found ${subcategories.length} subcategories for Software:`);
        
        subcategories.forEach(subcat => {
          console.log(`  - ${subcat.name} (ID: ${subcat.id})`);
        });
      } catch (error) {
        console.error('Failed to get Software subcategories:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testCategoriesAndSubcategories();