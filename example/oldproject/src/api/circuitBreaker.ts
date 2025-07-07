/**
 * Circuit breaker implementation for handling failures gracefully
 */

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation, requests allowed
  OPEN = 'open',         // Circuit tripped, requests blocked
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Failures before opening circuit
  resetTimeout: number;        // MS before attempting reset
  successThreshold: number;    // Successes needed to close from half-open
  volumeThreshold?: number;    // Minimum requests before evaluating
  errorThresholdPercentage?: number; // Error percentage to open circuit
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextRetryTime: Date | null;
  totalRequests: number;
  errorCount: number;
}

/**
 * Generic circuit breaker for protecting against cascading failures
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private circuitOpenedAt: Date | null = null;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private requestWindow: Date[] = [];
  // private readonly windowDuration: number = 60000; // 1 minute window

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<R>(
    fn: () => Promise<R>,
    fallback?: () => R | Promise<R>
  ): Promise<R> {
    // Check if circuit should be open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback && this.state === CircuitState.OPEN) {
        return fallback();
      }
      
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private onSuccess(): void {
    this.requestCount++;
    this.successes++;
    this.lastSuccessTime = new Date();
    this.recordRequest(true);

    // Reset failures on success in CLOSED state
    if (this.state === CircuitState.CLOSED) {
      this.failures = 0;
    }

    // Check if we can close from HALF_OPEN
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Record failed execution
   */
  private onFailure(): void {
    this.requestCount++;
    this.failures++;
    this.errorCount++;
    this.lastFailureTime = new Date();
    this.recordRequest(false);

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state reopens the circuit
      this.transitionToOpen();
    }
  }

  /**
   * Check if circuit should open based on failure criteria
   */
  private shouldOpen(): boolean {
    // Check absolute failure threshold
    if (this.failures >= this.options.failureThreshold) {
      return true;
    }

    // Check volume and error percentage if configured
    if (this.options.volumeThreshold && this.options.errorThresholdPercentage) {
      this.cleanupRequestWindow();
      
      if (this.requestWindow.length >= this.options.volumeThreshold) {
        const recentErrors = this.requestWindow.filter(r => !r).length;
        const errorPercentage = (recentErrors / this.requestWindow.length) * 100;
        
        if (errorPercentage >= this.options.errorThresholdPercentage) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.circuitOpenedAt) return false;
    
    const elapsedTime = Date.now() - this.circuitOpenedAt.getTime();
    return elapsedTime >= this.options.resetTimeout;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.circuitOpenedAt = new Date();
    this.successes = 0;
    console.log(`Circuit breaker '${this.name}' opened due to failures`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.failures = 0;
    this.successes = 0;
    console.log(`Circuit breaker '${this.name}' half-open, testing recovery`);
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.circuitOpenedAt = null;
    console.log(`Circuit breaker '${this.name}' closed, service recovered`);
  }

  /**
   * Record request for window-based metrics
   */
  private recordRequest(success: boolean): void {
    this.requestWindow.push(success as any);
  }

  /**
   * Clean up old requests from window
   */
  private cleanupRequestWindow(): void {
    // This is simplified - in production you'd track timestamps
    // For now, just limit the array size
    if (this.requestWindow.length > 100) {
      this.requestWindow = this.requestWindow.slice(-100);
    }
  }

  /**
   * Get current state of circuit breaker
   */
  getState(): CircuitBreakerState {
    let nextRetryTime: Date | null = null;
    if (this.circuitOpenedAt && this.state === CircuitState.OPEN) {
      nextRetryTime = new Date(
        this.circuitOpenedAt.getTime() + this.options.resetTimeout
      );
    }

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime,
      totalRequests: this.requestCount,
      errorCount: this.errorCount
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.circuitOpenedAt = null;
    this.requestCount = 0;
    this.errorCount = 0;
    this.requestWindow = [];
  }

  /**
   * Force circuit to OPEN state (for testing/manual intervention)
   */
  open(): void {
    this.transitionToOpen();
  }

  /**
   * Force circuit to CLOSED state (for testing/manual intervention)  
   */
  close(): void {
    this.transitionToClosed();
  }
}