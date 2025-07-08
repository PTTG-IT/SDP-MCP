/**
 * Simplified SDP API Client
 * Based on working implementation from src/sdp-api-client-v2.js
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../monitoring/simpleLogging.js';

export interface SimpleSDPClientConfig {
  baseUrl: string;
  instanceName: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  dataCenter?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  api_domain: string;
  token_type: string;
}

export class SDPClient {
  private axios: AxiosInstance;
  private config: SimpleSDPClientConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  
  // Module APIs
  public requests: RequestsAPI;
  public problems: ProblemsAPI;
  public changes: ChangesAPI;
  public projects: ProjectsAPI;
  public assets: AssetsAPI;

  constructor(config: SimpleSDPClientConfig) {
    this.config = {
      ...config,
      dataCenter: config.dataCenter || 'US',
    };

    // Create axios instance with custom domain
    const baseURL = `${config.baseUrl}/app/${config.instanceName}/api/v3`;
    
    this.axios = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.manageengine.sdp.v3+json',
      },
    });

    // Setup interceptors
    this.setupInterceptors();

    // Initialize module APIs
    this.requests = new RequestsAPI(this);
    this.problems = new ProblemsAPI(this);
    this.changes = new ChangesAPI(this);
    this.projects = new ProjectsAPI(this);
    this.assets = new AssetsAPI(this);
  }

  /**
   * Setup axios interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.axios.interceptors.request.use(
      async (config) => {
        const token = await this.getAccessToken();
        config.headers['Authorization'] = `Bearer ${token}`;
        
        logger.debug('SDP API Request', {
          method: config.method,
          url: config.url,
          params: config.params,
        });
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.axios.interceptors.response.use(
      (response) => {
        // Extract the actual data from SDP response format
        if (response.data) {
          return response.data;
        }
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, refresh and retry
          logger.info('Access token expired, refreshing...');
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          
          const token = await this.getAccessToken();
          const originalRequest = error.config;
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          
          return this.axios(originalRequest);
        }

        logger.error('SDP API Error', {
          status: error.response?.status,
          data: error.response?.data,
        });

        throw this.formatError(error);
      }
    );
  }

  /**
   * Get access token (refresh if needed)
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Refresh the token
    const tokenData = await this.refreshAccessToken();
    this.accessToken = tokenData.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;
    
    return this.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<TokenResponse> {
    const oauthUrl = this.getOAuthUrl();
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'SDPOnDemand.requests.ALL SDPOnDemand.problems.ALL SDPOnDemand.changes.ALL SDPOnDemand.projects.ALL SDPOnDemand.assets.ALL',
    });

    try {
      const response = await axios.post(oauthUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      logger.info('Access token refreshed successfully');
      return response.data;
    } catch (error: any) {
      logger.error('Failed to refresh access token', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get OAuth URL based on data center
   */
  private getOAuthUrl(): string {
    const dataCenterUrls: Record<string, string> = {
      US: 'https://accounts.zoho.com/oauth/v2/token',
      EU: 'https://accounts.zoho.eu/oauth/v2/token',
      IN: 'https://accounts.zoho.in/oauth/v2/token',
      CN: 'https://accounts.zoho.com.cn/oauth/v2/token',
      AU: 'https://accounts.zoho.com.au/oauth/v2/token',
    };

    return dataCenterUrls[this.config.dataCenter || 'US'] || dataCenterUrls.US;
  }

  /**
   * Format error for consistent error handling
   */
  private formatError(error: any): Error {
    if (error.response?.data?.response_status) {
      const status = error.response.data.response_status;
      const messages = status.messages || [];
      const message = messages.map((m: any) => m.message).join('; ') || 'API Error';
      return new Error(message);
    }
    return error;
  }

  /**
   * Make API request
   */
  public async request(config: any): Promise<any> {
    return this.axios(config);
  }
}

/**
 * Base API class for modules
 */
class BaseAPI {
  constructor(protected client: SDPClient) {}

  protected buildInputData(data: any): string {
    return JSON.stringify(data);
  }
}

/**
 * Requests API
 */
class RequestsAPI extends BaseAPI {
  async list(params?: any): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: '/requests',
      params: params ? { input_data: this.buildInputData(params) } : undefined,
    });
  }

  async get(id: string): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: `/requests/${id}`,
    });
  }

  async create(data: any): Promise<any> {
    return this.client.request({
      method: 'POST',
      url: '/requests',
      params: { input_data: this.buildInputData(data) },
    });
  }

  async update(id: string, data: any): Promise<any> {
    return this.client.request({
      method: 'PUT',
      url: `/requests/${id}`,
      params: { input_data: this.buildInputData(data) },
    });
  }

  async close(id: string, data: any): Promise<any> {
    return this.client.request({
      method: 'POST',
      url: `/requests/${id}/close`,
      params: { input_data: this.buildInputData(data) },
    });
  }

  async delete(id: string): Promise<any> {
    return this.client.request({
      method: 'DELETE',
      url: `/requests/${id}`,
    });
  }
}

/**
 * Problems API
 */
class ProblemsAPI extends BaseAPI {
  async list(params?: any): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: '/problems',
      params: params ? { input_data: this.buildInputData(params) } : undefined,
    });
  }

  async get(id: string): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: `/problems/${id}`,
    });
  }

  async create(data: any): Promise<any> {
    return this.client.request({
      method: 'POST',
      url: '/problems',
      params: { input_data: this.buildInputData(data) },
    });
  }

  async update(id: string, data: any): Promise<any> {
    return this.client.request({
      method: 'PUT',
      url: `/problems/${id}`,
      params: { input_data: this.buildInputData(data) },
    });
  }
}

/**
 * Changes API
 */
class ChangesAPI extends BaseAPI {
  async list(params?: any): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: '/changes',
      params: params ? { input_data: this.buildInputData(params) } : undefined,
    });
  }

  async get(id: string): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: `/changes/${id}`,
    });
  }

  async create(data: any): Promise<any> {
    return this.client.request({
      method: 'POST',
      url: '/changes',
      params: { input_data: this.buildInputData(data) },
    });
  }

  async update(id: string, data: any): Promise<any> {
    return this.client.request({
      method: 'PUT',
      url: `/changes/${id}`,
      params: { input_data: this.buildInputData(data) },
    });
  }
}

/**
 * Projects API
 */
class ProjectsAPI extends BaseAPI {
  async list(params?: any): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: '/projects',
      params: params ? { input_data: this.buildInputData(params) } : undefined,
    });
  }

  async get(id: string): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: `/projects/${id}`,
    });
  }

  async create(data: any): Promise<any> {
    return this.client.request({
      method: 'POST',
      url: '/projects',
      params: { input_data: this.buildInputData(data) },
    });
  }

  async update(id: string, data: any): Promise<any> {
    return this.client.request({
      method: 'PUT',
      url: `/projects/${id}`,
      params: { input_data: this.buildInputData(data) },
    });
  }
}

/**
 * Assets API
 */
class AssetsAPI extends BaseAPI {
  async list(params?: any): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: '/assets',
      params: params ? { input_data: this.buildInputData(params) } : undefined,
    });
  }

  async get(id: string): Promise<any> {
    return this.client.request({
      method: 'GET',
      url: `/assets/${id}`,
    });
  }

  async create(data: any): Promise<any> {
    return this.client.request({
      method: 'POST',
      url: '/assets',
      params: { input_data: this.buildInputData(data) },
    });
  }

  async update(id: string, data: any): Promise<any> {
    return this.client.request({
      method: 'PUT',
      url: `/assets/${id}`,
      params: { input_data: this.buildInputData(data) },
    });
  }
}