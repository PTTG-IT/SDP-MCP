# Time-Tracked Rate Limiting

## Overview

The Time-Tracked Rate Limiter is an advanced system that maximizes API throughput while preventing rate limit violations. It tracks request history, predicts future usage, and automatically queues requests for optimal performance.

## Key Features

### 1. Request History Tracking
- Records timestamp, endpoint, duration, and success status
- Maintains sliding windows (10s, 1min, 5min, 15min)
- Analyzes patterns for optimization

### 2. Predictive Throttling
- Projects future request counts
- Prevents rate limits before they occur
- Adjusts timing based on current usage

### 3. Automatic Queuing
- Priority-based queue (0-10 scale)
- FIFO within same priority
- Automatic retry on rate limit

### 4. Adaptive Rate Adjustment
- Learns from API responses
- Reduces capacity after 429 errors
- Increases capacity during stable periods

## Usage

### Basic Usage with OptimizedSDPClient

```javascript
import { OptimizedSDPClient } from 'service-desk-plus-cloud-api/optimized';
import { loadConfig } from 'service-desk-plus-cloud-api';

const config = loadConfig();
const client = new OptimizedSDPClient(config, true); // Enable monitoring

// All API calls are automatically queued and rate-limited
const projects = await client.projects.list();
const project = await client.projects.get('12345');

// High-priority operations
await client.executeHighPriority(
  'urgent-update',
  () => client.requests.update(requestId, data)
);
```

### Direct Usage of TimeTrackedRateLimiter

```javascript
import { TimeTrackedRateLimiter } from 'service-desk-plus-cloud-api';

const rateLimiter = new TimeTrackedRateLimiter(
  60,    // Base limit: 60 requests per minute
  60000  // Window: 1 minute (60000ms)
);

// Execute with automatic queuing
const result = await rateLimiter.execute(
  'requests.list',  // Endpoint name for tracking
  async () => {     // Your API operation
    return await fetchAPI('/requests');
  },
  {
    priority: 7,    // Priority 0-10 (higher = sooner)
    userId: 'user1' // Optional user tracking
  }
);
```

## Configuration

### Priority Levels

- **9-10**: Critical operations (immediate processing)
- **7-8**: Important operations (minimal delay)
- **5-6**: Normal operations (standard queue)
- **3-4**: Background tasks (can wait)
- **1-2**: Bulk operations (lowest priority)

### Time Windows

The system tracks requests across multiple windows:

```javascript
windows = {
  instant: 10000,    // 10 seconds - burst protection
  short: 60000,      // 1 minute - primary rate limit
  medium: 300000,    // 5 minutes - pattern analysis
  long: 900000       // 15 minutes - history retention
}
```

### Safety Margins

```javascript
safetyMargin = 0.85;  // Use only 85% of limit
burstMargin = 0.95;   // Allow bursts up to 95%
```

## Monitoring

### Event Listeners

```javascript
rateLimiter.on('queued', (data) => {
  console.log(`Queued: ${data.endpoint} (Priority: ${data.priority})`);
});

rateLimiter.on('processed', (data) => {
  console.log(`Processed: ${data.endpoint} in ${data.duration}ms`);
});

rateLimiter.on('throttle', (data) => {
  console.log(`Throttled: ${data.reason}, waiting ${data.waitMs}ms`);
});

rateLimiter.on('rateLimitHit', (data) => {
  console.log(`Rate limit hit! Reducing to ${data.newRate * 100}%`);
});
```

### Statistics

```javascript
const stats = rateLimiter.getStats();

console.log('Queue:', stats.queue.length);
console.log('Usage:', stats.limits.currentUsage + '/' + stats.limits.effective);
console.log('Success Rate:', stats.performance.successRate * 100 + '%');
console.log('Throughput:', stats.performance.throughput + ' req/min');
```

## Optimization Strategies

### 1. Maximize Throughput

```javascript
// Let the system optimize based on success patterns
client.optimize();

// Or manually adjust after stable period
if (stats.performance.successRate > 0.95) {
  rateLimiter.optimizeForThroughput();
}
```

### 2. Batch Operations

```javascript
const operations = items.map(item => ({
  name: `Process ${item.id}`,
  priority: 5,
  execute: () => client.requests.update(item.id, item.data)
}));

const results = await client.executeBatch(operations);
```

### 3. Wait for Completion

```javascript
// Process many operations
for (const task of tasks) {
  client.projects.createTask(task); // No await - queued
}

// Wait for all to complete
const completed = await client.waitForQueueEmpty(60000);
```

## Advanced Features

### Predictive Throttling

The system predicts future usage to prevent limits:

```javascript
// Internal calculation
projectedCount = currentRequests + (pendingRequests * estimatedProcessingRate)

if (projectedCount > effectiveLimit) {
  // Throttle preemptively
}
```

### Adaptive Rate Adjustment

```javascript
// After rate limit hit
adaptiveRate *= 0.7;  // Reduce to 70%

// After 50 consecutive successes
adaptiveRate *= 1.02; // Increase by 2% (max 120%)
```

### Burst Protection

Prevents rapid bursts that might trigger undocumented limits:

```javascript
instantLimit = minuteLimit / 6;  // Max requests in 10 seconds

if (last10Seconds >= instantLimit * 0.95) {
  // Throttle to prevent burst
}
```

## Troubleshooting

### High Queue Length

```javascript
const stats = client.getDetailedStats();
if (stats.queue.length > 50) {
  // Reduce request rate or increase priority of important ops
  console.log('Oldest waiting:', stats.queue.oldestWaitTime + 'ms');
}
```

### Low Throughput

```javascript
if (stats.performance.throughput < expectedRate * 0.5) {
  // Check for failures
  if (stats.performance.successRate < 0.8) {
    console.log('High failure rate:', stats.windows.short.failureCount);
  }
  
  // Try optimizing
  client.optimize();
}
```

### Rate Limit Hits

```javascript
rateLimiter.on('rateLimitHit', (data) => {
  // Log the incident
  console.error('Rate limit at:', new Date());
  console.error('Previous rate:', data.oldRate);
  console.error('New rate:', data.newRate);
  
  // Consider reducing base limit
  // config.rateLimitPerMinute = Math.floor(config.rateLimitPerMinute * 0.8);
});
```

## Best Practices

1. **Set Appropriate Priorities**
   - User-facing operations: 7-9
   - Background tasks: 3-5
   - Bulk operations: 1-2

2. **Monitor Queue Length**
   - Alert if > 100 requests queued
   - Reduce load if consistently high

3. **Handle Failures Gracefully**
   ```javascript
   const results = await client.executeBatch(operations);
   const failures = results.filter(r => r.error);
   if (failures.length > 0) {
     // Retry or log failures
   }
   ```

4. **Use Batch Operations**
   - Combine similar operations
   - Use list endpoints with filters
   - Reduce total request count

5. **Enable Monitoring in Development**
   ```javascript
   const client = new OptimizedSDPClient(config, true);
   // Logs all queue activity and throttling
   ```

## Performance Expectations

With proper configuration:
- **Throughput**: 80-90% of configured limit
- **Success Rate**: >95% (no rate limit errors)
- **Queue Time**: <2s average for priority 5
- **Burst Handling**: Smooth 10-request bursts

## Example: Complete Implementation

```javascript
import { OptimizedSDPClient } from 'service-desk-plus-cloud-api/optimized';
import { loadConfig } from 'service-desk-plus-cloud-api';

async function processServiceRequests() {
  const config = loadConfig();
  const client = new OptimizedSDPClient(config, true);
  
  // Listen for issues
  client.timeTracker.on('rateLimitHit', () => {
    console.error('Rate limit hit - reducing operations');
  });
  
  try {
    // High-priority: Get open requests
    const openRequests = await client.executeHighPriority(
      'get-open-requests',
      () => client.requests.list({ status: 'Open' })
    );
    
    // Batch process updates
    const updates = openRequests.data.map(req => ({
      name: `Update ${req.id}`,
      priority: req.priority === 'High' ? 8 : 5,
      execute: () => client.requests.update(req.id, {
        notes: 'Processed by automation'
      })
    }));
    
    const results = await client.executeBatch(updates);
    
    // Wait for completion
    await client.waitForQueueEmpty();
    
    // Check performance
    const stats = client.getDetailedStats();
    console.log('Processed:', results.length);
    console.log('Throughput:', stats.performance.throughput);
    console.log('Success Rate:', stats.performance.successRate * 100 + '%');
    
  } catch (error) {
    console.error('Processing failed:', error);
    client.logStatus(); // Show queue state
  }
}
```

This implementation ensures maximum API utilization while preventing rate limit violations, making it ideal for production environments with high-volume operations.