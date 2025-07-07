#!/usr/bin/env node

/**
 * Test script for rate limiting system V3
 */

import { RateLimitCoordinator } from '../dist/api/rateLimitCoordinator.js';
import { CircuitBreaker } from '../dist/api/circuitBreaker.js';
import { TokenValidator } from '../dist/api/tokenValidator.js';
import { TokenAnalytics } from '../dist/analytics/tokenAnalytics.js';
import { testConnection } from '../dist/db/config.js';
import dotenv from 'dotenv';

dotenv.config();

async function testRateLimiting() {
  console.log('=== Rate Limiting System V3 Test ===\n');

  // Test database connection
  const dbConnected = await testConnection();
  console.log(`Database: ${dbConnected ? '✓ Connected' : '✗ Not available'}\n`);

  // Get coordinator instance
  const coordinator = RateLimitCoordinator.getInstance();
  
  // Test 1: Basic rate limit check
  console.log('Test 1: Basic Rate Limit Check');
  console.log('-------------------------------');
  const canRefresh1 = await coordinator.canRefreshToken();
  console.log(`Can refresh token: ${canRefresh1 ? 'YES' : 'NO'}`);
  
  if (canRefresh1) {
    await coordinator.recordTokenRefresh(true);
    console.log('✓ Token refresh recorded');
  }
  
  // Test immediate retry
  const canRefresh2 = await coordinator.canRefreshToken();
  console.log(`Can refresh immediately after: ${canRefresh2 ? 'YES' : 'NO'}`);
  
  const waitTime = coordinator.getTimeUntilNextRefresh();
  const minutes = Math.floor(waitTime / 60000);
  const seconds = Math.floor((waitTime % 60000) / 1000);
  console.log(`Time until next refresh: ${minutes}m ${seconds}s`);
  
  // Test 2: Circuit Breaker
  console.log('\n\nTest 2: Circuit Breaker Status');
  console.log('-------------------------------');
  const status = await coordinator.getStatus();
  console.log(`Circuit state: ${status.circuitBreaker.state}`);
  console.log(`Total failures: ${status.circuitBreaker.failures}`);
  console.log(`Total successes: ${status.circuitBreaker.successes}`);
  
  // Test 3: Token Window Status  
  console.log('\n\nTest 3: Token Window Status');
  console.log('---------------------------');
  console.log(`Tokens used in window: ${status.tokenRefresh.tokensUsedInWindow}`);
  console.log(`Max tokens per window: ${status.tokenRefresh.maxTokensPerWindow}`);
  console.log(`Window duration: ${status.tokenRefresh.windowDuration / 60000} minutes`);
  
  // Test 4: API Rate Limiting
  console.log('\n\nTest 4: API Rate Limiting');
  console.log('-------------------------');
  console.log(`Current requests: ${status.apiRequests.currentRequests}`);
  console.log(`Requests per minute: ${status.apiRequests.requestsPerMinute}`);
  console.log(`Reset time: ${new Date(status.apiRequests.resetTime).toLocaleTimeString()}`);
  
  // Test 5: Health Score (if analytics enabled)
  if (process.env.SDP_ENABLE_ANALYTICS === 'true') {
    console.log('\n\nTest 5: Token Health Analytics');
    console.log('------------------------------');
    try {
      const analytics = new TokenAnalytics();
      const health = await analytics.calculateTokenHealth();
      console.log(`Health score: ${health.score}/100`);
      console.log(`Health status: ${health.status}`);
      console.log(`Risk level: ${health.riskLevel}`);
      
      if (health.recommendations.length > 0) {
        console.log('\nRecommendations:');
        health.recommendations.forEach(rec => console.log(`- ${rec}`));
      }
    } catch (error) {
      console.log('Analytics not available:', error.message);
    }
  }
  
  // Test 6: Simulate Multiple Refresh Attempts
  console.log('\n\nTest 6: Simulating Rapid Refresh Attempts');
  console.log('-----------------------------------------');
  const attempts = [];
  for (let i = 0; i < 5; i++) {
    const canRefresh = await coordinator.canRefreshToken();
    attempts.push(canRefresh);
    console.log(`Attempt ${i + 1}: ${canRefresh ? 'ALLOWED' : 'BLOCKED'}`);
    
    if (canRefresh) {
      await coordinator.recordTokenRefresh(true);
    }
    
    // Small delay between attempts
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const blockedCount = attempts.filter(a => !a).length;
  console.log(`\nSummary: ${blockedCount}/${attempts.length} attempts blocked`);
  
  // Final status
  console.log('\n\n=== Final System Status ===');
  const finalStatus = await coordinator.getStatus();
  console.log(JSON.stringify(finalStatus, null, 2));
}

// Run the test
testRateLimiting().catch(console.error);