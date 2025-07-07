#!/usr/bin/env node

/**
 * Test the optimized SDP client with time tracking and automatic queuing
 */

import 'dotenv/config';
import { OptimizedSDPClient } from '../../dist/api/optimizedClient.js';
import { loadConfig } from '../../dist/utils/config.js';

async function demonstrateOptimizedClient() {
  console.log('🚀 Testing Optimized SDP Client with Time Tracking\n');
  
  const config = loadConfig();
  const client = new OptimizedSDPClient(config, true); // Enable monitoring
  
  console.log(`Configuration: ${config.rateLimitPerMinute} requests/minute\n`);
  
  try {
    // Test 1: Burst of requests (will be automatically queued)
    console.log('📋 Test 1: Burst Request Handling\n');
    console.log('Submitting 10 requests at once...\n');
    
    const burstPromises = [];
    for (let i = 0; i < 10; i++) {
      // These will all be queued and processed at optimal rate
      burstPromises.push(
        client.projects.list({ per_page: 1 })
          .then(() => ({ success: true, index: i }))
          .catch(error => ({ success: false, index: i, error: error.message }))
      );
    }
    
    // Wait for results
    const burstResults = await Promise.all(burstPromises);
    
    console.log('\nBurst Results:');
    const successes = burstResults.filter(r => r.success).length;
    console.log(`✅ Successful: ${successes}/10`);
    console.log(`❌ Failed: ${10 - successes}/10`);
    
    // Show stats
    client.logStatus();
    
    // Test 2: Mixed priority operations
    console.log('\n📋 Test 2: Priority-based Processing\n');
    
    const priorityOps = [
      { name: 'Critical Update', priority: 9, delay: 0 },
      { name: 'Normal Read', priority: 5, delay: 100 },
      { name: 'Low Priority List', priority: 2, delay: 50 },
      { name: 'Important Create', priority: 8, delay: 150 }
    ];
    
    console.log('Submitting operations with different priorities...\n');
    
    const priorityResults = await client.executeBatch(
      priorityOps.map(op => ({
        name: op.name,
        priority: op.priority,
        execute: async () => {
          await new Promise(r => setTimeout(r, op.delay));
          return client.projects.list({ per_page: 1 });
        }
      }))
    );
    
    console.log('\nPriority Results (should process high priority first):');
    priorityResults.forEach(result => {
      const status = result.error ? '❌' : '✅';
      console.log(`${status} ${result.name}`);
    });
    
    // Test 3: Throughput optimization
    console.log('\n📋 Test 3: Throughput Optimization\n');
    
    // Get initial stats
    const statsBefore = client.getDetailedStats();
    console.log(`Initial throughput: ${statsBefore.performance.throughput.toFixed(1)} req/min`);
    
    // Optimize
    client.optimize();
    console.log('Optimizing for throughput...\n');
    
    // Make more requests to test optimization
    const optimizedPromises = [];
    for (let i = 0; i < 5; i++) {
      optimizedPromises.push(
        client.projects.list({ per_page: 1 })
      );
      await new Promise(r => setTimeout(r, 2000)); // Space them out
    }
    
    await Promise.allSettled(optimizedPromises);
    
    // Final stats
    const statsAfter = client.getDetailedStats();
    console.log(`\nOptimized throughput: ${statsAfter.performance.throughput.toFixed(1)} req/min`);
    console.log(`Adaptive rate: ${(statsAfter.limits.adaptiveRate * 100).toFixed(0)}%`);
    
    // Test 4: High-priority operation
    console.log('\n📋 Test 4: High Priority Operation\n');
    
    console.log('Executing high-priority request...');
    const highPriorityResult = await client.executeHighPriority(
      'urgent-project-check',
      () => client.projects.list({ per_page: 1 })
    );
    
    console.log('✅ High-priority request completed\n');
    
    // Final summary
    console.log('📊 Final Summary:');
    client.logStatus();
    
    // Wait for queue to empty
    console.log('Waiting for queue to empty...');
    const emptied = await client.waitForQueueEmpty(30000);
    console.log(emptied ? '✅ Queue empty' : '⚠️  Queue timeout');
    
    // Detailed stats
    const finalStats = client.getDetailedStats();
    console.log('\n📈 Detailed Statistics:');
    console.log(`├─ Total requests in last minute: ${finalStats.windows.short.count}`);
    console.log(`├─ Success rate: ${(finalStats.performance.successRate * 100).toFixed(1)}%`);
    console.log(`├─ Average duration: ${finalStats.performance.avgDuration.toFixed(0)}ms`);
    console.log(`├─ Effective limit: ${finalStats.limits.effective} (base: ${finalStats.limits.base})`);
    console.log(`└─ Queue processed: ✅`);
    
    // Endpoint breakdown
    console.log('\n📍 Requests by Endpoint:');
    finalStats.windows.short.endpoints.forEach((count, endpoint) => {
      console.log(`   ${endpoint}: ${count}`);
    });
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the demonstration
console.log('Starting optimized client test...\n');
demonstrateOptimizedClient().catch(console.error);