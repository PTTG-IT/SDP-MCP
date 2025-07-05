import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { AuthManager } from './auth.js';
import { RequestsAPI } from './modules/requests.js';
import { AssetsAPI } from './modules/assets.js';
import { ProblemsAPI } from './modules/problems.js';
import { ChangesAPI } from './modules/changes.js';
import { UsersAPI } from './modules/users.js';
import { ProjectsAPI } from './modules/projects.js';
import { LookupsAPI } from './modules/lookups.js';
import { SDPError, SDPAuthError, SDPRateLimitError, SDPValidationError } from '../utils/errors.js';
import { RateLimiter } from '../utils/rateLimit.js';

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
  public users: UsersAPI;
  public projects: ProjectsAPI;
  public lookups: LookupsAPI;

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
              // Try to refresh token
              try {
                await this.authManager.forceRefresh();
                // Retry the original request
                const originalRequest = error.config;
                if (originalRequest) {
                  return this.axiosInstance.request(originalRequest);
                }
              } catch (refreshError) {
                throw new SDPAuthError('Authentication failed. Please check your credentials.');
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
    this.users = new UsersAPI(this.axiosInstance);
    this.projects = new ProjectsAPI(this.axiosInstance);
    this.lookups = new LookupsAPI(this.axiosInstance);
  }
  
  /**
   * Make a custom API request
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.request<T>(config);
    return response.data;
  }
}