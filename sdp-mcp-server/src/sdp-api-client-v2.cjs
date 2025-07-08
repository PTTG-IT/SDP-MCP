/**
 * Service Desk Plus API Client v2
 * Uses proper IDs for priorities, statuses, and categories
 */

const axios = require('axios');
const { SDPOAuthClient } = require('./sdp-oauth-client.cjs');
const { SDPMetadataClient } = require('./sdp-api-metadata.cjs');

class SDPAPIClientV2 {
  constructor(config = {}) {
    // Configuration
    this.portalName = config.portalName || process.env.SDP_PORTAL_NAME || 'kaltentech';
    this.dataCenter = config.dataCenter || process.env.SDP_DATA_CENTER || 'US';
    this.customDomain = config.customDomain || process.env.SDP_BASE_URL || 'https://helpdesk.pttg.com';
    this.instanceName = config.instanceName || process.env.SDP_INSTANCE_NAME || 'itdesk';
    
    // Initialize clients
    this.oauth = new SDPOAuthClient(config);
    this.metadata = new SDPMetadataClient(config);
    
    // Create axios instance
    const baseURL = this.customDomain 
      ? `${this.customDomain}/app/${this.instanceName}/api/v3`
      : `https://sdpondemand.manageengine.com/app/${this.portalName}/api/v3`;
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    
    // Auth interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.oauth.getAccessToken();
        config.headers['Authorization'] = `Bearer ${token}`;
        console.error(`API Request: ${config.method.toUpperCase()} ${config.url}`);
        if (config.params?.input_data) {
          console.error('Payload:', JSON.parse(config.params.input_data));
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.oauth.refreshAccessToken();
          const originalRequest = error.config;
          const token = await this.oauth.getAccessToken();
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return this.client(originalRequest);
        }
        
        if (error.response) {
          console.error('API Error:', {
            status: error.response.status,
            data: error.response.data
          });
          // Log detailed error messages
          if (error.response.data?.response_status?.messages) {
            error.response.data.response_status.messages.forEach(msg => {
              console.error(`  - ${msg.field || 'General'}: ${msg.message}`);
            });
          }
        }
        
        return Promise.reject(this.formatError(error));
      }
    );
    
    // Initialize metadata on first use
    this.metadataInitialized = false;
  }
  
  /**
   * Ensure metadata is loaded
   */
  async ensureMetadata() {
    if (!this.metadataInitialized) {
      console.error('Loading SDP metadata...');
      await this.metadata.getAllMetadata();
      this.metadataInitialized = true;
      console.error('Metadata loaded successfully');
    }
  }
  
  /**
   * Format errors
   */
  formatError(error) {
    if (error.response?.data?.response_status) {
      const status = error.response.data.response_status;
      const messages = status.messages || [];
      return {
        code: status.status_code,
        message: messages.map(m => m.message).join('; ') || 'API Error',
        details: error.response.data
      };
    }
    
    return {
      code: error.response?.status || 'UNKNOWN',
      message: error.message,
      details: error.response?.data
    };
  }
  
  /**
   * Get metadata
   */
  async getMetadata() {
    await this.ensureMetadata();
    return this.metadata.getAllMetadata();
  }
  
  /**
   * List requests
   */
  async listRequests(options = {}) {
    const { limit = 10, offset = 0, status, priority, sortBy = 'created_time', sortOrder = 'desc' } = options;
    
    await this.ensureMetadata();
    
    const listInfo = {
      row_count: limit,
      start_index: offset,
      sort_field: sortBy,
      sort_order: sortOrder
    };
    
    if (status || priority) {
      listInfo.search_fields = {};
      if (status) {
        const statusId = this.metadata.getStatusId(status);
        listInfo.search_fields.status = { id: statusId };
      }
      if (priority) {
        const priorityId = this.metadata.getPriorityId(priority);
        listInfo.search_fields.priority = { id: priorityId };
      }
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
   * Get request
   */
  async getRequest(requestId) {
    const response = await this.client.get(`/requests/${requestId}`);
    return response.data.request;
  }
  
  /**
   * Create request with proper IDs
   */
  async createRequest(requestData) {
    const { subject, description, priority = 'medium', category, requester_email, requester_name } = requestData;
    
    if (!subject) {
      throw new Error('Subject is required');
    }
    
    await this.ensureMetadata();
    
    const request = {
      subject,
      description: description || '',
      // All required fields based on API error
      mode: { name: 'Web Form' },
      request_type: { name: 'Incident' },
      urgency: { name: '2 - General Concern' },  // Valid urgency
      level: { name: '1 - Frontline' },  // Valid level
      impact: { name: '1 - Affects User' },
      category: { name: 'Software' },  // Default category
      status: { name: 'Open' }
    };
    
    // Use priority - only add if explicitly requested
    if (priority) {
      const priorityId = this.metadata.getPriorityId(priority);
      // Only set if we got a valid ID, not the same string back
      if (priorityId && priorityId !== priority) {
        request.priority = { id: priorityId };
      } else {
        // Try with name format
        request.priority = { name: priority };
        console.error(`Warning: Using priority name "${priority}" instead of ID`);
      }
    }
    // Don't set default priority - let the system decide
    
    // Use category ID
    if (category) {
      const categoryId = this.metadata.getCategoryId(category);
      // Only set if we got a valid ID, not the same string back
      if (categoryId && categoryId !== category) {
        request.category = { id: categoryId };
      } else {
        console.error(`Warning: Could not find category ID for "${category}"`);
        // Use name format as fallback
        request.category = { name: category };
      }
    }
    
    // Add requester
    if (requester_email || requester_name) {
      request.requester = {};
      if (requester_email) request.requester.email_id = requester_email;
      if (requester_name) request.requester.name = requester_name;
    } else {
      // Default requester if none provided
      request.requester = { email_id: 'office365alerts@microsoft.com' };
    }
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.post('/requests', null, { params });
    return response.data.request;
  }
  
  /**
   * Update request with proper IDs
   */
  async updateRequest(requestId, updates) {
    await this.ensureMetadata();
    
    const request = {};
    
    if (updates.subject) request.subject = updates.subject;
    if (updates.description) request.description = updates.description;
    
    if (updates.status) {
      const statusId = this.metadata.getStatusId(updates.status);
      if (statusId && statusId !== updates.status) {
        request.status = { id: statusId };
      } else {
        console.error(`Warning: Could not find status ID for "${updates.status}"`);
        request.status = { name: updates.status };
      }
    }
    
    if (updates.priority) {
      const priorityId = this.metadata.getPriorityId(updates.priority);
      if (priorityId && priorityId !== updates.priority) {
        request.priority = { id: priorityId };
      } else {
        console.error(`Warning: Could not find priority ID for "${updates.priority}"`);
        // Don't set priority if we can't find the ID
      }
    }
    
    if (updates.category) {
      const categoryId = this.metadata.getCategoryId(updates.category);
      if (categoryId && categoryId !== updates.category) {
        request.category = { id: categoryId };
      } else {
        console.error(`Warning: Could not find category ID for "${updates.category}"`);
        request.category = { name: updates.category };
      }
    }
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.put(`/requests/${requestId}`, null, { params });
    return response.data.request;
  }
  
  /**
   * Add note - use correct v3 API format
   */
  async addNote(requestId, noteContent, isPublic = true) {
    try {
      const request_note = {
        description: noteContent,
        notify_technician: false,
        show_to_requester: isPublic,
        add_to_linked_requests: false,
        mark_first_response: false
      };
      
      const params = {
        input_data: JSON.stringify({ request_note })
      };
      
      const response = await this.client.post(`/requests/${requestId}/notes`, null, { params });
      return response.data.request_note;
    } catch (error) {
      console.error('Failed to add note:', error.message);
      throw error;
    }
  }
  
  /**
   * Close request
   */
  async closeRequest(requestId, closeData) {
    await this.ensureMetadata();
    
    const { closure_comments, closure_code = 'Resolved' } = closeData;
    
    // Get closed status ID
    const closedStatusId = this.metadata.getStatusId('closed');
    
    const request = {
      closure_info: {
        closure_code: { name: closure_code },
        closure_comments: closure_comments || 'Request closed'
      }
    };
    
    // Only add status if we have a valid ID
    if (closedStatusId && closedStatusId !== 'closed') {
      request.status = { id: closedStatusId };
    } else {
      // Try common closed status names
      request.status = { name: 'Closed' };
    }
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.put(`/requests/${requestId}`, null, { params });
    return response.data.request;
  }
  
  /**
   * Search requests with proper format
   */
  async searchRequests(query, options = {}) {
    const { limit = 10, offset = 0 } = options;
    
    // Try multiple search formats
    try {
      // Format 1: search_fields
      const listInfo = {
        row_count: limit,
        start_index: offset,
        search_fields: {
          subject: query
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
    } catch (error) {
      console.error('Search format 1 failed:', error.message);
      
      // Format 2: filter_by
      const listInfo = {
        row_count: limit,
        start_index: offset,
        filter_by: {
          name: 'subject',
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
}

module.exports = { SDPAPIClientV2 };