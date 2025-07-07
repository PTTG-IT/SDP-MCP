import { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../monitoring/logging.js';
import { getCurrentTenantId } from '../tenants/context.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request metadata attached to axios config
 */
export interface RequestMetadata {
  requestId: string;
  tenantId: string;
  startTime: number;
  endpoint: string;
  method: string;
  retryCount?: number;
}

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: RequestMetadata;
  }
}

/**
 * Create request logging interceptor
 */
export function createRequestLoggingInterceptor() {
  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const requestId = uuidv4();
    const tenantId = getCurrentTenantId() || 'system';
    
    // Attach metadata
    config.metadata = {
      requestId,
      tenantId,
      startTime: Date.now(),
      endpoint: config.url || '',
      method: config.method?.toUpperCase() || 'UNKNOWN',
      retryCount: config.metadata?.retryCount || 0,
    };

    // Log request details (excluding sensitive data)
    logger.info('Outgoing SDP API request', {
      requestId,
      tenantId,
      method: config.method,
      url: config.url,
      params: config.params,
      retryCount: config.metadata.retryCount,
    });

    // Add request ID header for tracing
    config.headers['X-Request-ID'] = requestId;
    config.headers['X-Tenant-ID'] = tenantId;

    return config;
  };
}

/**
 * Create response logging interceptor
 */
export function createResponseLoggingInterceptor() {
  return (response: AxiosResponse): AxiosResponse => {
    const metadata = response.config.metadata;
    if (!metadata) {
      return response;
    }

    const duration = Date.now() - metadata.startTime;

    // Log response details
    logger.info('SDP API response received', {
      requestId: metadata.requestId,
      tenantId: metadata.tenantId,
      method: metadata.method,
      url: response.config.url,
      statusCode: response.status,
      duration,
      retryCount: metadata.retryCount,
    });

    // Add performance metrics
    if (duration > 5000) {
      logger.warn('Slow API response', {
        requestId: metadata.requestId,
        duration,
        endpoint: metadata.endpoint,
      });
    }

    return response;
  };
}

/**
 * Create error logging interceptor
 */
export function createErrorLoggingInterceptor() {
  return (error: any): Promise<any> => {
    const metadata = error.config?.metadata;
    const duration = metadata ? Date.now() - metadata.startTime : 0;

    // Extract error details
    const errorDetails = {
      requestId: metadata?.requestId,
      tenantId: metadata?.tenantId,
      method: metadata?.method,
      url: error.config?.url,
      statusCode: error.response?.status,
      duration,
      retryCount: metadata?.retryCount || 0,
      errorCode: error.code,
      errorMessage: error.message,
      responseData: error.response?.data,
    };

    // Log error with appropriate level
    if (error.response?.status >= 500) {
      logger.error('SDP API server error', errorDetails);
    } else if (error.response?.status === 429) {
      logger.warn('SDP API rate limit error', errorDetails);
    } else if (error.response?.status >= 400) {
      logger.warn('SDP API client error', errorDetails);
    } else {
      logger.error('SDP API network error', errorDetails);
    }

    return Promise.reject(error);
  };
}

/**
 * Create retry interceptor
 */
export function createRetryInterceptor(maxRetries: number = 3) {
  return async (error: any): Promise<any> => {
    const config = error.config;
    if (!config || !config.metadata) {
      return Promise.reject(error);
    }

    const metadata = config.metadata;
    const retryCount = metadata.retryCount || 0;

    // Check if we should retry
    if (retryCount >= maxRetries) {
      logger.error('Max retries exceeded', {
        requestId: metadata.requestId,
        retryCount,
        maxRetries,
      });
      return Promise.reject(error);
    }

    // Check if error is retryable
    const isRetryable = 
      !error.response || // Network error
      error.response.status >= 500 || // Server error
      error.response.status === 429 || // Rate limit
      error.response.status === 408; // Timeout

    if (!isRetryable) {
      return Promise.reject(error);
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    
    logger.info('Retrying request', {
      requestId: metadata.requestId,
      retryCount: retryCount + 1,
      delay,
      error: error.message,
    });

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));

    // Update retry count
    config.metadata.retryCount = retryCount + 1;

    // Retry the request
    return error.config.axios(config);
  };
}

/**
 * Create performance monitoring interceptor
 */
export function createPerformanceInterceptor() {
  const slowRequestThreshold = 3000; // 3 seconds
  const criticalRequestThreshold = 10000; // 10 seconds

  return {
    request: (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      // Mark request start time with high precision
      if (config.metadata) {
        config.metadata.startTime = performance.now();
      }
      return config;
    },
    
    response: (response: AxiosResponse): AxiosResponse => {
      const metadata = response.config.metadata;
      if (!metadata) {
        return response;
      }

      const duration = performance.now() - metadata.startTime;
      
      // Log performance metrics
      const perfData = {
        requestId: metadata.requestId,
        tenantId: metadata.tenantId,
        endpoint: metadata.endpoint,
        method: metadata.method,
        duration: Math.round(duration),
        statusCode: response.status,
      };

      if (duration > criticalRequestThreshold) {
        logger.error('Critical: Very slow API response', perfData);
      } else if (duration > slowRequestThreshold) {
        logger.warn('Warning: Slow API response', perfData);
      }

      // Add performance headers to response
      response.headers['X-Response-Time'] = duration.toString();
      
      return response;
    },
  };
}

/**
 * Create tenant context validation interceptor
 */
export function createTenantValidationInterceptor() {
  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const tenantId = getCurrentTenantId();
    
    if (!tenantId) {
      const error = new Error('No tenant context available');
      logger.error('Request without tenant context', {
        url: config.url,
        method: config.method,
      });
      throw error;
    }

    // Ensure tenant ID is in headers
    config.headers['X-Tenant-ID'] = tenantId;
    
    return config;
  };
}

/**
 * Create request sanitization interceptor
 */
export function createSanitizationInterceptor() {
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'api_key',
    'access_token',
    'refresh_token',
  ];

  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Sanitize headers
    const sanitizedHeaders = { ...config.headers };
    for (const field of sensitiveFields) {
      if (sanitizedHeaders[field]) {
        sanitizedHeaders[field] = '[REDACTED]';
      }
    }

    // Log sanitized request
    logger.debug('Sanitized request config', {
      method: config.method,
      url: config.url,
      headers: sanitizedHeaders,
      params: config.params,
    });

    return config;
  };
}

/**
 * Create response transformation interceptor
 */
export function createResponseTransformInterceptor() {
  return (response: AxiosResponse): AxiosResponse => {
    // Handle empty responses
    if (!response.data) {
      response.data = {};
    }

    // Ensure consistent response format
    if (typeof response.data === 'string') {
      try {
        response.data = JSON.parse(response.data);
      } catch (error) {
        logger.warn('Failed to parse response as JSON', {
          requestId: response.config.metadata?.requestId,
          responseData: response.data.substring(0, 100),
        });
      }
    }

    // Add response metadata
    if (response.config.metadata) {
      response.data._metadata = {
        requestId: response.config.metadata.requestId,
        duration: Date.now() - response.config.metadata.startTime,
        cached: false,
      };
    }

    return response;
  };
}

/**
 * Create comprehensive interceptor chain
 */
export function createInterceptorChain() {
  return {
    request: [
      createTenantValidationInterceptor(),
      createRequestLoggingInterceptor(),
      createSanitizationInterceptor(),
    ],
    response: {
      success: [
        createResponseLoggingInterceptor(),
        createResponseTransformInterceptor(),
      ],
      error: [
        createErrorLoggingInterceptor(),
        createRetryInterceptor(),
      ],
    },
  };
}