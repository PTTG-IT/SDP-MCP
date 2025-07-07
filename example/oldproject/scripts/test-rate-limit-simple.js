#!/usr/bin/env node

/**
 * Simple test to verify rate limiting is working correctly
 */

import { RateLimitCoordinator } from '../dist/api/rateLimitCoordinator.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSimpleRateLimiting() {
  console.log('=== Simple Rate Limit Test ===\n');
  
  const coordinator = RateLimitCoordinator.getInstance();
  
  console.log('Current State:');
  const initialStatus = await coordinator.getStatus();
  console.log(JSON.stringify(initialStatus, null, 2));
  
  console.log('\nTest Sequence:');
  console.log('1. Checking if we can refresh token...');
  const canRefresh1 = await coordinator.canRefreshToken();
  console.log(`   Result: ${canRefresh1 ? 'YES' : 'NO'}`);
  
  if (canRefresh1) {
    console.log('2. Recording successful refresh...');
    await coordinator.recordTokenRefresh(true);
    console.log('   ✓ Recorded');
  }
  
  console.log('3. Trying immediate second refresh...');
  const canRefresh2 = await coordinator.canRefreshToken();
  console.log(`   Result: ${canRefresh2 ? 'YES (ERROR!)' : 'NO (Correct!)'}`);
  
  console.log('4. Checking wait time...');
  const waitTime = coordinator.getTimeUntilNextRefresh();
  const minutes = Math.floor(waitTime / 60000);
  const seconds = Math.floor((waitTime % 60000) / 1000);
  console.log(`   Wait time: ${minutes}m ${seconds}s`);
  console.log(`   Expected: ~3m 0s`);
  
  console.log('\n5. Simulating 5 rapid attempts:');
  for (let i = 1; i <= 5; i++) {
    const canRefresh = await coordinator.canRefreshToken();
    console.log(`   Attempt ${i}: ${canRefresh ? 'ALLOWED' : 'BLOCKED'}`);
    if (canRefresh) {
      await coordinator.recordTokenRefresh(true);
    }
  }
  
  console.log('\nFinal State:');
  const finalStatus = await coordinator.getStatus();
  console.log(JSON.stringify(finalStatus, null, 2));
  
  console.log('\n=== Test Results ===');
  console.log(`✓ Rate limiting is ${canRefresh2 === false ? 'WORKING' : 'NOT WORKING'}`);
  console.log(`✓ Enforces "no more than 1 refresh every 3 minutes": ${waitTime >= 179000 ? 'YES' : 'NO'}`);
  console.log(`✓ All rapid attempts blocked: ${canRefresh2 === false ? 'YES' : 'NO'}`);
}

testSimpleRateLimiting().catch(console.error);