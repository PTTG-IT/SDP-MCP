# Rate Limit System Migration Guide

## Overview

This guide helps you migrate from the current distributed rate limiting system to the new centralized Rate Limit Coordinator. The new system enforces the critical "no more than 1 token refresh every 3 minutes" rule and provides better coordination across all 32 MCP tools.

## Key Changes

### 1. Centralized Rate Limiting
- **Old**: Multiple independent rate limiters (`rateLimit.ts`, `enhancedRateLimit.ts`, etc.)
- **New**: Single `RateLimitCoordinator` that manages all rate limits

### 2. Token Refresh Management
- **Old**: Tools could trigger token refresh independently
- **New**: Background `TokenManager` handles all token refreshes

### 3. Circuit Breaker Protection
- **Old**: No circuit breaker, could repeatedly fail
- **New**: Circuit breaker prevents cascading failures

## Migration Steps

### Phase 1: Install New Components (Non-Breaking)

1. **Deploy new files** (these don't affect existing code):
   ```
   src/api/rateLimitCoordinator.ts
   src/api/circuitBreaker.ts
   src/api/tokenManager.ts
   src/api/authV2.ts
   src/monitoring/rateLimitMonitor.ts
   src/db/rateLimitStore.ts
   ```

2. **Update database schema**:
   ```sql
   -- Run these migrations
   CREATE TABLE IF NOT EXISTS distributed_locks (
     lock_name VARCHAR(255) PRIMARY KEY,
     locked_by VARCHAR(255) NOT NULL,
     locked_at TIMESTAMP NOT NULL,
     expires_at TIMESTAMP NOT NULL
   );

   CREATE TABLE IF NOT EXISTS circuit_breakers (
     name VARCHAR(255) PRIMARY KEY,
     state VARCHAR(20) NOT NULL,
     failure_count INTEGER DEFAULT 0,
     last_failure_at TIMESTAMP,
     state_changed_at TIMESTAMP NOT NULL,
     metadata JSONB
   );

   CREATE INDEX IF NOT EXISTS idx_token_requests_type_time 
   ON token_requests(request_type, requested_at DESC);
   ```

### Phase 2: Update Main Server (Breaking Change)

1. **Update `src/index.ts`**:
   ```typescript
   import { AuthManagerV2 } from './api/authV2.js';
   import { TokenManager } from './api/tokenManager.js';
   import { RateLimitMonitor } from './monitoring/rateLimitMonitor.js';

   // Replace old auth manager
   const authManager = new AuthManagerV2(config);
   const tokenManager = TokenManager.getInstance(authManager);

   // Start background services
   await tokenManager.start();

   // Optional: Start monitoring
   const monitor = new RateLimitMonitor();
   monitor.setTokenManager(tokenManager);
   monitor.start();
   ```

2. **Update `src/api/client.ts`**:
   ```typescript
   // Change auth manager import
   import { AuthManagerV2 } from './authV2.js';

   // Update constructor
   constructor(config: SDPConfig) {
     this.authManager = new AuthManagerV2(config);
     // ... rest of initialization
   }
   ```

### Phase 3: Remove Token Refresh from API Client

1. **Update `src/api/client.ts` request method**:
   ```typescript
   private async request<T>(config: AxiosRequestConfig): Promise<T> {
     try {
       // Get token without refresh
       const token = await this.authManager.getAccessToken();
       
       const response = await this.axios.request<T>({
         ...config,
         headers: {
           ...config.headers,
           Authorization: `Bearer ${token}`,
         },
       });
       
       return response.data;
     } catch (error) {
       // Remove automatic token refresh on 401
       if (axios.isAxiosError(error) && error.response?.status === 401) {
         throw new SDPAuthError('Authentication failed. Token may be expired.');
       }
       throw error;
     }
   }
   ```

### Phase 4: Update Environment Variables

Add new optional environment variables:
```bash
# Token management
SDP_TOKEN_CHECK_INTERVAL=60000      # How often to check token expiry (ms)
SDP_TOKEN_REFRESH_MARGIN=300000     # Refresh tokens 5 minutes before expiry

# Rate limiting
SDP_MAX_REQUESTS_PER_MINUTE=60      # API request limit per minute
SDP_MAX_REQUESTS_PER_HOUR=1000      # API request limit per hour

# Circuit breaker
SDP_CIRCUIT_FAILURE_THRESHOLD=3     # Failures before opening circuit
SDP_CIRCUIT_RESET_TIMEOUT=300000    # Time before retry (5 minutes)
```

### Phase 5: Testing

1. **Run the test script**:
   ```bash
   npm run build
   node scripts/test-rate-limit-coordinator.js
   ```

2. **Monitor the new system**:
   ```bash
   # Add monitoring endpoint to your server
   app.get('/api/rate-limit-status', (req, res) => {
     const monitor = getRateLimitMonitor();
     res.json(monitor.generateSummary());
   });
   ```

## Rollback Plan

If issues occur, you can rollback by:

1. **Revert `src/index.ts`** to use original `AuthManager`
2. **Revert `src/api/client.ts`** to original version
3. **Stop background services** (TokenManager, RateLimitMonitor)

The new files can remain in place without affecting the old system.

## Benefits of Migration

1. **Strict Rate Limit Enforcement**: Guarantees no more than 1 token refresh every 3 minutes
2. **Better Failure Handling**: Circuit breaker prevents cascade failures
3. **Centralized Monitoring**: Single place to monitor all rate limits
4. **Database Persistence**: Rate limits persist across restarts
5. **Cross-Instance Coordination**: Multiple instances share rate limit state

## Common Issues and Solutions

### Issue: "No access token available"
**Solution**: Ensure TokenManager is started before making API calls

### Issue: "Rate limit prevents token refresh"
**Solution**: This is expected behavior. Wait for the indicated time or use force refresh in emergencies

### Issue: "Circuit breaker is OPEN"
**Solution**: Check logs for repeated failures. Circuit will auto-reset after timeout

## Monitoring and Alerts

The new system provides real-time monitoring:

```javascript
// Listen for alerts
monitor.on('alert', (alert) => {
  if (alert.level === 'critical') {
    // Send to alerting system
    notifyOps(alert.message);
  }
});

// Get current status
const status = monitor.getCurrentMetrics();
console.log('Token refresh allowed:', status.tokenRefresh.canRefreshNow);
console.log('API usage:', status.apiRequests.utilizationPercentMinute + '%');
```

## Post-Migration Cleanup

After successful migration:

1. **Delete deprecated files**:
   - `src/utils/rateLimit.ts`
   - `src/utils/enhancedRateLimit.ts`
   - `src/utils/timeTrackedRateLimit.ts`

2. **Update documentation**:
   - Remove references to old rate limiting
   - Update API documentation with new behavior

3. **Archive old test scripts** that test deprecated functionality

## Support

For questions or issues during migration:
1. Check the test scripts for examples
2. Review the comprehensive JSDoc comments in new files
3. Monitor logs during the migration process

Remember: The key goal is ensuring no more than 1 token refresh every 3 minutes across all tools and instances.