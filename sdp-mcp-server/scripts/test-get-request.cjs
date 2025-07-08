#!/usr/bin/env node

/**
 * Get an existing request to see its structure
 */

const { SDPAPIClientV2 } = require('../src/sdp-api-client-v2.cjs');

async function getRequest() {
  try {
    console.log('Fetching recent requests to see their structure...\n');
    
    const client = new SDPAPIClientV2();
    
    // List recent requests
    const result = await client.listRequests({ limit: 1 });
    
    if (result.requests.length === 0) {
      console.log('No requests found');
      return;
    }
    
    const requestId = result.requests[0].id;
    console.log('Found request:', requestId);
    
    // Get full details
    const request = await client.getRequest(requestId);
    console.log('\nFull request structure:');
    console.log(JSON.stringify(request, null, 2));
    
  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }
}

getRequest();