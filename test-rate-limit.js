#!/usr/bin/env node

/**
 * Test rate limiting and find optimal settings
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRateLimit() {
  console.log('🧪 Testing Rate Limit Settings\n');
  
  const config = loadConfig();
  console.log(`Current rate limit: ${config.rateLimitPerMinute || 60} requests/minute\n`);
  
  const client = new SDPClient(config);
  
  let successCount = 0;
  let errorCount = 0;
  let rateLimitErrors = 0;
  const startTime = Date.now();
  
  console.log('Making 5 requests with delays...\n');
  
  for (let i = 1; i <= 5; i++) {
    console.log(`Request ${i}: Getting project list...`);
    
    try {
      const projects = await client.projects.list({ per_page: 1 });
      successCount++;
      console.log(`✅ Success! Found ${projects.meta?.total_count || 0} projects`);
      
      // Show rate limit stats
      const stats = client.rateLimiter.getStats();
      console.log(`   Rate limit: ${stats.current}/${stats.max} (resets in ${stats.resetIn}s)`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error: ${error.message}`);
      
      if (error.message.includes('too many requests') || 
          error.message.includes('rate limit')) {
        rateLimitErrors++;
        console.log('   This is a rate limit error!');
        
        // Wait longer before next request
        console.log('   Waiting 60 seconds...');
        await wait(60000);
      }
    }
    
    // Wait between requests
    if (i < 5) {
      const delay = 5000; // 5 seconds
      console.log(`   Waiting ${delay/1000} seconds before next request...\n`);
      await wait(delay);
    }
  }
  
  const duration = (Date.now() - startTime) / 1000;
  
  console.log('\n📊 Test Results:');
  console.log(`├─ Duration: ${duration.toFixed(1)} seconds`);
  console.log(`├─ Successful requests: ${successCount}`);
  console.log(`├─ Failed requests: ${errorCount}`);
  console.log(`├─ Rate limit errors: ${rateLimitErrors}`);
  console.log(`└─ Effective rate: ${(successCount / (duration / 60)).toFixed(1)} requests/minute`);
  
  if (rateLimitErrors > 0) {
    console.log('\n⚠️  Recommendations:');
    console.log('1. Reduce SDP_RATE_LIMIT_PER_MINUTE to 30 or lower');
    console.log('2. Add longer delays between requests');
    console.log('3. Consider implementing request batching');
  }
}

// Run test
testRateLimit().catch(console.error);