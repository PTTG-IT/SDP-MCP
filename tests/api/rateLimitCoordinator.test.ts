import { RateLimitCoordinator } from '../../src/api/rateLimitCoordinator';
import { jest } from '@jest/globals';

describe('RateLimitCoordinator', () => {
  let coordinator: RateLimitCoordinator;

  beforeEach(() => {
    // Reset singleton instance
    (RateLimitCoordinator as any).instance = null;
    coordinator = RateLimitCoordinator.getInstance();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Token Refresh Rate Limiting', () => {
    it('should enforce no more than 1 refresh every 3 minutes', async () => {
      // First refresh should be allowed
      const canRefresh1 = await coordinator.canRefreshToken();
      expect(canRefresh1).toBe(true);

      // Record successful refresh
      await coordinator.recordTokenRefresh(true);

      // Immediate second refresh should be blocked
      const canRefresh2 = await coordinator.canRefreshToken();
      expect(canRefresh2).toBe(false);

      // Time until next refresh should be ~3 minutes
      const timeUntilNext = coordinator.getTimeUntilNextRefresh();
      expect(timeUntilNext).toBeGreaterThan(179000); // > 2:59
      expect(timeUntilNext).toBeLessThanOrEqual(180000); // <= 3:00
    });

    it('should track 10 tokens per 10 minutes window', async () => {
      // Simulate 10 successful refreshes over time
      for (let i = 0; i < 10; i++) {
        const canRefresh = await coordinator.canRefreshToken();
        if (canRefresh) {
          await coordinator.recordTokenRefresh(true);
        }
        
        // Advance time by 1 minute between refreshes
        jest.advanceTimersByTime(60000);
      }

      // 11th refresh should be blocked even after waiting
      const canRefresh11 = await coordinator.canRefreshToken();
      expect(canRefresh11).toBe(false);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      // Record multiple failures
      await coordinator.recordTokenRefresh(false, 'Test error 1');
      await coordinator.recordTokenRefresh(false, 'Test error 2');
      await coordinator.recordTokenRefresh(false, 'Test error 3');

      // Circuit should be open, blocking requests
      const canRefresh = await coordinator.canRefreshToken();
      expect(canRefresh).toBe(false);

      const status = coordinator.getStatus();
      expect(status.circuitBreaker.state).toBe('open');
      expect(status.circuitBreaker.failures).toBe(3);
    });

    it('should reset circuit breaker on success', async () => {
      // Open the circuit
      await coordinator.recordTokenRefresh(false, 'Error 1');
      await coordinator.recordTokenRefresh(false, 'Error 2');
      await coordinator.recordTokenRefresh(false, 'Error 3');

      // Reset manually for testing
      coordinator.resetCircuitBreaker();

      // Should be able to refresh again
      const canRefresh = await coordinator.canRefreshToken();
      expect(canRefresh).toBe(true);
    });
  });

  describe('API Request Rate Limiting', () => {
    it('should enforce per-minute limits', () => {
      // Make requests up to limit
      for (let i = 0; i < 60; i++) {
        const canMake = coordinator.canMakeApiRequest();
        expect(canMake).toBe(true);
        coordinator.recordApiRequest();
      }

      // 61st request should be blocked
      const canMakeExtra = coordinator.canMakeApiRequest();
      expect(canMakeExtra).toBe(false);
    });

    it('should enforce per-hour limits', () => {
      // Update rules for testing
      coordinator.updateRules({
        maxRequestsPerMinute: 100,
        maxRequestsPerHour: 200
      });

      // Make 200 requests
      for (let i = 0; i < 200; i++) {
        coordinator.recordApiRequest();
      }

      // 201st request should be blocked
      const canMake = coordinator.canMakeApiRequest();
      expect(canMake).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    it('should provide comprehensive status', async () => {
      // Make some activity
      await coordinator.recordTokenRefresh(true);
      coordinator.recordApiRequest();
      coordinator.recordApiRequest();

      const status = coordinator.getStatus();
      
      expect(status.tokenRefresh).toBeDefined();
      expect(status.tokenRefresh.refreshesInWindow).toBe(1);
      
      expect(status.apiRequests).toBeDefined();
      expect(status.apiRequests.requestsLastMinute).toBe(2);
      
      expect(status.circuitBreaker).toBeDefined();
      expect(status.circuitBreaker.state).toBe('closed');
    });
  });

  describe('Rule Updates', () => {
    it('should allow updating rate limit rules', async () => {
      // Update to more restrictive rules
      coordinator.updateRules({
        tokenRefreshMinInterval: 5 * 60 * 1000, // 5 minutes
        maxRequestsPerMinute: 30
      });

      // First refresh allowed
      await coordinator.recordTokenRefresh(true);

      // Check new interval is enforced
      const timeUntilNext = coordinator.getTimeUntilNextRefresh();
      expect(timeUntilNext).toBeGreaterThan(299000); // > 4:59
    });
  });
});