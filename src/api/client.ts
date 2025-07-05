import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { AuthManager } from './auth.js';
import { RequestsAPI } from './modules/requests.js';
import { AssetsAPI } from './modules/assets.js';
import { ProblemsAPI } from './modules/problems.js';
import { ChangesAPI } from './modules/changes.js';
import { RequestersAPI } from './modules/requesters.js';
import { TechniciansAPI } from './modules/technicians.js';
import { ProjectsAPI } from './modules/projects.js';
import { LookupsAPI } from './modules/lookups.js';
import { TemplatesAPI } from './modules/templates.js';
import { SDPError, SDPAuthError, SDPRateLimitError, SDPValidationError } from '../utils/errors.js';
import { RateLimiter } from '../utils/rateLimit.js';
import { addAuditInterceptors } from './interceptors.js';

export interface SDPClientConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  instanceName: string;
  apiVersion?: string;
  rateLimitPerMinute?: number;
}

export class SDPClient {
  private axiosInstance: AxiosInstance;
  private authManager: AuthManager;
  private rateLimiter: RateLimiter;
  
  // API Modules
  public requests: RequestsAPI;
  public assets: AssetsAPI;
  public problems: ProblemsAPI;
  public changes: ChangesAPI;
  public requesters: RequestersAPI;
  public technicians: TechniciansAPI;
  public projects: ProjectsAPI;
  public lookups: LookupsAPI;
  public templates: TemplatesAPI;

  constructor(config: SDPClientConfig) {
    const apiVersion = config.apiVersion || 'v3';
    const baseURL = `${config.baseUrl}/app/${config.instanceName}/api/${apiVersion}`;
    
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(config.rateLimitPerMinute || 60);
    
    // Initialize auth manager
    this.authManager = new AuthManager({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      baseUrl: config.baseUrl,
      instanceName: config.instanceName,
    });
    
    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'Accept': 'application/vnd.manageengine.sdp.v3+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    // Add instance name to axios config for audit logging
    (this.axiosInstance.defaults as any).instanceName = config.instanceName;
    
    // Add audit logging interceptors
    addAuditInterceptors(this.axiosInstance);
    
    // Request interceptor to add auth token and handle rate limiting
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Apply rate limiting
        await this.rateLimiter.acquire();
        
        // Add auth token
        const token = await this.authManager.getAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response) {
          const { status, data } = error.response;
          
          switch (status) {
            case 401:
              // Check if we already tried to refresh for this request
              const originalRequest: any = error.config;
              if (originalRequest && originalRequest._retry) {
                console.error('Authentication failed after retry, not attempting again');
                throw new SDPAuthError('Authentication failed. Please check your credentials.');
              }
              
              // Mark this request as having attempted refresh
              if (originalRequest) {
                originalRequest._retry = true;
              }
              
              // Try to refresh token
              try {
                console.log('Got 401, attempting token refresh...');
                await this.authManager.forceRefresh();
                // Retry the original request with new token
                if (originalRequest) {
                  const newToken = await this.authManager.getAccessToken();
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  return this.axiosInstance.request(originalRequest);
                }
              } catch (refreshError) {
                console.error('Token refresh failed during 401 handling:', refreshError);
                throw new SDPAuthError(`Authentication failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
              }
              break;
              
            case 429: {
              const retryAfter = error.response.headers['retry-after'];
              throw new SDPRateLimitError(
                `Rate limit exceeded. Retry after ${retryAfter || 'unknown'} seconds.`,
                retryAfter ? parseInt(retryAfter) : undefined
              );
            }
              
            case 400:
            case 422:
              throw new SDPValidationError(
                'Validation error',
                data as any
              );
              
            default:
              throw new SDPError(
                `API error: ${(data as any)?.message || error.message}`,
                status.toString()
              );
          }
        }
        
        throw new SDPError('Network error: ' + error.message);
      }
    );
    
    // Initialize API modules
    this.requests = new RequestsAPI(this.axiosInstance);
    this.assets = new AssetsAPI(this.axiosInstance);
    this.problems = new ProblemsAPI(this.axiosInstance);
    this.changes = new ChangesAPI(this.axiosInstance);
    this.requesters = new RequestersAPI(this.axiosInstance);
    this.technicians = new TechniciansAPI(this.axiosInstance);
    this.projects = new ProjectsAPI(this.axiosInstance);
    this.lookups = new LookupsAPI(this.axiosInstance);
    this.templates = new TemplatesAPI(this.axiosInstance);
  }
  
  /**
   * Make a custom API request
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.request<T>(config);
    return response.data;
  }
}