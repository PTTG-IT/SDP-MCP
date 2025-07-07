#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';

config();

async function testLookups() {
  const client = getClient();
  
  try {
    console.log('Looking up available values...\n');
    
    // Get impacts
    console.log('Impacts:');
    const impacts = await client.lookups.getImpacts();
    impacts.forEach(impact => {
      console.log(`  - ${impact.name} (ID: ${impact.id})`);
    });
    
    // Get priorities
    console.log('\nPriorities:');
    const priorities = await client.lookups.getPriorities();
    priorities.forEach(priority => {
      console.log(`  - ${priority.name} (ID: ${priority.id})`);
    });
    
    // Get statuses
    console.log('\nStatuses:');
    const statuses = await client.lookups.getStatuses();
    statuses.forEach(status => {
      console.log(`  - ${status.name} (ID: ${status.id})`);
    });
    
    // Get request types
    console.log('\nRequest Types:');
    const requestTypes = await client.lookups.getRequestTypes();
    requestTypes.forEach(type => {
      console.log(`  - ${type.name} (ID: ${type.id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testLookups().catch(console.error);