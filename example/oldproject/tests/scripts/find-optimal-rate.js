#!/usr/bin/env node

/**
 * Find optimal rate limit for Service Desk Plus API
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRateLimit(limit) {
  // Update config with test limit
  process.env.SDP_RATE_LIMIT_PER_MINUTE = limit.toString();
  
  const config = loadConfig();
  const client = new SDPClient(config);
  
  console.log(`\nTesting rate limit: ${limit} req/min`);
  
  let successCount = 0;
  let errorCount = 0;
  let rateLimitErrors = 0;
  
  // Try to make 10 requests with calculated delays
  const delayBetweenRequests = Math.floor(60000 / limit); // ms between requests
  
  for (let i = 0; i < 10; i++) {
    try {
      await client.projects.list({ per_page: 1 });
      successCount++;
      process.stdout.write('✓');
    } catch (error) {
      errorCount++;
      if (error.message.includes('too many requests')) {
        rateLimitErrors++;
        process.stdout.write('×');
      } else {
        process.stdout.write('!');
      }
    }
    
    if (i < 9) {
      await wait(delayBetweenRequests);
    }
  }
  
  console.log(`\nResults: ${successCount} success, ${errorCount} errors (${rateLimitErrors} rate limit)`);
  
  return {
    limit,
    successCount,
    errorCount,
    rateLimitErrors,
    successRate: successCount / 10
  };
}

async function findOptimalRate() {
  console.log('🔍 Finding Optimal Rate Limit for Service Desk Plus\n');
  console.log('This will test different rate limits to find the sweet spot.');
  console.log('Legend: ✓ = success, × = rate limit, ! = other error\n');
  
  // Start conservatively and work up
  const testLimits = [5, 10, 15, 20, 30, 40];
  const results = [];
  
  for (const limit of testLimits) {
    const result = await testRateLimit(limit);
    results.push(result);
    
    // If we hit rate limits, no need to test higher
    if (result.rateLimitErrors > 2) {
      console.log('\n⚠️  Significant rate limiting detected, stopping tests.');
      break;
    }
    
    // Wait between tests
    console.log('Waiting 30 seconds before next test...');
    await wait(30000);
  }
  
  // Find optimal rate
  const successfulResults = results.filter(r => r.rateLimitErrors === 0);
  const optimal = successfulResults.length > 0 
    ? successfulResults[successfulResults.length - 1]
    : results[0];
  
  console.log('\n📊 Test Summary:');
  console.log('Rate | Success | Errors | Rate Limits');
  console.log('-----|---------|--------|------------');
  results.forEach(r => {
    const marker = r === optimal ? ' ⭐' : '';
    console.log(`${r.limit.toString().padEnd(4)} | ${r.successCount.toString().padEnd(7)} | ${r.errorCount.toString().padEnd(6)} | ${r.rateLimitErrors}${marker}`);
  });
  
  console.log(`\n✅ Recommended rate limit: ${optimal.limit} requests/minute`);
  console.log('\nTo apply this setting, update your .env file:');
  console.log(`SDP_RATE_LIMIT_PER_MINUTE=${optimal.limit}`);
  
  // Additional recommendations
  if (optimal.limit < 20) {
    console.log('\n💡 Additional recommendations:');
    console.log('- Implement request batching where possible');
    console.log('- Use caching for frequently accessed data');
    console.log('- Consider request prioritization for critical operations');
  }
}

// Run the test
console.log('⏳ Starting in 5 seconds...\n');
setTimeout(() => {
  findOptimalRate().catch(console.error);
}, 5000);