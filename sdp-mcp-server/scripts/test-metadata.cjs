#!/usr/bin/env node

/**
 * Test metadata retrieval
 */

const { SDPMetadataClient } = require('../src/sdp-api-metadata.cjs');

async function testMetadata() {
  try {
    console.log('Fetching SDP metadata...\n');
    
    const metadataClient = new SDPMetadataClient();
    const metadata = await metadataClient.getAllMetadata();
    
    console.log('Priorities:', metadata.priorities);
    console.log('\nStatuses:', metadata.statuses);
    console.log('\nCategories (first 10):', metadata.categories.slice(0, 10));
    console.log('\nTemplates (first 5):', metadata.templates.slice(0, 5));
    
    // Try to get impacts
    console.log('\nTrying to fetch impacts...');
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0
          }
        })
      };
      
      const response = await metadataClient.client.get('/impacts', { params });
      console.log('Impacts:', response.data.impacts || []);
    } catch (error) {
      console.log('Could not fetch impacts:', error.message);
    }
    
    // Try to get request types
    console.log('\nTrying to fetch request types...');
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0
          }
        })
      };
      
      const response = await metadataClient.client.get('/request_types', { params });
      console.log('Request types:', response.data.request_types || []);
    } catch (error) {
      console.log('Could not fetch request types:', error.message);
    }
    
    // Try to get modes
    console.log('\nTrying to fetch modes...');
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0
          }
        })
      };
      
      const response = await metadataClient.client.get('/modes', { params });
      console.log('Modes:', response.data.modes || []);
    } catch (error) {
      console.log('Could not fetch modes:', error.message);
    }
    
    // Try to get urgency levels
    console.log('\nTrying to fetch urgency levels...');
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0
          }
        })
      };
      
      const response = await metadataClient.client.get('/urgencies', { params });
      console.log('Urgencies:', response.data.urgencies || []);
    } catch (error) {
      console.log('Could not fetch urgencies:', error.message);
    }
    
    // Try to get levels
    console.log('\nTrying to fetch levels...');
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0
          }
        })
      };
      
      const response = await metadataClient.client.get('/levels', { params });
      console.log('Levels:', response.data.levels || []);
    } catch (error) {
      console.log('Could not fetch levels:', error.message);
    }
    
    // Try to get subcategories for Software
    console.log('\nTrying to fetch subcategories...');
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0,
            search_fields: {
              category: { id: '216826000000006689' }  // Software category
            }
          }
        })
      };
      
      const response = await metadataClient.client.get('/subcategories', { params });
      console.log('Subcategories:', response.data.subcategories || []);
    } catch (error) {
      console.log('Could not fetch subcategories:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testMetadata();