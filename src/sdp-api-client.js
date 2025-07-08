/**
 * Service Desk Plus API Client
 * Handles all API interactions with proper error handling
 */

const axios = require('axios');
const { SDPOAuthClient } = require('./sdp-oauth-client.js');

class SDPAPIClient {
  constructor(config = {}) {
    // Use the correct portal configuration
    this.portalName = config.portalName || process.env.SDP_PORTAL_NAME || 'kaltentech';
    this.dataCenter = config.dataCenter || process.env.SDP_DATA_CENTER || 'US';
    this.customDomain = config.customDomain || process.env.SDP_BASE_URL || 'https://helpdesk.pttg.com';
    this.instanceName = config.instanceName || process.env.SDP_INSTANCE_NAME || 'itdesk';
    
    // Initialize OAuth client
    this.oauth = new SDPOAuthClient(config);
    
    // API base URLs by data center
    this.apiEndpoints = {
      US: 'https://sdpondemand.manageengine.com',
      EU: 'https://sdpondemand.manageengine.eu',
      IN: 'https://sdpondemand.manageengine.in',
      AU: 'https://sdpondemand.manageengine.com.au',
      JP: 'https://sdpondemand.manageengine.jp',
      UK: 'https://sdpondemand.manageengine.uk',
      CA: 'https://sdpondemand.manageengine.ca',
      CN: 'https://sdpondemand.manageengine.cn'
    };
    
    // Create axios instance - use custom domain if available
    const baseURL = this.customDomain 
      ? `${this.customDomain}/app/${this.instanceName}/api/v3`
      : `${this.getAPIEndpoint()}/app/${this.portalName}/api/v3`;
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    
    // Add request interceptor for auth
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.oauth.getAccessToken();
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh and retry
          console.error('Got 401, attempting token refresh...');
          await this.oauth.refreshAccessToken();
          
          // Retry the original request
          const originalRequest = error.config;
          const token = await this.oauth.getAccessToken();
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return this.client(originalRequest);
        }
        
        return Promise.reject(this.formatError(error));
      }
    );
  }
  
  /**
   * Get API endpoint for the configured data center
   */
  getAPIEndpoint() {
    return this.apiEndpoints[this.dataCenter] || this.apiEndpoints.US;
  }
  
  /**
   * Format API errors for better handling
   */
  formatError(error) {
    if (error.response) {
      const { status, data } = error.response;
      return {
        code: status,
        message: data.response_status?.messages?.[0]?.message || data.message || 'API Error',
        details: data
      };
    }
    return {
      code: 'NETWORK_ERROR',
      message: error.message,
      details: error
    };
  }
  
  /**
   * List requests with filters
   */
  async listRequests(options = {}) {
    const { limit = 10, offset = 0, status, priority, sortBy = 'created_time', sortOrder = 'desc' } = options;
    
    const listInfo = {
      row_count: limit,
      start_index: offset,
      sort_field: sortBy,
      sort_order: sortOrder
    };
    
    // Add filters if provided
    if (status || priority) {
      listInfo.search_fields = {};
      if (status) listInfo.search_fields.status = { name: status };
      if (priority) listInfo.search_fields.priority = { name: priority };
    }
    
    const params = {
      input_data: JSON.stringify({ list_info: listInfo })
    };
    
    const response = await this.client.get('/requests', { params });
    return {
      requests: response.data.requests || [],
      total_count: response.data.list_info?.total_count || 0,
      has_more: response.data.list_info?.has_more_rows || false
    };
  }
  
  /**
   * Get request details
   */
  async getRequest(requestId) {
    const response = await this.client.get(`/requests/${requestId}`);
    return response.data.request;
  }
  
  /**
   * Create a new request
   */
  async createRequest(requestData) {
    const { subject, description, priority = 'medium', category, requester_email } = requestData;
    
    const request = {
      subject,
      description,
      priority: { name: priority }
    };
    
    if (category) request.category = { name: category };
    if (requester_email) request.requester = { email_id: requester_email };
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.post('/requests', null, { params });
    return response.data.request;
  }
  
  /**
   * Update a request
   */
  async updateRequest(requestId, updates) {
    const request = {};
    
    // Map common update fields
    if (updates.subject) request.subject = updates.subject;
    if (updates.description) request.description = updates.description;
    if (updates.status) request.status = { name: updates.status };
    if (updates.priority) request.priority = { name: updates.priority };
    if (updates.category) request.category = { name: updates.category };
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.put(`/requests/${requestId}`, null, { params });
    return response.data.request;
  }
  
  /**
   * Close a request
   */
  async closeRequest(requestId, closeData) {
    const { closure_comments, closure_code = 'Resolved' } = closeData;
    
    const request = {
      status: { name: 'Closed' },
      closure_info: {
        closure_code: { name: closure_code },
        closure_comments
      }
    };
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.put(`/requests/${requestId}`, null, { params });
    return response.data.request;
  }
  
  /**
   * Add a note to a request
   */
  async addNote(requestId, noteContent, isPublic = true) {
    const note = {
      description: noteContent,
      show_to_requester: isPublic
    };
    
    const params = {
      input_data: JSON.stringify({ note })
    };
    
    const response = await this.client.post(`/requests/${requestId}/notes`, null, { params });
    return response.data.note;
  }
  
  /**
   * Search requests
   */
  async searchRequests(query, options = {}) {
    const { limit = 10, offset = 0 } = options;
    
    const listInfo = {
      row_count: limit,
      start_index: offset,
      search_criteria: {
        field: 'subject',
        condition: 'contains',
        value: query
      }
    };
    
    const params = {
      input_data: JSON.stringify({ list_info: listInfo })
    };
    
    const response = await this.client.get('/requests', { params });
    return {
      requests: response.data.requests || [],
      total_count: response.data.list_info?.total_count || 0
    };
  }
}

module.exports = { SDPAPIClient };