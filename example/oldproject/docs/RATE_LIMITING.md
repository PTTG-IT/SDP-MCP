# Rate Limiting Guide

## Overview

The Service Desk Plus MCP Server implements comprehensive rate limiting to ensure reliable operation and prevent API throttling. This is especially important when multiple users are accessing the service simultaneously.

## Current Implementation

### Basic Rate Limiting (`src/utils/rateLimit.ts`)

The project includes a sliding window rate limiter with:
- **Default limit**: 60 requests per minute (configurable)
- **Window size**: 1 minute sliding window
- **Automatic delays**: Waits when limit is reached
- **Statistics**: Track current usage and reset time

### Configuration

Set the rate limit via environment variable:
```bash
SDP_RATE_LIMIT_PER_MINUTE=60  # Default: 60
```

### How It Works

1. **Request Interception**: All API requests pass through the rate limiter
2. **Sliding Window**: Tracks requests in the last 60 seconds
3. **Automatic Waiting**: If limit reached, delays the request
4. **429 Handling**: Responds to rate limit errors from the API
5. **Exponential Backoff**: Retries with increasing delays

## Enhanced Multi-User Support

### Enhanced Rate Limiter (`src/utils/enhancedRateLimit.ts`)

For production environments with multiple users:

```typescript
import { EnhancedRateLimiter, RequestQueue } from './utils/enhancedRateLimit.js';

// Create rate limiter with per-user and global limits
const rateLimiter = new EnhancedRateLimiter(
  30,   // Max requests per user per minute
  300   // Max global requests per minute
);

// Create request queue for managing concurrent users
const queue = new RequestQueue(rateLimiter, 3); // Max 3 concurrent requests
```

### Features

1. **Per-User Tracking**: Individual rate limits for each user
2. **Global Limits**: Overall system rate limit
3. **Priority Queue**: High-priority requests get processed first
4. **Adaptive Rate Limiting**: Automatically adjusts based on API responses
5. **Event Monitoring**: Track usage patterns and issues

### Usage Example

```typescript
// Make a request with user context and priority
const result = await queue.enqueue(
  () => client.requests.list(),
  'user123',  // User ID
  8          // Priority (0-10)
);
```

## Monitoring and Optimization

### Rate Limit Monitor (`src/utils/rateLimitMonitor.ts`)

Track and optimize rate limit usage:

```typescript
import { RateLimitMonitor } from './utils/rateLimitMonitor.js';

const monitor = new RateLimitMonitor(rateLimiter);

// Listen for alerts
monitor.on('alert', (alert) => {
  console.log(`Rate limit alert: ${alert.message}`);
});

// Log current status
monitor.logStatus();

// Export metrics for analysis
const metrics = monitor.exportMetrics();
```

### Metrics Tracked

- Total requests and success rate
- Rate limit hits
- Average wait times
- Peak usage percentage
- Per-user statistics

## Best Practices

### 1. Configure Appropriate Limits

Start conservative and increase based on monitoring:
```bash
# Development
SDP_RATE_LIMIT_PER_MINUTE=30

# Production (single user)
SDP_RATE_LIMIT_PER_MINUTE=60

# Production (multi-user)
SDP_RATE_LIMIT_PER_MINUTE=20  # Per user
```

### 2. Implement Request Batching

Combine multiple operations when possible:
```typescript
// Instead of multiple calls
const req1 = await client.requests.get('123');
const req2 = await client.requests.get('456');

// Use list with filters
const requests = await client.requests.list({
  filter: 'id IN (123, 456)'
});
```

### 3. Use Caching

Cache frequently accessed data:
```typescript
const cache = new Map();

async function getCachedProject(id: string) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  
  const project = await client.projects.get(id);
  cache.set(id, project);
  
  // Expire after 5 minutes
  setTimeout(() => cache.delete(id), 300000);
  
  return project;
}
```

### 4. Priority Management

Set appropriate priorities for different operations:
```typescript
// High priority - user-facing operations
await queue.enqueue(createRequest, userId, 9);

// Medium priority - background updates
await queue.enqueue(updateProject, userId, 5);

// Low priority - bulk operations
await queue.enqueue(generateReport, userId, 2);
```

### 5. Error Handling

Handle rate limit errors gracefully:
```typescript
try {
  const result = await client.requests.create(data);
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Inform user and retry later
    console.log(`Rate limit hit. Retry in ${error.retryAfter}s`);
    
    // Queue for retry
    setTimeout(() => retryOperation(), error.retryAfter * 1000);
  }
}
```

## Troubleshooting

### Common Issues

1. **"Too many requests continuously"**
   - Reduce `SDP_RATE_LIMIT_PER_MINUTE`
   - Implement request batching
   - Check for request loops

2. **Long wait times**
   - Increase rate limits if possible
   - Prioritize important requests
   - Implement caching

3. **Uneven distribution**
   - Use per-user rate limiting
   - Implement fair queuing
   - Monitor user patterns

### Debug Mode

Enable detailed logging:
```typescript
rateLimiter.on('rateLimitWait', (data) => {
  console.log(`User ${data.userId} waiting ${data.waitTime}ms`);
});

rateLimiter.on('rateLimitHit', (data) => {
  console.log(`Rate limit hit! Multiplier: ${data.newMultiplier}`);
});
```

## API Rate Limits

While Service Desk Plus Cloud doesn't publicly document specific rate limits, observed behavior suggests:

- **General API**: ~60-100 requests per minute
- **Token refresh**: Maximum 5 per minute
- **Bulk operations**: May have lower limits

Always monitor actual API responses and adjust accordingly.

## Future Improvements

1. **Distributed Rate Limiting**: For multi-instance deployments
2. **Predictive Throttling**: AI-based usage prediction
3. **Request Coalescing**: Combine similar requests automatically
4. **Circuit Breaker**: Prevent cascading failures
5. **Rate Limit Headers**: Parse and use API response headers

## Example Implementation

Here's a complete example for production use:

```typescript
import { EnhancedRateLimiter, RequestQueue } from './utils/enhancedRateLimit.js';
import { RateLimitMonitor } from './utils/rateLimitMonitor.js';
import { SDPClient } from './api/client.js';

// Configure based on environment
const config = {
  perUserLimit: parseInt(process.env.RATE_LIMIT_PER_USER || '30'),
  globalLimit: parseInt(process.env.RATE_LIMIT_GLOBAL || '300'),
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '3')
};

// Initialize components
const rateLimiter = new EnhancedRateLimiter(
  config.perUserLimit,
  config.globalLimit
);

const queue = new RequestQueue(rateLimiter, config.maxConcurrent);
const monitor = new RateLimitMonitor(rateLimiter);

// Log status periodically
setInterval(() => monitor.logStatus(), 60000);

// Wrap client methods
export function createRateLimitedClient(baseClient: SDPClient, userId: string) {
  return new Proxy(baseClient, {
    get(target, prop) {
      const original = target[prop as keyof SDPClient];
      
      if (typeof original === 'function') {
        return (...args: any[]) => {
          return queue.enqueue(
            () => original.apply(target, args),
            userId,
            5 // Default priority
          );
        };
      }
      
      return original;
    }
  });
}
```

This ensures all API calls are automatically rate-limited and queued appropriately.