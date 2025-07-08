/**
 * Enhanced Service Desk Plus API Client
 * Fixed for proper API field names and better error handling
 */

const axios = require('axios');
const { SDPOAuthClient } = require('./sdp-oauth-client.cjs');

class SDPAPIClientEnhanced {
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
        console.error(`API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
        if (config.params?.input_data) {
          console.error('Request payload:', config.params.input_data);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.error(`API Response: ${response.status} ${response.statusText}`);
        return response;
      },
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
        
        // Log detailed error information
        if (error.response) {
          console.error('API Error Response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: JSON.stringify(error.response.data, null, 2)
          });
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
      
      // Handle specific SDP error formats
      if (data.response_status) {
        const messages = data.response_status.messages || [];
        const message = messages.map(m => m.message).join('; ') || 'API Error';
        return {
          code: data.response_status.status_code || status,
          message,
          details: data,
          statusCode: data.response_status.status_code
        };
      }
      
      return {
        code: status,
        message: data.message || 'API Error',
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
   * Create a new request with proper field validation
   */
  async createRequest(requestData) {
    const { subject, description, priority = 'medium', category, requester_email, requester_name } = requestData;
    
    // Validate required fields
    if (!subject) {
      throw new Error('Subject is required for creating a request');
    }
    
    const request = {
      subject,
      description: description || ''
    };
    
    // Add optional fields only if provided
    if (priority) {
      request.priority = { name: priority };
    }
    
    if (category) {
      request.category = { name: category };
    }
    
    // Handle requester - SDP expects specific format
    if (requester_email || requester_name) {
      request.requester = {};
      if (requester_email) request.requester.email_id = requester_email;
      if (requester_name) request.requester.name = requester_name;
    }
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    try {
      const response = await this.client.post('/requests', null, { params });
      return response.data.request;
    } catch (error) {
      // Provide more helpful error messages
      if (error.statusCode === 4000) {
        throw new Error(`Failed to create request: ${error.message}. Check if all required fields are provided and category/priority values are valid.`);
      }
      throw error;
    }
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
        closure_comments: closure_comments || 'Request closed'
      }
    };
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.put(`/requests/${requestId}`, null, { params });
    return response.data.request;
  }
  
  /**
   * Add a note to a request - Fixed for proper API format
   */
  async addNote(requestId, noteContent, isPublic = true) {
    // SDP API expects 'request_note' not 'note'
    const request_note = {
      note_text: noteContent,  // Changed from 'description' to 'note_text'
      show_to_requester: isPublic
    };
    
    const params = {
      input_data: JSON.stringify({ request_note })
    };
    
    try {
      const response = await this.client.post(`/requests/${requestId}/notes`, null, { params });
      return response.data.note || response.data.request_note;
    } catch (error) {
      // If that doesn't work, try the alternate format
      if (error.statusCode === 4000 && error.message.includes('EXTRA_KEY_FOUND')) {
        console.error('Trying alternate note format...');
        
        // Try with just 'note' object
        const note = {
          description: noteContent,
          show_to_requester: isPublic
        };
        
        const altParams = {
          input_data: JSON.stringify({ note })
        };
        
        const response = await this.client.post(`/requests/${requestId}/notes`, null, { params: altParams });
        return response.data.note;
      }
      throw error;
    }
  }
  
  /**
   * Search requests
   */
  async searchRequests(query, options = {}) {
    const { limit = 10, offset = 0 } = options;
    
    const listInfo = {
      row_count: limit,
      start_index: offset,
      search_criteria: [
        {
          field: 'subject',
          condition: 'contains',
          value: query
        }
      ]
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

module.exports = { SDPAPIClientEnhanced };