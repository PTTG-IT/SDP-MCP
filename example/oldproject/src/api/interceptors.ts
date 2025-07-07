import { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { auditLogger } from '../db/auditLog.js';
import { dbFeatures } from '../db/config.js';

/**
 * Add audit logging interceptors to an axios instance
 */
export function addAuditInterceptors(axiosInstance: AxiosInstance): void {
  if (!dbFeatures.useAuditLog) {
    return;
  }
  
  // Request interceptor
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Add request start time for duration calculation
      (config as any)._startTime = Date.now();
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  
  // Response interceptor
  axiosInstance.interceptors.response.use(
    async (response: AxiosResponse) => {
      await logApiCall(response.config, response);
      return response;
    },
    async (error) => {
      if (error.config && error.response) {
        await logApiCall(error.config, error.response, error.message);
      }
      return Promise.reject(error);
    }
  );
}

/**
 * Log an API call to the audit log
 */
async function logApiCall(
  config: InternalAxiosRequestConfig,
  response: AxiosResponse,
  errorMessage?: string
): Promise<void> {
  try {
    const startTime = (config as any)._startTime || Date.now();
    const duration = Date.now() - startTime;
    
    // Extract endpoint from URL
    const url = new URL(config.url!, config.baseURL);
    const endpoint = url.pathname;
    
    // Prepare request data (remove sensitive info)
    const requestData = {
      params: config.params,
      body: config.data,
      headers: sanitizeHeaders(config.headers)
    };
    
    // Prepare response data (limit size and ensure valid JSON)
    let responseData = null;
    if (response.data) {
      const fullData = JSON.stringify(response.data);
      if (fullData.length > 10000) {
        // Truncate arrays if present
        if (Array.isArray(response.data)) {
          responseData = JSON.stringify(response.data.slice(0, 5));
        } else if (response.data.requests) {
          responseData = JSON.stringify({
            ...response.data,
            requests: response.data.requests.slice(0, 5),
            truncated: true
          });
        } else if (response.data.projects) {
          responseData = JSON.stringify({
            ...response.data,
            projects: response.data.projects.slice(0, 5),
            truncated: true
          });
        } else {
          // For other large objects, just log metadata
          responseData = JSON.stringify({
            type: typeof response.data,
            size: fullData.length,
            truncated: true
          });
        }
      } else {
        responseData = fullData;
      }
    }
    
    await auditLogger.logApiCall({
      endpoint,
      method: config.method?.toUpperCase() || 'GET',
      requestData,
      responseData: responseData ? JSON.parse(responseData) : null,
      statusCode: response.status,
      errorMessage,
      durationMs: duration,
      userContext: {
        instanceName: (config as any).instanceName || 'unknown'
      }
    });
  } catch (error) {
    // Don't let audit logging failures break the application
    console.error('Failed to log API call:', error);
  }
}

/**
 * Remove sensitive headers from logging
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  
  // Remove authorization header
  delete sanitized.authorization;
  delete sanitized.Authorization;
  
  // Remove any other sensitive headers
  delete sanitized.cookie;
  delete sanitized.Cookie;
  
  return sanitized;
}