import { getCurrentTenantId } from '../tenants/context.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger } from '../monitoring/auditLogger.js';

/**
 * Base error class for all SDP errors
 */
export abstract class SDPError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly tenantId?: string;
  public readonly module?: string;
  public readonly operation?: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly timestampUTC: string;
  public readonly timestampCST: string;
  
  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.tenantId = getCurrentTenantId();
    
    // Set timestamps
    this.timestamp = new Date();
    this.timestampUTC = this.timestamp.toISOString();
    
    // Convert to CST (US Central Time)
    const cstFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false,
    });
    this.timestampCST = cstFormatter.format(this.timestamp);
    
    // Log error to database
    this.logError();
  }
  
  private async logError(): Promise<void> {
    try {
      await auditLogger.log({
        tenantId: this.tenantId,
        eventType: `error.${this.code}`,
        eventCategory: 'api',
        actorType: 'system',
        action: this.operation || 'unknown',
        result: 'error',
        errorCode: this.code,
        errorMessage: this.message,
        metadata: {
          ...this.details,
          module: this.module,
          statusCode: this.statusCode,
          timestampUTC: this.timestampUTC,
          timestampCST: this.timestampCST,
          errorType: this.name,
        },
      });
    } catch (logError) {
      logger.error('Failed to log error to database', { error: logError });
    }
  }
}

/**
 * Authentication error - OAuth token issues
 */
export class SDPAuthError extends SDPError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTH_ERROR', 401, details);
    this.module = 'auth';
  }
}

/**
 * Validation error - Invalid input data
 */
export class SDPValidationError extends SDPError {
  public readonly field?: string;
  public readonly validationErrors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  
  constructor(
    message: string,
    field?: string,
    validationErrors?: Array<{ field: string; message: string; code: string }>,
    details?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.module = 'validation';
    this.field = field;
    this.validationErrors = validationErrors;
  }
}

/**
 * Not found error - Resource doesn't exist
 */
export class SDPNotFoundError extends SDPError {
  public readonly resourceType: string;
  public readonly resourceId: string;
  
  constructor(
    resourceType: string,
    resourceId: string,
    details?: Record<string, any>
  ) {
    super(
      `${resourceType} with ID ${resourceId} not found`,
      'NOT_FOUND',
      404,
      details
    );
    this.module = resourceType.toLowerCase();
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Rate limit error - Too many requests
 */
export class SDPRateLimitError extends SDPError {
  public readonly retryAfter: number;
  public readonly limit: number;
  public readonly window: string;
  
  constructor(
    retryAfter: number,
    limit: number,
    window: string,
    details?: Record<string, any>
  ) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds`,
      'RATE_LIMIT_EXCEEDED',
      429,
      details
    );
    this.module = 'rateLimit';
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.window = window;
  }
}

/**
 * Network error - Connection issues
 */
export class SDPNetworkError extends SDPError {
  public readonly originalError?: Error;
  
  constructor(message: string, originalError?: Error, details?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', 0, details);
    this.module = 'network';
    this.originalError = originalError;
  }
}

/**
 * Permission error - Insufficient privileges
 */
export class SDPPermissionError extends SDPError {
  public readonly requiredScope?: string;
  public readonly availableScopes?: string[];
  
  constructor(
    message: string,
    requiredScope?: string,
    availableScopes?: string[],
    details?: Record<string, any>
  ) {
    super(message, 'PERMISSION_DENIED', 403, details);
    this.module = 'permission';
    this.requiredScope = requiredScope;
    this.availableScopes = availableScopes;
  }
}

/**
 * Configuration error - Missing or invalid config
 */
export class SDPConfigError extends SDPError {
  public readonly configKey?: string;
  
  constructor(message: string, configKey?: string, details?: Record<string, any>) {
    super(message, 'CONFIG_ERROR', 500, details);
    this.module = 'config';
    this.configKey = configKey;
  }
}

/**
 * Module-specific errors
 */

// Request module errors
export class SDPRequestError extends SDPError {
  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message, `REQUEST_${code}`, statusCode, details);
    this.module = 'requests';
  }
}

// Problem module errors
export class SDPProblemError extends SDPError {
  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message, `PROBLEM_${code}`, statusCode, details);
    this.module = 'problems';
  }
}

// Change module errors
export class SDPChangeError extends SDPError {
  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message, `CHANGE_${code}`, statusCode, details);
    this.module = 'changes';
  }
}

// Project module errors
export class SDPProjectError extends SDPError {
  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message, `PROJECT_${code}`, statusCode, details);
    this.module = 'projects';
  }
}

// Asset module errors
export class SDPAssetError extends SDPError {
  constructor(message: string, code: string, statusCode: number, details?: Record<string, any>) {
    super(message, `ASSET_${code}`, statusCode, details);
    this.module = 'assets';
  }
}

/**
 * Error utility functions
 */

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof SDPNetworkError) {
    return true;
  }
  
  if (error instanceof SDPRateLimitError) {
    return true;
  }
  
  if (error instanceof SDPError) {
    // 5xx errors are generally retryable
    return error.statusCode >= 500;
  }
  
  // Check for common network error codes
  if (error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET') {
    return true;
  }
  
  return false;
}

/**
 * Parse SDP API error response
 */
export function parseSDPError(error: any, module?: string, operation?: string): SDPError {
  // Handle axios errors
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    // Parse SDP error format
    if (data?.response_status) {
      const sdpError = data.response_status;
      
      // Handle specific error codes
      if (status === 401) {
        return new SDPAuthError(sdpError.message || 'Authentication failed', {
          sdpCode: sdpError.status_code,
          response: data,
        });
      }
      
      if (status === 404) {
        return new SDPNotFoundError(
          module || 'Resource',
          data.id || 'unknown',
          { response: data }
        );
      }
      
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        return new SDPRateLimitError(
          parseInt(retryAfter),
          100, // Default limit
          'unknown',
          { response: data }
        );
      }
      
      if (status === 400 && sdpError.messages) {
        const validationErrors = sdpError.messages.map((msg: any) => ({
          field: msg.field,
          message: msg.message,
          code: msg.code,
        }));
        
        return new SDPValidationError(
          'Validation failed',
          undefined,
          validationErrors,
          { response: data }
        );
      }
    }
    
    // Generic HTTP error
    return new SDPError(
      data?.message || error.message || 'API request failed',
      `HTTP_${status}`,
      status,
      { response: data, module, operation }
    );
  }
  
  // Network error
  if (error.code || error.errno) {
    return new SDPNetworkError(
      error.message || 'Network error',
      error,
      { code: error.code, errno: error.errno }
    );
  }
  
  // Unknown error
  return new SDPError(
    error.message || 'Unknown error',
    'UNKNOWN',
    500,
    { originalError: error.toString(), module, operation }
  );
}