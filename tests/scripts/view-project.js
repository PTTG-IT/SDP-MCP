#!/usr/bin/env node

/**
 * View project details and rate limit optimization
 */

import 'dotenv/config';
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';
import fs from 'fs/promises';

async function testRateLimit(client) {
  console.log('\n🧪 Testing Rate Limit Optimization...\n');
  
  const operations = [
    { name: 'List projects', fn: () => client.projects.list({ per_page: 5 }) },
    { name: 'Get project', fn: () => client.projects.get('216826000006339009') },
    { name: 'List users', fn: () => client.users.list({ per_page: 5 }) },
  ];
  
  let successCount = 0;
  const startTime = Date.now();
  
  for (let round = 0; round < 3; round++) {
    console.log(`Round ${round + 1}:`);
    
    for (const op of operations) {
      const stats = client.rateLimiter.getStats();
      console.log(`  ${op.name} (${stats.current}/${stats.max})... `, { end: '' });
      
      try {
        await op.fn();
        successCount++;
        console.log('✅');
      } catch (error) {
        console.log(`❌ ${error.message}`);
        if (error.message.includes('rate')) {
          console.log('  ⚠️  Rate limited! Current config may be too high.');
          return { success: false, message: 'Rate limited' };
        }
      }
      
      // Small delay between operations
      await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log('');
  }
  
  const duration = (Date.now() - startTime) / 1000;
  const effectiveRate = (successCount / duration) * 60;
  
  return {
    success: true,
    successCount,
    duration,
    effectiveRate
  };
}

async function main() {
  console.log('📋 Service Desk Plus MCP - Project Viewer\n');
  
  try {
    const config = loadConfig();
    const client = new SDPClient(config);
    
    // Read project ID
    const projectId = (await fs.readFile('PROJECT_ID.txt', 'utf-8')).trim();
    console.log(`Project ID: ${projectId}`);
    console.log(`Rate Limit: ${config.rateLimitPerMinute} req/min\n`);
    
    // Get project details
    console.log('📊 Project Details:');
    const stats = client.rateLimiter.getStats();
    console.log(`Rate: ${stats.current}/${stats.max}`);
    
    try {
      const project = await client.projects.get(projectId);
      console.log(`✅ Title: ${project.title}`);
      console.log(`   Status: ${project.status?.name || 'Unknown'}`);
      console.log(`   Completion: ${project.percentage_completion || 0}%`);
      console.log(`   Created: ${project.created_time?.display_value || 'Unknown'}`);
      console.log(`   Owner: ${project.owner?.name || 'Unassigned'}`);
    } catch (error) {
      console.log(`❌ Failed to get project: ${error.message}`);
    }
    
    // Test rate limiting
    const testResult = await testRateLimit(client);
    
    console.log('\n📈 Rate Limit Analysis:');
    if (testResult.success) {
      console.log(`✅ No rate limit errors!`);
      console.log(`   Operations: ${testResult.successCount}`);
      console.log(`   Duration: ${testResult.duration.toFixed(1)}s`);
      console.log(`   Effective rate: ${testResult.effectiveRate.toFixed(1)} req/min`);
      
      // Suggest optimization
      const currentLimit = config.rateLimitPerMinute;
      if (testResult.effectiveRate < currentLimit * 0.8) {
        console.log(`\n💡 Optimization: Your rate limit (${currentLimit}) may be too conservative.`);
        console.log(`   Consider increasing to ${Math.floor(testResult.effectiveRate * 1.2)}`);
      } else {
        console.log(`\n✅ Current rate limit (${currentLimit}) is well configured.`);
      }
    } else {
      console.log(`❌ Rate limit hit during testing`);
      console.log(`   Reduce SDP_RATE_LIMIT_PER_MINUTE below ${config.rateLimitPerMinute}`);
    }
    
    // Final stats
    const finalStats = client.rateLimiter.getStats();
    console.log(`\n📊 Final rate usage: ${finalStats.current}/${finalStats.max}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();