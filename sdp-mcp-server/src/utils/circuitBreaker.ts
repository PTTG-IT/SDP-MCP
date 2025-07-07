import { EventEmitter } from 'events';
import { logger } from '../monitoring/logging.js';
import { getRedisClient, RedisKeys } from './redis.js';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;      // Number of failures to open circuit
  successThreshold: number;      // Number of successes to close circuit
  timeout: number;              // Time in ms before trying half-open
  resetTimeout: number;         // Time in ms to reset failure count
  volumeThreshold: number;      // Minimum requests before opening
  errorThresholdPercentage: number; // Error percentage to open
}

/**
 * Circuit breaker metrics
 */
interface CircuitMetrics {
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: number;
  consecutiveSuccesses: number;
  state: CircuitState;
  nextAttempt: number;
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
  private readonly name: string;
  private readonly options: CircuitBreakerOptions;
  private metrics: CircuitMetrics;
  private readonly redis = getRedisClient();
  private readonly redisKey: string;
  
  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    super();
    this.name = name;
    this.redisKey = RedisKeys.circuitBreaker('', name);
    
    this.options = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      resetTimeout: 300000, // 5 minutes
      volumeThreshold: 10,
      errorThresholdPercentage: 50,
      ...options,
    };
    
    this.metrics = {
      failures: 0,
      successes: 0,
      totalRequests: 0,
      lastFailureTime: 0,
      consecutiveSuccesses: 0,
      state: CircuitState.CLOSED,
      nextAttempt: 0,
    };
  }
  
  /**
   * Get circuit breaker state
   */
  getState(): CircuitState {
    return this.metrics.state;
  }
  
  /**
   * Check if request is allowed
   */
  async canExecute(): Promise<boolean> {
    // Load state from Redis for distributed coordination
    await this.loadState();
    
    const now = Date.now();
    
    switch (this.metrics.state) {
      case CircuitState.CLOSED:
        return true;
        
      case CircuitState.OPEN:
        if (now >= this.metrics.nextAttempt) {
          // Try half-open
          await this.halfOpen();
          return true;
        }
        return false;
        
      case CircuitState.HALF_OPEN:
        return true;
        
      default:
        return false;
    }
  }
  
  /**
   * Record successful execution
   */
  async recordSuccess(): Promise<void> {
    await this.loadState();
    
    this.metrics.successes++;
    this.metrics.totalRequests++;
    this.metrics.consecutiveSuccesses++;
    
    if (this.metrics.state === CircuitState.HALF_OPEN) {
      if (this.metrics.consecutiveSuccesses >= this.options.successThreshold) {
        await this.close();
      }
    }
    
    await this.saveState();
  }
  
  /**
   * Record failed execution
   */
  async recordFailure(error?: Error): Promise<void> {
    await this.loadState();
    
    this.metrics.failures++;
    this.metrics.totalRequests++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();
    
    logger.warn('Circuit breaker failure recorded', {
      name: this.name,
      error: error?.message,
      failures: this.metrics.failures,
      state: this.metrics.state,
    });
    
    // Check if we should open the circuit
    if (this.metrics.state === CircuitState.CLOSED) {
      const shouldOpen = this.shouldOpen();
      if (shouldOpen) {
        await this.open();
      }
    } else if (this.metrics.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open state opens the circuit
      await this.open();
    }
    
    await this.saveState();
  }
  
  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const allowed = await this.canExecute();
    
    if (!allowed) {
      logger.debug('Circuit breaker open, request rejected', { name: this.name });
      
      if (fallback) {
        return fallback();
      }
      
      throw new CircuitBreakerError('Circuit breaker is open', this.name);
    }
    
    try {
      const result = await fn();
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure(error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  /**
   * Check if circuit should open
   */
  private shouldOpen(): boolean {
    // Not enough requests to make a decision
    if (this.metrics.totalRequests < this.options.volumeThreshold) {
      return false;
    }
    
    // Check failure threshold
    if (this.metrics.failures >= this.options.failureThreshold) {
      return true;
    }
    
    // Check error percentage
    const errorPercentage = (this.metrics.failures / this.metrics.totalRequests) * 100;
    if (errorPercentage >= this.options.errorThresholdPercentage) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Open the circuit
   */
  private async open(): Promise<void> {
    this.metrics.state = CircuitState.OPEN;
    this.metrics.nextAttempt = Date.now() + this.options.timeout;
    
    logger.warn('Circuit breaker opened', {
      name: this.name,
      failures: this.metrics.failures,
      nextAttempt: new Date(this.metrics.nextAttempt),
    });
    
    this.emit('open', this.name);
  }
  
  /**
   * Half-open the circuit
   */
  private async halfOpen(): Promise<void> {
    this.metrics.state = CircuitState.HALF_OPEN;
    this.metrics.consecutiveSuccesses = 0;
    
    logger.info('Circuit breaker half-open', { name: this.name });
    
    this.emit('halfOpen', this.name);
  }
  
  /**
   * Close the circuit
   */
  private async close(): Promise<void> {
    this.metrics.state = CircuitState.CLOSED;
    this.metrics.failures = 0;
    this.metrics.successes = 0;
    this.metrics.totalRequests = 0;
    this.metrics.consecutiveSuccesses = 0;
    
    logger.info('Circuit breaker closed', { name: this.name });
    
    this.emit('close', this.name);
  }
  
  /**
   * Load state from Redis
   */
  private async loadState(): Promise<void> {
    try {
      const data = await this.redis.get(this.redisKey);
      if (data) {
        const stored = JSON.parse(data) as CircuitMetrics;
        this.metrics = stored;
        
        // Check if we should reset based on timeout
        const now = Date.now();
        if (now - this.metrics.lastFailureTime > this.options.resetTimeout) {
          this.metrics.failures = 0;
          this.metrics.successes = 0;
          this.metrics.totalRequests = 0;
        }
      }
    } catch (error) {
      logger.error('Failed to load circuit breaker state', { error, name: this.name });
    }
  }
  
  /**
   * Save state to Redis
   */
  private async saveState(): Promise<void> {
    try {
      await this.redis.setex(
        this.redisKey,
        Math.ceil(this.options.resetTimeout / 1000),
        JSON.stringify(this.metrics)
      );
    } catch (error) {
      logger.error('Failed to save circuit breaker state', { error, name: this.name });
    }
  }
  
  /**
   * Get circuit breaker metrics
   */
  getMetrics(): Readonly<CircuitMetrics> {
    return { ...this.metrics };
  }
  
  /**
   * Reset circuit breaker
   */
  async reset(): Promise<void> {
    this.metrics = {
      failures: 0,
      successes: 0,
      totalRequests: 0,
      lastFailureTime: 0,
      consecutiveSuccesses: 0,
      state: CircuitState.CLOSED,
      nextAttempt: 0,
    };
    
    await this.saveState();
    logger.info('Circuit breaker reset', { name: this.name });
  }
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly circuitName: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Per-tenant circuit breaker manager
 */
export class TenantCircuitBreakerManager {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly options: Partial<CircuitBreakerOptions>;
  
  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = options;
  }
  
  /**
   * Get or create circuit breaker for tenant and service
   */
  getBreaker(tenantId: string, service: string): CircuitBreaker {
    const key = `${tenantId}:${service}`;
    
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = new CircuitBreaker(key, this.options);
      this.breakers.set(key, breaker);
      
      // Set up event listeners
      breaker.on('open', (name) => {
        logger.warn('Tenant circuit breaker opened', { tenantId, service, name });
      });
      
      breaker.on('close', (name) => {
        logger.info('Tenant circuit breaker closed', { tenantId, service, name });
      });
    }
    
    return breaker;
  }
  
  /**
   * Get all circuit breakers for a tenant
   */
  getTenantBreakers(tenantId: string): Map<string, CircuitBreaker> {
    const tenantBreakers = new Map<string, CircuitBreaker>();
    
    for (const [key, breaker] of this.breakers) {
      if (key.startsWith(`${tenantId}:`)) {
        const service = key.substring(tenantId.length + 1);
        tenantBreakers.set(service, breaker);
      }
    }
    
    return tenantBreakers;
  }
  
  /**
   * Reset all breakers for a tenant
   */
  async resetTenant(tenantId: string): Promise<void> {
    const breakers = this.getTenantBreakers(tenantId);
    
    await Promise.all(
      Array.from(breakers.values()).map(breaker => breaker.reset())
    );
    
    logger.info('All circuit breakers reset for tenant', { tenantId });
  }
  
  /**
   * Get metrics for all breakers
   */
  getAllMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [key, breaker] of this.breakers) {
      metrics[key] = breaker.getMetrics();
    }
    
    return metrics;
  }
}