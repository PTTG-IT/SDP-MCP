import { RateLimiter } from '../src/middleware/rateLimiter';
import { CircuitBreaker } from '../src/utils/circuitBreaker';
import { withBackoff, RetryPolicy } from '../src/utils/backoff';

describe('Rate Limiting and Circuit Breakers', () => {
  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;
    
    beforeEach(() => {
      rateLimiter = new RateLimiter();
    });
    
    it('should allow requests within limit', async () => {
      const key = 'test-tenant:api';
      const limit = 5;
      const window = 60000; // 1 minute
      
      // Make requests within limit
      for (let i = 0; i < limit; i++) {
        const result = await rateLimiter.checkRateLimit(key, limit, window);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i - 1);
      }
    });
    
    it('should block requests exceeding limit', async () => {
      const key = 'test-tenant:api';
      const limit = 5;
      const window = 60000;
      
      // Make requests up to limit
      for (let i = 0; i < limit; i++) {
        await rateLimiter.checkRateLimit(key, limit, window);
      }
      
      // Next request should be blocked
      const result = await rateLimiter.checkRateLimit(key, limit, window);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
  
  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;
    
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker('test-service', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
      });
    });
    
    it('should allow requests when closed', async () => {
      const canExecute = await circuitBreaker.canExecute();
      expect(canExecute).toBe(true);
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should open after failure threshold', async () => {
      // Record failures
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.recordFailure(new Error('Test error'));
      }
      
      const canExecute = await circuitBreaker.canExecute();
      expect(canExecute).toBe(false);
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
    
    it('should execute with fallback when open', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.recordFailure(new Error('Test error'));
      }
      
      const result = await circuitBreaker.execute(
        async () => {
          throw new Error('Should not execute');
        },
        async () => 'fallback result'
      );
      
      expect(result).toBe('fallback result');
    });
  });
  
  describe('Backoff Strategy', () => {
    it('should retry with exponential backoff', async () => {
      let attempts = 0;
      const startTime = Date.now();
      
      try {
        await withBackoff(
          async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('Temporary error');
            }
            return 'success';
          },
          {
            maxAttempts: 5,
            initialDelay: 100,
            factor: 2,
            jitter: false,
          }
        );
      } catch (error) {
        // Should not reach here
      }
      
      expect(attempts).toBe(3);
      const duration = Date.now() - startTime;
      // Should take at least 100 + 200 = 300ms
      expect(duration).toBeGreaterThanOrEqual(300);
    });
    
    it('should throw after max attempts', async () => {
      let attempts = 0;
      
      await expect(
        withBackoff(
          async () => {
            attempts++;
            throw new Error('Persistent error');
          },
          {
            maxAttempts: 3,
            initialDelay: 10,
          }
        )
      ).rejects.toThrow('Operation failed after 3 attempts');
      
      expect(attempts).toBe(3);
    });
  });
  
  describe('Integration', () => {
    it('should handle rate limiting with circuit breaker and retry', async () => {
      const rateLimiter = new RateLimiter();
      const circuitBreaker = new CircuitBreaker('api-service');
      const retryPolicy = new RetryPolicy({
        maxAttempts: 3,
        initialDelay: 100,
      });
      
      // Simulate API call with rate limiting and circuit breaker
      const makeApiCall = async () => {
        // Check rate limit
        const rateLimitResult = await rateLimiter.checkRateLimit(
          'tenant:api',
          10,
          60000
        );
        
        if (!rateLimitResult.allowed) {
          throw new Error('Rate limit exceeded');
        }
        
        // Execute with circuit breaker
        return circuitBreaker.execute(async () => {
          // Simulate API call
          return { data: 'success' };
        });
      };
      
      // Execute with retry policy
      const result = await retryPolicy.execute(makeApiCall);
      expect(result.data).toBe('success');
    });
  });
});