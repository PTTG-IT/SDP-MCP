import { CircuitBreaker, CircuitState } from '../../src/api/circuitBreaker';
// import { jest } from '@jest/globals';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 1000, // 1 second for testing
      successThreshold: 2
    });
  });

  describe('Normal Operation (CLOSED state)', () => {
    it('should execute function successfully when closed', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.getState().state).toBe(CircuitState.CLOSED);
    });

    it('should count failures', async () => {
      let failures = 0;
      
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch (e) {
          failures++;
        }
      }

      expect(failures).toBe(2);
      expect(breaker.getState().failures).toBe(2);
      expect(breaker.getState().state).toBe(CircuitState.CLOSED);
    });
  });

  describe('Circuit Opening (OPEN state)', () => {
    it('should open after failure threshold', async () => {
      // Cause 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test error');
          });
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState().state).toBe(CircuitState.OPEN);
      expect(breaker.getState().failures).toBe(3);
    });

    it('should reject calls when open', async () => {
      // Open the circuit
      breaker.open();

      await expect(
        breaker.execute(async () => 'should not execute')
      ).rejects.toThrow("Circuit breaker 'test-breaker' is OPEN");
    });

    it('should use fallback when provided', async () => {
      // Open the circuit
      breaker.open();

      const result = await breaker.execute(
        async () => 'should not execute',
        () => 'fallback value'
      );

      expect(result).toBe('fallback value');
    });
  });

  describe('Recovery (HALF_OPEN state)', () => {
    it('should transition to half-open after timeout', async () => {
      // Open the circuit
      breaker.open();
      expect(breaker.getState().state).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should transition to half-open
      try {
        await breaker.execute(async () => 'test');
      } catch (e) {
        // May succeed or fail
      }

      const state = breaker.getState().state;
      expect([CircuitState.HALF_OPEN, CircuitState.CLOSED]).toContain(state);
    });

    it('should close after success threshold in half-open', async () => {
      // Open then transition to half-open
      breaker.open();
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Successful executions should close circuit
      for (let i = 0; i < 2; i++) {
        await breaker.execute(async () => 'success');
      }

      expect(breaker.getState().state).toBe(CircuitState.CLOSED);
    });

    it('should reopen on failure in half-open', async () => {
      // Setup half-open state
      breaker.open();
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Force transition to half-open
      try {
        await breaker.execute(async () => {
          throw new Error('fail in half-open');
        });
      } catch (e) {
        // Expected
      }

      expect(breaker.getState().state).toBe(CircuitState.OPEN);
    });
  });

  describe('Manual Controls', () => {
    it('should allow manual reset', () => {
      // Open the circuit
      breaker.open();
      expect(breaker.getState().state).toBe(CircuitState.OPEN);

      // Manual reset
      breaker.reset();
      expect(breaker.getState().state).toBe(CircuitState.CLOSED);
      expect(breaker.getState().failures).toBe(0);
    });

    it('should allow manual open', () => {
      expect(breaker.getState().state).toBe(CircuitState.CLOSED);
      
      breaker.open();
      expect(breaker.getState().state).toBe(CircuitState.OPEN);
    });

    it('should allow manual close', () => {
      breaker.open();
      expect(breaker.getState().state).toBe(CircuitState.OPEN);
      
      breaker.close();
      expect(breaker.getState().state).toBe(CircuitState.CLOSED);
    });
  });

  describe('State Reporting', () => {
    it('should provide detailed state information', async () => {
      // Cause some failures
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('test');
          });
        } catch (e) {
          // Expected
        }
      }

      // Then a success
      await breaker.execute(async () => 'success');

      const state = breaker.getState();
      expect(state.state).toBe(CircuitState.CLOSED);
      expect(state.failures).toBe(0); // Reset on success
      expect(state.successes).toBe(1);
      expect(state.lastSuccessTime).toBeDefined();
      expect(state.lastFailureTime).toBeDefined();
      expect(state.totalRequests).toBe(3);
      expect(state.errorCount).toBe(2);
    });
  });

  describe('Error Threshold Percentage', () => {
    it('should open based on error percentage when configured', async () => {
      const percentBreaker = new CircuitBreaker('percent-breaker', {
        failureThreshold: 10, // High absolute threshold to avoid interference
        resetTimeout: 1000,
        successThreshold: 1,
        volumeThreshold: 5,
        errorThresholdPercentage: 50
      });

      // Make exactly 5 requests with 3 failures (60% error rate)
      // All failures first, then successes to ensure percentage check happens
      const results = [];
      for (let i = 0; i < 5; i++) {
        try {
          const result = await percentBreaker.execute(async () => {
            if (i < 3) throw new Error(`fail-${i}`);
            return `success-${i}`;
          });
          results.push(`success: ${result}`);
        } catch (e) {
          results.push(`error: ${e.message}`);
        }
      }

      // Should be open due to 60% error rate > 50% threshold
      // The circuit should open after processing the requests
      const state = percentBreaker.getState();
      
      // Verify we had the right mix of failures/successes
      expect(state.totalRequests).toBe(5);
      expect(state.errorCount).toBe(3);
      
      // Circuit should be open due to error percentage exceeding threshold
      expect(state.state).toBe(CircuitState.OPEN);
    });
  });
});