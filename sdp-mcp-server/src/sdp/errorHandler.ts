import { AxiosError } from 'axios';
import {
  SDPError,
  SDPAuthError,
  SDPValidationError,
  SDPNotFoundError,
  SDPRateLimitError,
  SDPNetworkError,
  SDPPermissionError,
  SDPRequestError,
  SDPProblemError,
  SDPChangeError,
  SDPProjectError,
  SDPAssetError,
} from '../utils/errors.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger } from '../monitoring/auditLogger.js';
import { getCurrentTenantId } from '../tenants/context.js';

/**
 * SDP API error codes
 */
export const SDP_ERROR_CODES = {
  // Authentication errors
  INVALID_TOKEN: 'E10001',
  TOKEN_EXPIRED: 'E10002',
  INSUFFICIENT_SCOPE: 'E10003',
  
  // Validation errors
  INVALID_INPUT: 'E20001',
  MISSING_REQUIRED_FIELD: 'E20002',
  INVALID_FORMAT: 'E20003',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'E30001',
  RESOURCE_ALREADY_EXISTS: 'E30002',
  RESOURCE_LOCKED: 'E30003',
  
  // Permission errors
  ACCESS_DENIED: 'E40001',
  OPERATION_NOT_ALLOWED: 'E40002',
  
  // Rate limit errors
  RATE_LIMIT_EXCEEDED: 'E50001',
  QUOTA_EXCEEDED: 'E50002',
  
  // Server errors
  INTERNAL_ERROR: 'E60001',
  SERVICE_UNAVAILABLE: 'E60002',
  MAINTENANCE_MODE: 'E60003',
} as const;

/**
 * SDP error response format
 */
interface SDPErrorResponse {
  response_status: {
    status_code: number;
    status: 'failure';
    messages: Array<{
      status_code: string;
      message: string;
      type?: string;
      field?: string;
    }>;
  };
}

/**
 * Enhanced SDP error handler
 */
export class SDPErrorHandler {
  /**
   * Handle axios error and convert to appropriate SDP error
   */
  static async handleError(
    error: AxiosError,
    module?: string,
    operation?: string
  ): Promise<SDPError> {
    const tenantId = getCurrentTenantId();
    
    // Log raw error
    logger.debug('Handling SDP error', {
      tenantId,
      module,
      operation,
      status: error.response?.status,
      code: error.code,
      message: error.message,
    });

    let sdpError: SDPError;

    if (error.response) {
      // API returned an error response
      sdpError = this.handleAPIError(error, module, operation);
    } else if (error.request) {
      // Request was made but no response received
      sdpError = this.handleNetworkError(error, module, operation);
    } else {
      // Something happened in setting up the request
      sdpError = this.handleRequestError(error, module, operation);
    }

    // Log to audit trail
    await this.logError(sdpError, tenantId);

    return sdpError;
  }

  /**
   * Handle API error responses
   */
  private static handleAPIError(
    error: AxiosError,
    module?: string,
    operation?: string
  ): SDPError {
    const status = error.response!.status;
    const data = error.response!.data as SDPErrorResponse | any;

    // Parse SDP error format
    if (data?.response_status?.messages) {
      return this.parseSDPErrorResponse(data, status, module, operation);
    }

    // Handle by status code
    switch (status) {
      case 400:
        return new SDPValidationError(
          data?.message || 'Bad request',
          undefined,
          undefined,
          { response: data, module, operation }
        );

      case 401:
        return new SDPAuthError(
          data?.message || 'Authentication failed',
          { response: data, module, operation }
        );

      case 403:
        return new SDPPermissionError(
          data?.message || 'Access denied',
          undefined,
          undefined,
          { response: data, module, operation }
        );

      case 404:
        return new SDPNotFoundError(
          module || 'Resource',
          data?.id || 'unknown',
          { response: data, operation }
        );

      case 429:
        const retryAfter = error.response!.headers['retry-after'];
        return new SDPRateLimitError(
          parseInt(retryAfter) || 60,
          100,
          'minute',
          { response: data, module, operation }
        );

      default:
        if (status >= 500) {
          return new SDPError(
            data?.message || 'Internal server error',
            'SERVER_ERROR',
            status,
            { response: data, module, operation }
          );
        }
        
        return new SDPError(
          data?.message || 'Unknown error',
          'UNKNOWN_ERROR',
          status,
          { response: data, module, operation }
        );
    }
  }

  /**
   * Parse SDP error response format
   */
  private static parseSDPErrorResponse(
    data: SDPErrorResponse,
    status: number,
    module?: string,
    operation?: string
  ): SDPError {
    const messages = data.response_status.messages;
    const primaryMessage = messages[0];

    // Check for specific error codes
    const errorCode = primaryMessage.status_code;
    
    // Authentication errors
    if (errorCode === SDP_ERROR_CODES.INVALID_TOKEN ||
        errorCode === SDP_ERROR_CODES.TOKEN_EXPIRED) {
      return new SDPAuthError(primaryMessage.message, {
        errorCode,
        messages,
        module,
        operation,
      });
    }

    // Permission errors
    if (errorCode === SDP_ERROR_CODES.ACCESS_DENIED ||
        errorCode === SDP_ERROR_CODES.OPERATION_NOT_ALLOWED ||
        errorCode === SDP_ERROR_CODES.INSUFFICIENT_SCOPE) {
      return new SDPPermissionError(
        primaryMessage.message,
        undefined,
        undefined,
        { errorCode, messages, module, operation }
      );
    }

    // Validation errors
    if (errorCode === SDP_ERROR_CODES.INVALID_INPUT ||
        errorCode === SDP_ERROR_CODES.MISSING_REQUIRED_FIELD ||
        errorCode === SDP_ERROR_CODES.INVALID_FORMAT) {
      const validationErrors = messages.map(msg => ({
        field: msg.field || 'unknown',
        message: msg.message,
        code: msg.status_code,
      }));

      return new SDPValidationError(
        'Validation failed',
        primaryMessage.field,
        validationErrors,
        { module, operation }
      );
    }

    // Rate limit errors
    if (errorCode === SDP_ERROR_CODES.RATE_LIMIT_EXCEEDED ||
        errorCode === SDP_ERROR_CODES.QUOTA_EXCEEDED) {
      return new SDPRateLimitError(
        60, // Default retry after
        100,
        'minute',
        { errorCode, messages, module, operation }
      );
    }

    // Module-specific errors
    return this.createModuleError(
      module,
      primaryMessage.message,
      errorCode,
      status,
      { messages, operation }
    );
  }

  /**
   * Handle network errors
   */
  private static handleNetworkError(
    error: AxiosError,
    module?: string,
    operation?: string
  ): SDPNetworkError {
    let message = 'Network error occurred';
    
    if (error.code === 'ECONNREFUSED') {
      message = 'Connection refused - Service Desk Plus API is unreachable';
    } else if (error.code === 'ENOTFOUND') {
      message = 'DNS lookup failed - Invalid Service Desk Plus URL';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'Request timeout - Service Desk Plus API is not responding';
    } else if (error.code === 'ECONNRESET') {
      message = 'Connection reset - Service Desk Plus API closed the connection';
    }

    return new SDPNetworkError(message, error, {
      code: error.code,
      module,
      operation,
    });
  }

  /**
   * Handle request setup errors
   */
  private static handleRequestError(
    error: AxiosError,
    module?: string,
    operation?: string
  ): SDPError {
    return new SDPError(
      error.message || 'Failed to setup request',
      'REQUEST_SETUP_ERROR',
      0,
      {
        originalError: error.message,
        module,
        operation,
      }
    );
  }

  /**
   * Create module-specific error
   */
  private static createModuleError(
    module: string | undefined,
    message: string,
    code: string,
    statusCode: number,
    details: any
  ): SDPError {
    switch (module?.toLowerCase()) {
      case 'requests':
        return new SDPRequestError(message, code, statusCode, details);
      
      case 'problems':
        return new SDPProblemError(message, code, statusCode, details);
      
      case 'changes':
        return new SDPChangeError(message, code, statusCode, details);
      
      case 'projects':
        return new SDPProjectError(message, code, statusCode, details);
      
      case 'assets':
        return new SDPAssetError(message, code, statusCode, details);
      
      default:
        return new SDPError(message, code, statusCode, details);
    }
  }

  /**
   * Log error to audit trail
   */
  private static async logError(
    error: SDPError,
    tenantId?: string
  ): Promise<void> {
    if (!tenantId) {
      return;
    }

    try {
      await auditLogger.log({
        tenantId,
        eventType: `api.error.${error.code}`,
        eventCategory: 'error',
        actorType: 'system',
        action: error.operation || 'unknown',
        result: 'error',
        errorCode: error.code,
        errorMessage: error.message,
        metadata: {
          module: error.module,
          statusCode: error.statusCode,
          details: error.details,
          timestampUTC: error.timestampUTC,
          timestampCST: error.timestampCST,
        },
      });
    } catch (logError) {
      logger.error('Failed to log error to audit trail', {
        originalError: error,
        logError,
      });
    }
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: SDPError): boolean {
    // Network errors are retryable
    if (error instanceof SDPNetworkError) {
      return true;
    }

    // Rate limit errors are retryable after delay
    if (error instanceof SDPRateLimitError) {
      return true;
    }

    // 5xx errors are generally retryable
    if (error.statusCode >= 500) {
      return true;
    }

    // Specific error codes that are retryable
    const retryableErrorCodes = [
      SDP_ERROR_CODES.SERVICE_UNAVAILABLE,
      SDP_ERROR_CODES.MAINTENANCE_MODE,
      'temporarily_unavailable',
    ];

    return retryableErrorCodes.includes(error.code);
  }

  /**
   * Get retry delay for error
   */
  static getRetryDelay(error: SDPError, attempt: number): number {
    // Use retry-after header for rate limit errors
    if (error instanceof SDPRateLimitError) {
      return error.retryAfter * 1000; // Convert to milliseconds
    }

    // Exponential backoff for other errors
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    
    return Math.round(delay + jitter);
  }
}