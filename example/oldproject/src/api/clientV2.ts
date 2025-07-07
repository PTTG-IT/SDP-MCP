import axios, { AxiosInstance, AxiosError } from 'axios';
import { SDPConfig } from './types.js';
import { AuthManagerV2 } from './authV2.js';
import { RequestsAPI } from './modules/requests.js';
import { AssetsAPI } from './modules/assets.js';
import { RequestersAPI } from './modules/users.js';
import { ProblemsAPI } from './modules/problems.js';
import { ChangesAPI } from './modules/changes.js';
import { ProjectsAPI } from './modules/projects.js';
import { LookupsAPI } from './modules/lookups.js';
import { addAuditInterceptors } from '../db/auditLog.js';
import { SDPError, SDPAuthError, SDPValidationError, SDPRateLimitError } from '../utils/errors.js';
import { TimeTrackedRateLimiter } from '../utils/timeTrackedRateLimit.js';
import { RateLimitCoordinator } from './rateLimitCoordinator.js';

/**
 * Service Desk Plus Cloud API Client V2
 * 
 * Key differences from V1:
 * - No automatic token refresh on 401
 * - Uses RateLimitCoordinator for rate limiting
 * - Token refresh handled by background TokenManager
 */
export class SDPClientV2 {
  private axiosInstance: AxiosInstance;
  private authManager: AuthManagerV2;
  private rateLimiter: TimeTrackedRateLimiter;
  private rateLimitCoordinator: RateLimitCoordinator;
  
  // API modules
  public requests: RequestsAPI;
  public assets: AssetsAPI;
  public users: RequestersAPI;
  public problems: ProblemsAPI;
  public changes: ChangesAPI;
  public projects: ProjectsAPI;
  public lookups: LookupsAPI;

  constructor(config: SDPConfig) {
    // Validate required config
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Client ID and Client Secret are required');
    }
    
    // Construct base URL
    const baseURL = config.baseUrl || `https://sdpondemand.manageengine.com/app/${config.instanceName}/api/v3`;
    
    // Initialize auth manager
    this.authManager = new AuthManagerV2({
      authCode: config.authCode,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      baseUrl: config.baseUrl,
      instanceName: config.instanceName,
    });
    
    // Initialize rate limit coordinator
    this.rateLimitCoordinator = RateLimitCoordinator.getInstance();
    
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
        // Check API rate limit
        if (!this.rateLimitCoordinator.canMakeApiRequest()) {
          throw new SDPRateLimitError('API rate limit exceeded. Please wait before making more requests.');
        }
        
        // Apply legacy rate limiting (will be removed in future)
        await this.rateLimiter.acquire();
        
        // Record API request
        this.rateLimitCoordinator.recordApiRequest();
        
        // Get auth token (without refresh)
        try {
          const token = await this.authManager.getAccessToken();
          config.headers.Authorization = `Zoho-oauthtoken ${token}`;
        } catch (error) {
          // If no token available, throw auth error
          throw new SDPAuthError('No valid access token available. Waiting for background refresh.');
        }
        
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
              // Do NOT attempt token refresh
              // Let the background TokenManager handle it
              throw new SDPAuthError(
                'Authentication failed. Access token may be expired. ' +
                'Background token refresh will handle this automatically.'
              );
              
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
    
    // Initialize rate limiter with configurable limits
    const requestsPerMinute = parseInt(process.env.SDP_RATE_LIMIT || '60');
    this.rateLimiter = new TimeTrackedRateLimiter(requestsPerMinute, 60000);
    
    // Initialize API modules
    this.requests = new RequestsAPI(this.axiosInstance);
    this.assets = new AssetsAPI(this.axiosInstance);
    this.users = new RequestersAPI(this.axiosInstance);
    this.problems = new ProblemsAPI(this.axiosInstance);
    this.changes = new ChangesAPI(this.axiosInstance);
    this.projects = new ProjectsAPI(this.axiosInstance);
    this.lookups = new LookupsAPI(this.axiosInstance);
  }

  /**
   * Initialize authentication
   * Should be called once during startup
   */
  async initialize(): Promise<void> {
    await this.authManager.authenticate();
  }
  
  /**
   * Check if client has valid authentication
   */
  isAuthenticated(): boolean {
    return this.authManager.isTokenValid();
  }
  
  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return this.rateLimitCoordinator.getStatus();
  }
  
  /**
   * Get time until next allowed token refresh
   */
  getTimeUntilTokenRefresh(): number {
    return this.rateLimitCoordinator.getTimeUntilNextRefresh();
  }
}