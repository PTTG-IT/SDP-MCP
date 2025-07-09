/**
 * Service Desk Plus API Client v2
 * Uses proper IDs for priorities, statuses, and categories
 */

const axios = require('axios');
const { SDPOAuthClient } = require('./sdp-oauth-client.cjs');
const { SDPMetadataClient } = require('./sdp-api-metadata.cjs');
const { SDPUsersAPI } = require('./sdp-api-users.cjs');

class SDPAPIClientV2 {
  constructor(config = {}) {
    // Configuration
    this.portalName = config.portalName || process.env.SDP_PORTAL_NAME || 'kaltentech';
    this.dataCenter = config.dataCenter || process.env.SDP_DATA_CENTER || 'US';
    this.customDomain = config.customDomain || process.env.SDP_BASE_URL || 'https://helpdesk.pttg.com';
    this.instanceName = config.instanceName || process.env.SDP_INSTANCE_NAME || 'itdesk';
    
    // Initialize clients (use singleton OAuth client)
    this.oauth = SDPOAuthClient.getInstance(config);
    this.metadata = new SDPMetadataClient(config);
    
    // Create axios instance
    // Check if we should use mock API for testing
    const useMock = process.env.SDP_USE_MOCK === 'true' || process.env.SDP_USE_MOCK_API === 'true';
    const baseURL = useMock
      ? `${process.env.SDP_BASE_URL || 'http://localhost:3457'}/app/${this.instanceName}/api/v3`
      : this.customDomain 
        ? `${this.customDomain}/app/${this.instanceName}/api/v3`
        : `https://sdpondemand.manageengine.com/app/${this.portalName}/api/v3`;
    
    if (useMock) {
      console.error('🧪 Using MOCK Service Desk Plus API:', baseURL);
    }
    
    this.useMockAPI = useMock;
    
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
        // Skip OAuth for mock API
        if (!this.useMockAPI) {
          const token = await this.oauth.getAccessToken();
          config.headers['Authorization'] = `Zoho-oauthtoken ${token}`;
        } else {
          // Mock API doesn't need auth
          config.headers['Authorization'] = 'Zoho-oauthtoken MOCK_TOKEN';
        }
        console.error(`API Request: ${config.method.toUpperCase()} ${config.url}`);
        if (config.params?.input_data) {
          console.error('Payload:', JSON.stringify(JSON.parse(config.params.input_data), null, 2));
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Some responses have response_status array instead of object
        if (Array.isArray(response.data?.response_status)) {
          // This is actually a successful response with data
          return response;
        }
        return response;
      },
      async (error) => {
        // Log the actual error status first
        if (error.response) {
          console.error(`API returned status ${error.response.status} for ${error.config.method.toUpperCase()} ${error.config.url}`);
        }
        
        // Only refresh on actual 401 Unauthorized errors
        if (error.response?.status === 401) {
          console.error('Got 401 Unauthorized, attempting token refresh...');
          try {
            await this.oauth.refreshAccessToken();
            const originalRequest = error.config;
            const token = await this.oauth.getAccessToken();
            originalRequest.headers['Authorization'] = `Zoho-oauthtoken ${token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError.message);
            // Don't retry if refresh fails
            return Promise.reject(error);
          }
        }
        
        if (error.response) {
          // Don't log full HTML responses
          const data = typeof error.response.data === 'string' && error.response.data.includes('<html>') 
            ? 'HTML error page' 
            : error.response.data;
            
          console.error('API Error:', JSON.stringify({
            status: error.response.status,
            data: data
          }, null, 2));
          
          // Log detailed error messages
          if (error.response.data?.response_status?.messages) {
            console.error('Error messages:');
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
    
    // Initialize users API
    this.users = new SDPUsersAPI(this.client, this.metadata);
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
    
    // Enforce API maximum of 100 rows per request
    const rowCount = Math.min(limit, 100);
    
    const listInfo = {
      row_count: rowCount,
      start_index: offset,
      sort_field: sortBy,
      sort_order: sortOrder,
      get_total_count: true  // Request total count for pagination
    };
    
    // Add filters using search_criteria (proper format per API docs)
    if (status || priority) {
      const searchCriteria = [];
      
      if (status) {
        // Map common status values to proper names
        const statusMap = {
          'open': 'Open',
          'closed': 'Closed',
          'pending': 'On Hold',
          'resolved': 'Resolved',
          'in progress': 'In Progress'
        };
        const statusName = statusMap[status.toLowerCase()] || status;
        searchCriteria.push({
          field: 'status.name',
          condition: 'is',
          value: statusName
        });
      }
      
      if (priority) {
        // Use priority name directly
        const priorityMap = {
          'low': '1 - Low',
          'medium': 'z - Medium',
          'high': '3 - High',
          'urgent': '4 - Critical'
        };
        const priorityName = priorityMap[priority.toLowerCase()] || priority;
        searchCriteria.push({
          field: 'priority.name',
          condition: 'is',
          value: priorityName
        });
      }
      
      if (searchCriteria.length > 0) {
        listInfo.search_criteria = searchCriteria;
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
    const { subject, description, priority = 'medium', category, subcategory, requester_email, requester_name, technician_id, technician_email } = requestData;
    
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
    
    // Use priority name format
    if (priority) {
      const priorityMap = {
        'low': '1 - Low',
        'medium': 'z - Medium',
        'high': '3 - High',
        'urgent': '4 - Critical'
      };
      const priorityName = priorityMap[priority.toLowerCase()] || priority;
      request.priority = { name: priorityName };
      console.error(`Using priority name: "${priorityName}"`);
    }
    
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
    
    // Add subcategory - this is often required
    if (subcategory) {
      request.subcategory = { name: subcategory };
    } else {
      // Default subcategory - always add one since it's often required
      // The specific subcategory depends on the category
      if (category && (category.toLowerCase() === 'software' || categoryId === '216826000000006689')) {
        request.subcategory = { name: 'Application' };
      } else {
        // Generic default subcategory
        request.subcategory = { name: 'General' };
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
    
    // Add technician assignment if provided
    if (technician_id) {
      request.technician = { id: technician_id };
    } else if (technician_email) {
      // Try to find technician by email first
      try {
        const tech = await this.users.findTechnician(technician_email);
        if (tech) {
          request.technician = { id: tech.id };
        }
      } catch (error) {
        console.error(`Could not find technician by email: ${technician_email}`);
      }
    }
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    try {
      const response = await this.client.post('/requests', null, { params });
      return response.data.request;
    } catch (error) {
      // Log the full error details for debugging
      console.error('Create request failed with payload:', JSON.stringify(request, null, 2));
      if (error.response?.data?.response_status?.messages) {
        const messages = error.response.data.response_status.messages;
        console.error('API Error Messages:', messages);
        // Throw a more specific error
        const fieldErrors = messages.map(m => `${m.field || 'Field'}: ${m.message}`).join(', ');
        throw new Error(`API validation failed: ${fieldErrors}`);
      }
      throw error;
    }
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
      // For statuses, always use name format since we don't have IDs
      const statusName = this.metadata.getStatusId(updates.status);
      if (statusName) {
        request.status = { name: statusName };
      } else {
        // Try to map common status names
        const statusMap = {
          'pending': 'On Hold',
          'onhold': 'On Hold',
          'on hold': 'On Hold',
          'inprogress': 'In Progress',
          'in progress': 'In Progress',
          'resolved': 'Resolved',
          'closed': 'Closed',
          'cancelled': 'Cancelled',
          'open': 'Open'
        };
        const mappedStatus = statusMap[updates.status.toLowerCase()] || updates.status;
        request.status = { name: mappedStatus };
        console.error(`Using status name: "${mappedStatus}"`);
      }
    }
    
    if (updates.priority) {
      // Use priority name format
      const priorityMap = {
        'low': '1 - Low',
        'medium': 'z - Medium',
        'high': '3 - High',
        'urgent': '4 - Critical'
      };
      const priorityName = priorityMap[updates.priority.toLowerCase()] || updates.priority;
      request.priority = { name: priorityName };
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
    
    if (updates.subcategory) {
      request.subcategory = { name: updates.subcategory };
    }
    
    // Handle technician assignment
    if (updates.technician_id) {
      request.technician = { id: updates.technician_id };
    } else if (updates.technician_email) {
      try {
        const tech = await this.users.findTechnician(updates.technician_email);
        if (tech) {
          request.technician = { id: tech.id };
        }
      } catch (error) {
        console.error(`Could not find technician: ${updates.technician_email}`);
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
    
    const request = {
      closure_info: {
        closure_code: { name: closure_code },
        closure_comments: closure_comments || 'Request closed'
      },
      // Use the name format for status
      status: { name: 'Closed' }
    };
    
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
    const { limit = 10, offset = 0, searchIn = 'subject' } = options;
    
    // Enforce API maximum of 100 rows per request
    const rowCount = Math.min(limit, 100);
    
    // Use search_criteria for searching (proper format per API docs)
    const listInfo = {
      row_count: rowCount,
      start_index: offset,
      get_total_count: true,
      search_criteria: [{
        field: searchIn,
        condition: 'contains',
        value: query
      }]
    };
    
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
   * Advanced search with multiple criteria
   */
  async advancedSearchRequests(criteria, options = {}) {
    const { limit = 10, page = 1 } = options;
    
    // Enforce API maximum of 100 rows per request
    const rowCount = Math.min(limit, 100);
    
    const listInfo = {
      row_count: rowCount,
      page: page,  // Use page instead of start_index for easier pagination
      get_total_count: true,
      search_criteria: criteria
    };
    
    const params = {
      input_data: JSON.stringify({ list_info: listInfo })
    };
    
    const response = await this.client.get('/requests', { params });
    return {
      requests: response.data.requests || [],
      total_count: response.data.list_info?.total_count || 0,
      has_more: response.data.list_info?.has_more_rows || false,
      page: response.data.list_info?.page || page,
      start_index: response.data.list_info?.start_index
    };
  }
  
  /**
   * Helper to build search criteria for common queries
   */
  static buildSearchCriteria = {
    // Search for open tickets created in last N days
    openTicketsCreatedSince(daysAgo) {
      const timestamp = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
      return {
        field: 'status.name',
        condition: 'is',
        value: 'Open',
        children: [{
          field: 'created_time',
          condition: 'greater than',
          value: timestamp.toString(),
          logical_operator: 'AND'
        }]
      };
    },
    
    // Search for high priority or urgent tickets
    highPriorityTickets() {
      return [{
        field: 'priority.name',
        condition: 'is',
        values: ['3 - High', '4 - Critical'],
        logical_operator: 'OR'
      }];
    },
    
    // Search by requester email
    byRequesterEmail(email) {
      return {
        field: 'requester.email_id',
        condition: 'is',
        value: email
      };
    },
    
    // Search tickets assigned to a technician
    assignedTo(technicianName) {
      return {
        field: 'technician.name',
        condition: 'contains',
        value: technicianName
      };
    },
    
    // Combine multiple criteria with AND
    and(...criteria) {
      return criteria.map((criterion, index) => ({
        ...criterion,
        logical_operator: index === 0 ? undefined : 'AND'
      }));
    },
    
    // Combine multiple criteria with OR
    or(...criteria) {
      return criteria.map((criterion, index) => ({
        ...criterion,
        logical_operator: index === 0 ? undefined : 'OR'
      }));
    }
  };
}

module.exports = { SDPAPIClientV2 };