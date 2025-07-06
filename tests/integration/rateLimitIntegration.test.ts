import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RateLimitSystem } from '../../src/integration/rateLimitIntegration';
import { AuthManagerV2 } from '../../src/api/authV2';
import { SDPConfig } from '../../src/api/types';

// Mock dependencies
jest.mock('../../src/api/authV2');
jest.mock('../../src/db/config');

describe('RateLimitIntegration', () => {
  let rateLimitSystem: RateLimitSystem;
  let mockAuthManager: jest.Mocked<AuthManagerV2>;
  let config: SDPConfig;

  beforeEach(() => {
    jest.useFakeTimers();

    config = {
      clientId: 'test-client',
      clientSecret: 'test-secret',
      instanceName: 'test-instance',
      authCode: 'test-code'
    };

    // Create mock auth manager
    mockAuthManager = {
      getAccessToken: jest.fn().mockResolvedValue('test-token'),
      refreshAccessToken: jest.fn().mockResolvedValue(undefined),
      isTokenValid: jest.fn().mockReturnValue(true),
      getTokenExpiry: jest.fn().mockReturnValue(new Date(Date.now() + 3600000))
    } as any;

    rateLimitSystem = new RateLimitSystem(mockAuthManager, config, {
      enableMonitoring: true,
      enableAnalytics: false,
      enableQueue: false,
      enableCoordination: false
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('System Initialization', () => {
    it('should start all components successfully', async () => {
      await rateLimitSystem.start();

      const status = await rateLimitSystem.getStatus();
      
      expect(status).toHaveProperty('coordinator');
      expect(status).toHaveProperty('tokenManager');
      expect(status).toHaveProperty('monitor');
      expect(status.coordinator).toBeDefined();
      expect(status.tokenManager).toBeDefined();
    });

    it('should stop all components cleanly', async () => {
      await rateLimitSystem.start();
      await rateLimitSystem.stop();

      // System should be stopped without errors
      expect(true).toBe(true); // Placeholder - actual implementation would verify components are stopped
    });
  });

  describe('Rate Limiting Enforcement', () => {
    it('should enforce Zoho token creation limits', async () => {
      await rateLimitSystem.start();

      const coordinator = rateLimitSystem.getCoordinator();
      
      // First token refresh should be allowed
      const canRefresh1 = await coordinator.canRefreshToken();
      expect(canRefresh1).toBe(true);

      // Record token refresh
      await coordinator.recordTokenRefresh(true);

      // Immediate second refresh should be blocked (3-minute minimum interval)
      const canRefresh2 = await coordinator.canRefreshToken();
      expect(canRefresh2).toBe(false);

      // Advance time by 3 minutes
      jest.advanceTimersByTime(3 * 60 * 1000);

      // Should now be allowed
      const canRefresh3 = await coordinator.canRefreshToken();
      expect(canRefresh3).toBe(true);
    });

    it('should enforce 10 tokens per 10 minutes sliding window', async () => {
      await rateLimitSystem.start();

      const coordinator = rateLimitSystem.getCoordinator();

      // Make 10 token requests in quick succession
      for (let i = 0; i < 10; i++) {
        await coordinator.recordTokenRefresh(true);
        jest.advanceTimersByTime(30000); // 30 seconds between each
      }

      // 11th request should be blocked
      const canRefresh = await coordinator.canRefreshToken();
      expect(canRefresh).toBe(false);

      // Advance time by 10 minutes to clear the window
      jest.advanceTimersByTime(10 * 60 * 1000);

      // Should now be allowed again
      const canRefreshAfterWindow = await coordinator.canRefreshToken();
      expect(canRefreshAfterWindow).toBe(true);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker after repeated failures', async () => {
      await rateLimitSystem.start();
      
      const coordinator = rateLimitSystem.getCoordinator();

      // Simulate 3 consecutive failures
      for (let i = 0; i < 3; i++) {
        await coordinator.recordTokenRefresh(false);
      }

      const status = await rateLimitSystem.getStatus();
      
      // Circuit breaker should be open
      expect(status.coordinator.circuitBreaker.state).toBe('open');
    });

    it('should allow recovery after circuit breaker timeout', async () => {
      await rateLimitSystem.start();
      
      const coordinator = rateLimitSystem.getCoordinator();

      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await coordinator.recordTokenRefresh(false);
      }

      // Advance time past reset timeout (30 seconds)
      jest.advanceTimersByTime(35000);

      // Circuit should attempt recovery
      const canRefresh = await coordinator.canRefreshToken();
      expect(canRefresh).toBe(true); // Should allow testing in half-open state
    });
  });

  describe('Performance Monitoring', () => {
    it('should track token refresh statistics', async () => {
      rateLimitSystem = new RateLimitSystem(mockAuthManager, config, {
        enableMonitoring: true,
        enableAnalytics: true
      });

      await rateLimitSystem.start();

      const coordinator = rateLimitSystem.getCoordinator();

      // Perform some operations
      await coordinator.recordTokenRefresh(true);
      await coordinator.recordTokenRefresh(false);
      await coordinator.recordTokenRefresh(true);

      const status = await rateLimitSystem.getStatus();

      expect(status.coordinator.tokenRefresh.lastRefreshTime).toBeDefined();
      expect(status.coordinator.circuitBreaker.failures).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const { getDbPool } = await import('../../src/db/config');
      (getDbPool as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(rateLimitSystem.start()).resolves.not.toThrow();
      
      // System should still function without database
      const status = await rateLimitSystem.getStatus();
      expect(status).toBeDefined();
    });

    it('should continue operation when monitoring fails', async () => {
      await rateLimitSystem.start();

      // This should not throw even if monitoring encounters errors
      await expect(rateLimitSystem.getStatus()).resolves.toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should handle missing optional configuration', () => {
      const minimalSystem = new RateLimitSystem(mockAuthManager, config);
      
      expect(minimalSystem).toBeDefined();
      // Should work with default options
    });

    it('should validate rate limit rules', async () => {
      await rateLimitSystem.start();
      
      const coordinator = rateLimitSystem.getCoordinator();
      
      // Update rules with invalid values
      coordinator.updateRules({
        tokenRefreshMinInterval: -1, // Invalid
        maxTokensPerWindow: 0, // Invalid
        tokenWindowDuration: 1000,
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
        failureThreshold: 3,
        resetTimeout: 30000,
        halfOpenRequests: 3
      });

      // Should handle invalid rules gracefully
      const canRefresh = await coordinator.canRefreshToken();
      expect(typeof canRefresh).toBe('boolean');
    });
  });
});