import { logger } from '../monitoring/logging.js';

/**
 * Backoff strategy types
 */
export enum BackoffStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  CONSTANT = 'constant',
}

/**
 * Backoff options
 */
export interface BackoffOptions {
  strategy: BackoffStrategy;
  initialDelay: number;      // Initial delay in ms
  maxDelay: number;          // Maximum delay in ms
  factor: number;            // Multiplication factor for exponential
  maxAttempts: number;       // Maximum number of attempts
  jitter: boolean;           // Add randomness to delays
  onRetry?: (attempt: number, delay: number, error?: Error) => void;
}

/**
 * Default backoff options
 */
const DEFAULT_OPTIONS: BackoffOptions = {
  strategy: BackoffStrategy.EXPONENTIAL,
  initialDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  maxAttempts: 5,
  jitter: true,
  onRetry: undefined,
};

/**
 * Calculate backoff delay
 */
export function calculateDelay(
  attempt: number,
  options: BackoffOptions
): number {
  let delay: number;
  
  switch (options.strategy) {
    case BackoffStrategy.EXPONENTIAL:
      delay = options.initialDelay * Math.pow(options.factor, attempt - 1);
      break;
      
    case BackoffStrategy.LINEAR:
      delay = options.initialDelay * attempt;
      break;
      
    case BackoffStrategy.CONSTANT:
      delay = options.initialDelay;
      break;
      
    default:
      delay = options.initialDelay;
  }
  
  // Apply max delay cap
  delay = Math.min(delay, options.maxDelay);
  
  // Add jitter if enabled
  if (options.jitter) {
    // Add random jitter between -25% and +25%
    const jitterRange = delay * 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterRange;
    delay = Math.round(delay + jitter);
  }
  
  return Math.max(0, delay);
}

/**
 * Execute function with backoff retry
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<BackoffOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, opts);
      
      // Call retry callback if provided
      if (opts.onRetry) {
        opts.onRetry(attempt, delay, lastError);
      }
      
      logger.debug('Retrying with backoff', {
        attempt,
        delay,
        maxAttempts: opts.maxAttempts,
        error: lastError.message,
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All attempts failed
  const error = new BackoffError(
    `Operation failed after ${opts.maxAttempts} attempts`,
    opts.maxAttempts,
    lastError
  );
  
  logger.error('All retry attempts exhausted', {
    attempts: opts.maxAttempts,
    lastError: lastError?.message,
  });
  
  throw error;
}

/**
 * Backoff error class
 */
export class BackoffError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BackoffError';
  }
}

/**
 * Create a retry policy
 */
export class RetryPolicy {
  private readonly options: BackoffOptions;
  
  constructor(options: Partial<BackoffOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Execute with retry policy
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return withBackoff(fn, this.options);
  }
  
  /**
   * Create a new policy with modified options
   */
  with(options: Partial<BackoffOptions>): RetryPolicy {
    return new RetryPolicy({ ...this.options, ...options });
  }
  
  /**
   * Check if error is retryable
   */
  static isRetryable(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET') {
      return true;
    }
    
    // HTTP status codes that are retryable
    if (error.response?.status) {
      const status = error.response.status;
      // Retry on 5xx errors and specific 4xx errors
      return status >= 500 || status === 429 || status === 408;
    }
    
    // OAuth specific errors that might be temporary
    if (error.code === 'temporarily_unavailable') {
      return true;
    }
    
    return false;
  }
}

/**
 * Tenant-specific retry policies
 */
export class TenantRetryPolicies {
  private static readonly policies = new Map<string, RetryPolicy>();
  
  /**
   * Get retry policy for a tenant's rate limit tier
   */
  static getPolicy(rateLimitTier: string): RetryPolicy {
    let policy = this.policies.get(rateLimitTier);
    
    if (!policy) {
      // Create tier-specific policies
      switch (rateLimitTier) {
        case 'basic':
          policy = new RetryPolicy({
            maxAttempts: 3,
            initialDelay: 2000,
            maxDelay: 10000,
          });
          break;
          
        case 'standard':
          policy = new RetryPolicy({
            maxAttempts: 4,
            initialDelay: 1500,
            maxDelay: 15000,
          });
          break;
          
        case 'premium':
          policy = new RetryPolicy({
            maxAttempts: 5,
            initialDelay: 1000,
            maxDelay: 20000,
          });
          break;
          
        case 'enterprise':
          policy = new RetryPolicy({
            maxAttempts: 6,
            initialDelay: 500,
            maxDelay: 30000,
          });
          break;
          
        default:
          policy = new RetryPolicy();
      }
      
      this.policies.set(rateLimitTier, policy);
    }
    
    return policy;
  }
}

/**
 * Utility to create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Utility to create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>): void => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}