import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { TokenManager } from '../auth/tokenManager.js';
import { getCurrentTenantId } from '../tenants/context.js';
import { TenantManager } from '../tenants/manager.js';
import { CircuitBreaker } from '../utils/circuitBreaker.js';
import { RateLimiter } from '../middleware/rateLimiter.js';
import { CacheManager, CACHE_CONFIGS } from '../utils/cache.js';
import { withBackoff, TenantRetryPolicies } from '../utils/backoff.js';
import { logger } from '../monitoring/logging.js';
import { auditLogger } from '../monitoring/auditLogger.js';
import { parseSDPError, SDPError, isRetryableError } from '../utils/errors.js';
import type { Tenant } from '../tenants/models/tenant.js';

/**
 * SDP API client configuration
 */
export interface SDPClientConfig {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
  enableCache?: boolean;
  enableCircuitBreaker?: boolean;
}

/**
 * SDP API response format
 */
export interface SDPResponse<T = any> {
  response_status: {
    status_code: number;
    status: 'success' | 'failure';
    messages?: Array<{
      status_code: number;
      message: string;
      type: string;
    }>;
  };
  [key: string]: T | any;
}

/**
 * Service Desk Plus API Client
 * Handles authentication, rate limiting, circuit breaking, and caching
 */
export class SDPClient {
  private readonly axios: AxiosInstance;
  private readonly tokenManager: TokenManager;
  private readonly tenantManager: TenantManager;
  private readonly rateLimiter: RateLimiter;
  private readonly cacheManager: CacheManager;
  private readonly circuitBreakers: Map<string, CircuitBreaker>;
  private tenant: Tenant | null = null;

  constructor(
    private readonly config: SDPClientConfig,
    tokenManager: TokenManager,
    tenantManager: TenantManager
  ) {
    this.tokenManager = tokenManager;
    this.tenantManager = tenantManager;
    this.rateLimiter = new RateLimiter();
    this.cacheManager = new CacheManager();
    this.circuitBreakers = new Map();

    // Create axios instance
    this.axios = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Accept': 'application/vnd.manageengine.sdp.v3+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Setup interceptors
    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axios.interceptors.request.use(
      async (config) => {
        const startTime = Date.now();
        
        // Get current tenant
        const tenantId = getCurrentTenantId();
        if (!tenantId) {
          throw new SDPError('No tenant context', 'NO_TENANT_CONTEXT', 400);
        }

        // Load tenant if not cached
        if (!this.tenant || this.tenant.id !== tenantId) {
          this.tenant = await this.tenantManager.getTenant(tenantId);
          if (!this.tenant) {
            throw new SDPError('Tenant not found', 'TENANT_NOT_FOUND', 404);
          }
        }

        // Check rate limit
        const endpoint = this.getEndpointKey(config);
        const rateLimitResult = await this.rateLimiter.checkRateLimit(
          `${tenantId}:${endpoint}`,
          this.tenant.rateLimitTier
        );

        if (!rateLimitResult.allowed) {
          throw new SDPError(
            'Rate limit exceeded',
            'RATE_LIMIT_EXCEEDED',
            429,
            {
              retryAfter: rateLimitResult.retryAfter,
              limit: rateLimitResult.limit,
              remaining: rateLimitResult.remaining,
            }
          );
        }

        // Get OAuth token
        const token = await this.tokenManager.getAccessToken(tenantId);
        config.headers.Authorization = `Bearer ${token}`;

        // Add request metadata
        config.metadata = {
          tenantId,
          startTime,
          endpoint,
          method: config.method?.toUpperCase(),
        };

        // Log request
        logger.debug('SDP API request', {
          tenantId,
          method: config.method,
          url: config.url,
          endpoint,
        });

        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      async (response) => {
        const metadata = response.config.metadata;
        const duration = Date.now() - metadata.startTime;

        // Log successful response
        await auditLogger.log({
          tenantId: metadata.tenantId,
          eventType: 'api.request.success',
          eventCategory: 'api',
          actorType: 'system',
          action: `${metadata.method} ${metadata.endpoint}`,
          result: 'success',
          metadata: {
            duration,
            statusCode: response.status,
            endpoint: metadata.endpoint,
          },
        });

        // Check SDP response status
        const sdpResponse = response.data as SDPResponse;
        if (sdpResponse.response_status?.status === 'failure') {
          throw parseSDPError(
            {
              response: {
                status: sdpResponse.response_status.status_code || response.status,
                data: sdpResponse,
              },
            },
            this.getModuleFromEndpoint(metadata.endpoint),
            metadata.method
          );
        }

        return response;
      },
      async (error) => {
        const metadata = error.config?.metadata;
        const duration = metadata ? Date.now() - metadata.startTime : 0;

        // Log error
        if (metadata) {
          await auditLogger.log({
            tenantId: metadata.tenantId,
            eventType: 'api.request.error',
            eventCategory: 'api',
            actorType: 'system',
            action: `${metadata.method} ${metadata.endpoint}`,
            result: 'error',
            errorCode: error.response?.status || error.code,
            errorMessage: error.message,
            metadata: {
              duration,
              statusCode: error.response?.status,
              endpoint: metadata.endpoint,
            },
          });
        }

        // Parse and throw SDP error
        throw parseSDPError(
          error,
          metadata ? this.getModuleFromEndpoint(metadata.endpoint) : undefined,
          metadata?.method
        );
      }
    );
  }

  /**
   * Make a GET request
   */
  async get<T = any>(
    endpoint: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'GET',
      url: endpoint,
    });
  }

  /**
   * Make a POST request
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'POST',
      url: endpoint,
      data: this.formatData(data),
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'PUT',
      url: endpoint,
      data: this.formatData(data),
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(
    endpoint: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    return this.request<T>({
      ...config,
      method: 'DELETE',
      url: endpoint,
    });
  }

  /**
   * Make a request with circuit breaker and retry logic
   */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const endpoint = this.getEndpointKey(config);
    const tenantId = getCurrentTenantId();
    
    if (!tenantId || !this.tenant) {
      throw new SDPError('No tenant context', 'NO_TENANT_CONTEXT', 400);
    }

    // Get or create circuit breaker for this endpoint
    let circuitBreaker = this.circuitBreakers.get(endpoint);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(endpoint);
      this.circuitBreakers.set(endpoint, circuitBreaker);
    }

    // Check if request is cacheable
    if (this.config.enableCache && config.method === 'GET') {
      const cached = await this.cacheManager.get<T>(
        this.getModuleFromEndpoint(endpoint),
        'get',
        { url: config.url, params: config.params },
        CACHE_CONFIGS.READ_OPERATIONS
      );

      if (cached !== null) {
        logger.debug('Returning cached response', { endpoint });
        return cached;
      }
    }

    // Execute request with circuit breaker
    const response = await circuitBreaker.execute<T>(
      async () => {
        // Get retry policy based on tenant tier
        const retryPolicy = TenantRetryPolicies.getPolicy(this.tenant!.rateLimitTier);

        // Execute with retry logic
        return retryPolicy.execute(async () => {
          const result = await this.axios.request<SDPResponse<T>>(config);
          
          // Extract data from SDP response format
          const data = this.extractData<T>(result.data);

          // Cache if enabled
          if (this.config.enableCache && config.method === 'GET') {
            await this.cacheManager.set(
              this.getModuleFromEndpoint(endpoint),
              'get',
              { url: config.url, params: config.params },
              data,
              CACHE_CONFIGS.READ_OPERATIONS
            );
          }

          return data;
        });
      },
      // Fallback function
      async () => {
        throw new SDPError(
          'Circuit breaker open for endpoint',
          'CIRCUIT_BREAKER_OPEN',
          503,
          { endpoint }
        );
      }
    );

    return response;
  }

  /**
   * Format data for SDP API
   */
  private formatData(data: any): string {
    if (!data) {
      return '';
    }

    // SDP expects form-encoded data with input_data parameter
    const inputData = {
      input_data: JSON.stringify(data),
    };

    return new URLSearchParams(inputData).toString();
  }

  /**
   * Extract data from SDP response format
   */
  private extractData<T>(response: SDPResponse<T>): T {
    // Remove response_status and extract actual data
    const { response_status, ...data } = response;

    // Handle different response formats
    if ('request' in data) {
      return data.request as T;
    } else if ('requests' in data) {
      return data.requests as T;
    } else if ('problem' in data) {
      return data.problem as T;
    } else if ('problems' in data) {
      return data.problems as T;
    } else if ('change' in data) {
      return data.change as T;
    } else if ('changes' in data) {
      return data.changes as T;
    } else if ('project' in data) {
      return data.project as T;
    } else if ('projects' in data) {
      return data.projects as T;
    } else if ('asset' in data) {
      return data.asset as T;
    } else if ('assets' in data) {
      return data.assets as T;
    }

    // Return the whole data object if no specific format matched
    return data as T;
  }

  /**
   * Get endpoint key for rate limiting and circuit breaking
   */
  private getEndpointKey(config: AxiosRequestConfig): string {
    const url = config.url || '';
    const method = config.method || 'GET';
    
    // Extract the main resource from URL
    const match = url.match(/\/api\/v3\/(\w+)/);
    const resource = match ? match[1] : 'unknown';
    
    return `${method}:${resource}`;
  }

  /**
   * Get module name from endpoint
   */
  private getModuleFromEndpoint(endpoint: string): string {
    const parts = endpoint.split(':');
    return parts[1] || 'unknown';
  }

  /**
   * Invalidate cache for a specific module
   */
  async invalidateCache(module: string, operation?: string): Promise<void> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      return;
    }

    await this.cacheManager.invalidate({
      module,
      operation,
      tenantId,
    });
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Map<string, string> {
    const status = new Map<string, string>();
    
    for (const [endpoint, breaker] of this.circuitBreakers) {
      status.set(endpoint, breaker.getState());
    }
    
    return status;
  }

  /**
   * Reset circuit breaker for an endpoint
   */
  resetCircuitBreaker(endpoint: string): void {
    const breaker = this.circuitBreakers.get(endpoint);
    if (breaker) {
      breaker.reset();
    }
  }
}

/**
 * Create SDP client factory
 */
export function createSDPClientFactory(
  tokenManager: TokenManager,
  tenantManager: TenantManager
) {
  const clients = new Map<string, SDPClient>();

  return {
    /**
     * Get or create client for a data center
     */
    getClient(dataCenter: string): SDPClient {
      let client = clients.get(dataCenter);
      
      if (!client) {
        const baseURL = this.getBaseURL(dataCenter);
        client = new SDPClient(
          {
            baseURL,
            timeout: 30000,
            enableCache: true,
            enableCircuitBreaker: true,
          },
          tokenManager,
          tenantManager
        );
        clients.set(dataCenter, client);
      }
      
      return client;
    },

    /**
     * Get base URL for data center
     */
    getBaseURL(dataCenter: string): string {
      const dataCenterURLs: Record<string, string> = {
        US: 'https://sdpondemand.manageengine.com',
        EU: 'https://sdpondemand.manageengine.eu',
        IN: 'https://sdpondemand.manageengine.in',
        CN: 'https://sdpondemand.manageengine.cn',
        AU: 'https://sdpondemand.manageengine.com.au',
      };

      const url = dataCenterURLs[dataCenter.toUpperCase()];
      if (!url) {
        throw new SDPError(
          `Unknown data center: ${dataCenter}`,
          'INVALID_DATA_CENTER',
          400
        );
      }

      return url;
    },
  };
}