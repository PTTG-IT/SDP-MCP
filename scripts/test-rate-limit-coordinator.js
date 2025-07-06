#!/usr/bin/env node

import { RateLimitCoordinator } from '../dist/api/rateLimitCoordinator.js';
import { CircuitBreaker } from '../dist/api/circuitBreaker.js';
import { RateLimitMonitor } from '../dist/monitoring/rateLimitMonitor.js';

console.log('Testing Rate Limit Coordinator System');
console.log('=====================================\n');

// Initialize components
const coordinator = RateLimitCoordinator.getInstance();
const monitor = new RateLimitMonitor();

// Start monitoring
monitor.start(5000); // Check every 5 seconds for testing

// Listen for alerts
monitor.on('alert', (alert) => {
  console.log(`\n⚠️  ALERT [${alert.level.toUpperCase()}]: ${alert.message}`);
});

// Test 1: Check initial state
console.log('Test 1: Initial State');
console.log('--------------------');
const canRefresh = await coordinator.canRefreshToken();
console.log(`Can refresh token: ${canRefresh}`);
console.log(`Time until next refresh: ${coordinator.getTimeUntilNextRefresh()}ms`);

// Test 2: Simulate successful token refresh
console.log('\n\nTest 2: Successful Token Refresh');
console.log('--------------------------------');
if (canRefresh) {
  await coordinator.recordTokenRefresh(true);
  console.log('Token refresh recorded as successful');
  
  // Check if we can refresh again immediately
  const canRefreshAgain = await coordinator.canRefreshToken();
  console.log(`Can refresh again immediately: ${canRefreshAgain}`);
  console.log(`Time until next refresh: ${coordinator.getTimeUntilNextRefresh()}ms (should be ~3 minutes)`);
}

// Test 3: Circuit breaker behavior
console.log('\n\nTest 3: Circuit Breaker Test');
console.log('----------------------------');
const breaker = new CircuitBreaker('test-breaker', {
  failureThreshold: 3,
  resetTimeout: 5000,
  successThreshold: 2
});

// Simulate failures
for (let i = 0; i < 4; i++) {
  try {
    await breaker.execute(async () => {
      throw new Error('Simulated failure');
    });
  } catch (e) {
    console.log(`Attempt ${i + 1}: ${e.message}`);
  }
}

console.log(`Circuit breaker state: ${breaker.getState().state}`);

// Test 4: Monitor status
console.log('\n\nTest 4: Monitor Status');
console.log('---------------------');
await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for metrics collection

const summary = monitor.formatSummary();
console.log(summary);

// Test 5: Rate limit status
console.log('\n\nTest 5: Detailed Rate Limit Status');
console.log('----------------------------------');
const status = coordinator.getStatus();
console.log('Token Refresh Status:', {
  lastRefresh: status.tokenRefresh.lastRefreshTime,
  nextAllowed: status.tokenRefresh.nextAllowedRefresh,
  refreshesInWindow: status.tokenRefresh.refreshesInWindow
});
console.log('API Request Status:', status.apiRequests);
console.log('Circuit Breaker Status:', status.circuitBreaker);

// Test 6: Simulate API requests
console.log('\n\nTest 6: API Request Tracking');
console.log('----------------------------');
for (let i = 0; i < 10; i++) {
  if (coordinator.canMakeApiRequest()) {
    coordinator.recordApiRequest();
    console.log(`API request ${i + 1} recorded`);
  } else {
    console.log(`API request ${i + 1} blocked by rate limit`);
  }
}

// Test 7: Wait and test recovery
console.log('\n\nTest 7: Testing Recovery After Wait');
console.log('-----------------------------------');
console.log('Waiting 10 seconds for circuit breaker reset...');
await new Promise(resolve => setTimeout(resolve, 10000));

// Try circuit breaker again
try {
  await breaker.execute(async () => {
    console.log('Circuit breaker recovered, operation successful');
    return 'success';
  });
} catch (e) {
  console.log('Circuit breaker still blocking:', e.message);
}

// Final summary
console.log('\n\nFinal Summary');
console.log('=============');
console.log(monitor.formatSummary());

// Cleanup
monitor.stop();
console.log('\n\nTest completed.');
process.exit(0);