#!/usr/bin/env node

import { config } from 'dotenv';
import { getClient } from '../dist/utils/clientFactory.js';

config();

async function getValidImpacts() {
  console.log('🔍 Getting Valid Impact Values\n');
  
  const client = getClient();
  
  try {
    // Get all lookup values we need
    console.log('📋 Fetching lookup values...\n');
    
    // Get impacts
    console.log('1. IMPACTS:');
    try {
      const impacts = await client.lookups.getImpacts();
      if (impacts.length > 0) {
        impacts.forEach(impact => {
          console.log(`   - "${impact.name}" (ID: ${impact.id})`);
        });
      } else {
        console.log('   ❌ No impacts found');
      }
    } catch (e) {
      console.log('   ❌ Error fetching impacts:', e.message);
    }
    
    // Get modes
    console.log('\n2. MODES:');
    try {
      const modes = await client.lookups.getModes();
      if (modes.length > 0) {
        modes.forEach(mode => {
          console.log(`   - "${mode.name}" (ID: ${mode.id})`);
        });
      } else {
        console.log('   ❌ No modes found');
      }
    } catch (e) {
      console.log('   ❌ Error fetching modes:', e.message);
    }
    
    // Get request types
    console.log('\n3. REQUEST TYPES:');
    try {
      const requestTypes = await client.lookups.getRequestTypes();
      if (requestTypes.length > 0) {
        requestTypes.forEach(rt => {
          console.log(`   - "${rt.name}" (ID: ${rt.id})`);
        });
      } else {
        console.log('   ❌ No request types found');
      }
    } catch (e) {
      console.log('   ❌ Error fetching request types:', e.message);
    }
    
    // Get urgencies
    console.log('\n4. URGENCIES:');
    try {
      const urgencies = await client.lookups.getUrgencies();
      if (urgencies.length > 0) {
        urgencies.forEach(urgency => {
          console.log(`   - "${urgency.name}" (ID: ${urgency.id})`);
        });
      } else {
        console.log('   ❌ No urgencies found');
      }
    } catch (e) {
      console.log('   ❌ Error fetching urgencies:', e.message);
    }
    
    // Get levels
    console.log('\n5. LEVELS:');
    try {
      const levels = await client.lookups.getLevels();
      if (levels.length > 0) {
        levels.forEach(level => {
          console.log(`   - "${level.name}" (ID: ${level.id})`);
        });
      } else {
        console.log('   ❌ No levels found');
      }
    } catch (e) {
      console.log('   ❌ Error fetching levels:', e.message);
    }
    
    // Get categories
    console.log('\n6. CATEGORIES:');
    try {
      const categories = await client.lookups.getCategories();
      if (categories.length > 0) {
        categories.slice(0, 10).forEach(cat => {
          console.log(`   - "${cat.name}" (ID: ${cat.id})`);
        });
        if (categories.length > 10) {
          console.log(`   ... and ${categories.length - 10} more`);
        }
      } else {
        console.log('   ❌ No categories found');
      }
    } catch (e) {
      console.log('   ❌ Error fetching categories:', e.message);
    }
    
    // Get statuses
    console.log('\n7. STATUSES:');
    try {
      const statuses = await client.lookups.getStatuses();
      if (statuses.length > 0) {
        statuses.forEach(status => {
          console.log(`   - "${status.name}" (ID: ${status.id})`);
        });
      } else {
        console.log('   ❌ No statuses found');
      }
    } catch (e) {
      console.log('   ❌ Error fetching statuses:', e.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getValidImpacts().catch(console.error);