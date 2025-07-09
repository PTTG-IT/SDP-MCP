/**
 * Service Desk Plus API Client v2
 * Uses proper IDs for priorities, statuses, and categories
 */

const axios = require('axios');
const { SDPOAuthClient } = require('./sdp-oauth-client.cjs');
const { SDPMetadataClient } = require('./sdp-api-metadata.cjs');
const { SDPUsersAPI } = require('./sdp-api-users.cjs');
const errorLogger = require('./utils/error-logger.cjs');

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
        
        // Only refresh on actual 401 Unauthorized errors with token issues
        if (error.response?.status === 401) {
          // IMPORTANT: Check if it's HTML error page (endpoint doesn't exist)
          const errorData = error.response?.data;
          
          // If we get HTML back, it's a 404/missing endpoint, not auth issue
          if (typeof errorData === 'string' && errorData.includes('<html>')) {
            console.error('Got 401 with HTML response - endpoint does not exist, skipping token refresh');
            return Promise.reject(error);
          }
          
          const errorMessage = errorData?.response_status?.messages?.[0]?.message || 
                              errorData?.message || 
                              JSON.stringify(errorData);
          
          // Don't refresh for missing endpoints or scope issues
          // Check for specific status codes that indicate non-token issues
          const statusCode = errorData?.response_status?.status_code;
          
          // Skip refresh for these status codes (not token-related)
          const skipRefreshCodes = [
            4002, // Forbidden - permission issue
            4007, // Resource not found
            7001  // License issue
          ];
          
          if (skipRefreshCodes.includes(statusCode)) {
            console.error(`Got 401 with status code ${statusCode}, skipping token refresh`);
            return Promise.reject(error);
          }
          
          // Also check message patterns
          const skipRefreshPatterns = [
            'endpoint not found',
            'resource not found',
            'scope',
            'permission',
            'access denied'
          ];
          
          const shouldSkipRefresh = skipRefreshPatterns.some(pattern => 
            errorMessage.toLowerCase().includes(pattern)
          );
          
          if (!shouldSkipRefresh) {
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
          } else {
            console.error(`Got 401 but skipping refresh (likely missing scope/endpoint): ${errorMessage}`);
          }
        }
        
        // Handle 400 errors with HTML (non-existent endpoints)
        if (error.response?.status === 400) {
          const errorData = error.response?.data;
          if (typeof errorData === 'string' && errorData.includes('<html>')) {
            console.error('Got 400 with HTML response - endpoint does not exist');
            error.message = 'API endpoint does not exist';
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
          
          // Log detailed error messages with status codes
          if (error.response.data?.response_status) {
            const status = error.response.data.response_status;
            console.error(`API Status Code: ${status.status_code} - ${status.status}`);
            
            if (status.messages) {
              console.error('Error details:');
              status.messages.forEach(msg => {
                if (msg.fields) {
                  console.error(`  - Missing mandatory fields: ${msg.fields.join(', ')}`);
                } else {
                  console.error(`  - ${msg.field || 'General'}: ${msg.message}`);
                }
              });
            }
          }
        }
        
        // Log error with status codes
        const formattedError = this.formatError(error);
        errorLogger.logApiError(formattedError, {
          endpoint: error.config?.url,
          method: error.config?.method,
          requestData: error.config?.data
        });
        
        return Promise.reject(formattedError);
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
      
      // Build detailed error info
      const errorInfo = {
        code: status.status_code,
        httpStatus: error.response.status,
        message: messages.map(m => m.message).join('; ') || 'API Error',
        details: error.response.data,
        // Add specific field information
        fields: messages.filter(m => m.fields).flatMap(m => m.fields),
        fieldErrors: messages.filter(m => m.field).map(m => ({
          field: m.field,
          message: m.message
        }))
      };
      
      // Log status codes for debugging
      console.error(`API Error - Status Code: ${status.status_code}, HTTP: ${error.response.status}`);
      
      return errorInfo;
    }
    
    return {
      code: error.response?.status || 'UNKNOWN',
      httpStatus: error.response?.status,
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
    
    // Add filters - try filter_by for simple filters first
    if (status && !priority) {
      // Single status filter - use filter_by
      const statusMap = {
        'open': 'Open',
        'closed': 'Closed',
        'pending': 'On Hold',
        'resolved': 'Resolved',
        'in progress': 'In Progress'
      };
      const statusName = statusMap[status.toLowerCase()] || status;
      listInfo.filter_by = {
        name: 'status.name',
        value: statusName
      };
    } else if (priority && !status) {
      // Single priority filter - use filter_by
      const priorityMap = {
        'low': '1 - Low',
        'medium': 'z - Medium',
        'high': '3 - High',
        'urgent': '4 - Critical'
      };
      const priorityName = priorityMap[priority.toLowerCase()] || priority;
      listInfo.filter_by = {
        name: 'priority.name',
        value: priorityName
      };
    } else if (status && priority) {
      // Multiple filters - use search_criteria
      const searchCriteria = [];
      
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
        value: priorityName,
        logical_operator: 'AND'
      });
      
      listInfo.search_criteria = searchCriteria;
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
   * 
   * @param {Object} requestData - Request creation data
   * @param {string} requestData.subject - Subject of the request (required, max 250 chars)
   * @param {string} requestData.description - Description of the request (HTML supported)
   * @param {string} requestData.priority - Priority level (low, medium, high, urgent)
   * @param {string} requestData.category - Category name
   * @param {string} requestData.subcategory - Subcategory name
   * @param {Object} requestData.requester - Requester object with email_id
   * @param {string} requestData.requester_email - Requester email address
   * @param {string} requestData.requester_name - Requester name
   * @param {string} requestData.technician_id - Technician ID for assignment
   * @param {string} requestData.technician_email - Technician email for assignment
   * @param {string} requestData.impact_details - Impact description (max 250 chars)
   * @param {Array} requestData.email_ids_to_notify - Email addresses to notify
   * @param {string} requestData.urgency - Urgency level
   * @param {string} requestData.impact - Impact level
   * @param {string} requestData.level - Support level
   * @param {string} requestData.mode - Creation mode
   * @param {string} requestData.request_type - Type of request
   * @param {Object} requestData.due_by_time - Due date/time
   * @param {Object} requestData.first_response_due_by_time - First response due time
   * @param {Array} requestData.assets - Associated assets
   * @param {Array} requestData.configuration_items - Configuration items
   * @param {Object} requestData.udf_fields - User-defined fields
   * @param {Object} requestData.template - Template to use
   * @param {Object} requestData.site - Associated site
   * @param {Object} requestData.group - Assigned group
   * @param {Object} requestData.service_category - Service category
   * @param {Object} requestData.service_approvers - Service approval configuration
   * @param {Object} requestData.resources - Service catalog resources
   * @returns {Promise<Object>} The created request object
   */
  async createRequest(requestData) {
    const { 
      subject, 
      description, 
      priority = 'medium', 
      category, 
      subcategory, 
      requester, 
      requester_email, 
      requester_name, 
      technician_id, 
      technician_email,
      impact_details,
      email_ids_to_notify,
      urgency,
      impact,
      level,
      mode,
      request_type,
      due_by_time,
      first_response_due_by_time,
      assets,
      configuration_items,
      udf_fields,
      template,
      site,
      group,
      service_category,
      service_approvers,
      resources
    } = requestData;
    
    if (!subject) {
      throw new Error('Subject is required');
    }
    
    // Validate subject length
    if (subject.length > 250) {
      throw new Error('Subject must be 250 characters or less');
    }
    
    // Validate impact_details length
    if (impact_details && impact_details.length > 250) {
      throw new Error('Impact details must be 250 characters or less');
    }
    
    await this.ensureMetadata();
    
    const request = {
      subject,
      description: description || '',
      // All required fields based on API error
      mode: mode ? { name: mode } : { name: 'Web Form' },
      request_type: request_type ? { name: request_type } : { name: 'Incident' },
      urgency: urgency ? { name: urgency } : { name: '2 - General Concern' },  // Valid urgency
      level: level ? { name: level } : { name: '1 - Frontline' },  // Valid level
      impact: impact ? { name: impact } : { name: '1 - Affects User' },
      category: category ? { name: category } : { name: 'Software' },  // Default category
      status: { name: 'Open' }
    };
    
    // Add optional fields
    if (impact_details) {
      request.impact_details = impact_details;
    }
    
    if (email_ids_to_notify && Array.isArray(email_ids_to_notify)) {
      request.email_ids_to_notify = email_ids_to_notify;
    }
    
    if (due_by_time) {
      request.due_by_time = due_by_time;
    }
    
    if (first_response_due_by_time) {
      request.first_response_due_by_time = first_response_due_by_time;
    }
    
    if (assets && Array.isArray(assets)) {
      request.assets = assets;
    }
    
    if (configuration_items && Array.isArray(configuration_items)) {
      request.configuration_items = configuration_items;
    }
    
    if (udf_fields && typeof udf_fields === 'object') {
      request.udf_fields = udf_fields;
    }
    
    if (template) {
      request.template = typeof template === 'string' ? { name: template } : template;
    }
    
    if (site) {
      request.site = typeof site === 'string' ? { name: site } : site;
    }
    
    if (group) {
      request.group = typeof group === 'string' ? { name: group } : group;
    }
    
    if (service_category) {
      request.service_category = typeof service_category === 'string' ? { name: service_category } : service_category;
    }
    
    if (service_approvers) {
      request.service_approvers = service_approvers;
    }
    
    if (resources) {
      request.resources = resources;
    }
    
    // SKIP priority on creation - business rules prevent it (error 4002)
    // Let SDP use its default priority setting
    // Priority can be updated after creation if needed
    // if (priority) {
    //   const priorityMap = {
    //     'low': '1 - Low',
    //     'medium': '2 - Normal',
    //     'high': '3 - High',
    //     'urgent': '4 - Critical'
    //   };
    //   const priorityName = priorityMap[priority.toLowerCase()] || priority;
    //   request.priority = { name: priorityName };
    //   console.error(`Using priority name: "${priorityName}"`);
    // }
    console.error('Skipping priority on creation due to business rules - will use SDP default');
    
    // Use category ID
    if (category) {
      // Handle both object and string formats
      if (typeof category === 'object' && category.id) {
        request.category = category;
      } else if (typeof category === 'string') {
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
    }
    
    // Add subcategory - this is often required
    if (subcategory) {
      // Handle both object and string formats
      if (typeof subcategory === 'object' && subcategory.id) {
        request.subcategory = subcategory;
      } else if (typeof subcategory === 'string') {
        // Map common subcategory names to valid ones
        const subcategoryMap = {
          'printer': 'Printer/Scanner',
          'printers': 'Printer/Scanner',
          'scanner': 'Printer/Scanner',
          'scanners': 'Printer/Scanner'
        };
        const mappedSubcategory = subcategoryMap[subcategory.toLowerCase()] || subcategory;
        request.subcategory = { name: mappedSubcategory };
      }
    } else if (request.category) {
      // Default subcategory - always add one since it's often required
      // IMPORTANT: Use validated subcategories that exist in the system
      const categoryName = request.category.name || '';
      const categoryId = request.category.id || '0';
      
      if (categoryId === '216826000000006689' || categoryName === 'Software') {
        // Use a known valid subcategory for Software
        request.subcategory = { name: 'Not in list' };
        console.error('Using default Software subcategory: Not in list');
      } else if (categoryId === '216826000000288100' || categoryName === 'Hardware') {
        // Use a valid subcategory for Hardware
        request.subcategory = { name: 'Not in list' };
        console.error('Using default Hardware subcategory: Not in list');
      } else {
        // Generic default subcategory - use Not in list as it's commonly available
        request.subcategory = { name: 'Not in list' };
        console.error('Using default subcategory: Not in list');
      }
    }
    
    // Skip requester field for now to avoid validation issues
    // The API user will be used as the requester automatically
    // This prevents error 4001 with invalid email addresses
    if (requester_email || requester_name || requester) {
      console.error('Note: Requester field skipped to avoid validation errors - API user will be used as requester');
    } else {
      console.error('No requester specified, SDP will use API user as requester');
    }
    
    // Add technician assignment if provided
    if (technician_id) {
      request.technician = { id: technician_id };
    } else if (technician_email) {
      // Use technician email directly - the /users endpoint doesn't exist in SDP Cloud API
      console.error(`Using technician email directly: ${technician_email}`);
      request.technician = { email_id: technician_email };
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
   * 
   * @param {string} requestId - ID of the request to update
   * @param {Object} updates - Fields to update
   * @param {string} updates.subject - Updated subject (max 250 chars)
   * @param {string} updates.description - Updated description (HTML supported)
   * @param {string} updates.status - New status
   * @param {string} updates.priority - New priority level
   * @param {string} updates.category - New category
   * @param {string} updates.subcategory - New subcategory
   * @param {string} updates.technician_id - New technician ID
   * @param {string} updates.technician_email - New technician email
   * @param {string} updates.urgency - New urgency level
   * @param {string} updates.impact - New impact level
   * @param {string} updates.level - New support level
   * @param {Object} updates.due_by_time - New due date/time
   * @param {Object} updates.first_response_due_by_time - New first response due time
   * @param {string} updates.update_reason - Reason for the update
   * @param {string} updates.status_change_comments - Comments for status change
   * @param {string} updates.impact_details - Impact description (max 250 chars)
   * @param {Array} updates.email_ids_to_notify - Email addresses to notify
   * @param {Array} updates.assets - Associated assets
   * @param {Array} updates.configuration_items - Configuration items
   * @param {Object} updates.udf_fields - User-defined fields
   * @param {Object} updates.template - Template to use
   * @param {Object} updates.site - Associated site
   * @param {Object} updates.group - Assigned group
   * @param {Object} updates.service_category - Service category
   * @param {Object} updates.service_approvers - Service approval configuration
   * @param {Object} updates.resources - Service catalog resources
   * @param {Object} updates.resolution - Resolution details
   * @param {Object} updates.closure_info - Closure information
   * @param {Object} updates.scheduled_start_time - Scheduled start time
   * @param {Object} updates.scheduled_end_time - Scheduled end time
   * @returns {Promise<Object>} The updated request object
   */
  async updateRequest(requestId, updates) {
    await this.ensureMetadata();
    
    const request = {};
    
    // Validate field lengths
    if (updates.subject && updates.subject.length > 250) {
      throw new Error('Subject must be 250 characters or less');
    }
    
    if (updates.impact_details && updates.impact_details.length > 250) {
      throw new Error('Impact details must be 250 characters or less');
    }
    
    // Basic fields
    if (updates.subject) request.subject = updates.subject;
    if (updates.description) request.description = updates.description;
    if (updates.impact_details) request.impact_details = updates.impact_details;
    
    // Update reason and comments
    if (updates.update_reason) request.update_reason = updates.update_reason;
    if (updates.status_change_comments) request.status_change_comments = updates.status_change_comments;
    
    // Date/time fields
    if (updates.due_by_time) request.due_by_time = updates.due_by_time;
    if (updates.first_response_due_by_time) request.first_response_due_by_time = updates.first_response_due_by_time;
    if (updates.scheduled_start_time) request.scheduled_start_time = updates.scheduled_start_time;
    if (updates.scheduled_end_time) request.scheduled_end_time = updates.scheduled_end_time;
    
    // Array fields
    if (updates.email_ids_to_notify && Array.isArray(updates.email_ids_to_notify)) {
      request.email_ids_to_notify = updates.email_ids_to_notify;
    }
    
    if (updates.assets && Array.isArray(updates.assets)) {
      request.assets = updates.assets;
    }
    
    if (updates.configuration_items && Array.isArray(updates.configuration_items)) {
      request.configuration_items = updates.configuration_items;
    }
    
    // Object fields
    if (updates.udf_fields && typeof updates.udf_fields === 'object') {
      request.udf_fields = updates.udf_fields;
    }
    
    if (updates.template) {
      request.template = typeof updates.template === 'string' ? { name: updates.template } : updates.template;
    }
    
    if (updates.site) {
      request.site = typeof updates.site === 'string' ? { name: updates.site } : updates.site;
    }
    
    if (updates.group) {
      request.group = typeof updates.group === 'string' ? { name: updates.group } : updates.group;
    }
    
    if (updates.service_category) {
      request.service_category = typeof updates.service_category === 'string' ? { name: updates.service_category } : updates.service_category;
    }
    
    if (updates.service_approvers) {
      request.service_approvers = updates.service_approvers;
    }
    
    if (updates.resources) {
      request.resources = updates.resources;
    }
    
    if (updates.resolution) {
      request.resolution = updates.resolution;
    }
    
    if (updates.closure_info) {
      request.closure_info = updates.closure_info;
    }
    
    // Handle urgency field
    if (updates.urgency) {
      request.urgency = { name: updates.urgency };
    }
    
    // Handle level field
    if (updates.level) {
      request.level = { name: updates.level };
    }
    
    // Handle impact field
    if (updates.impact) {
      request.impact = { name: updates.impact };
    }
    
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
      // Use technician email directly - the /users endpoint doesn't exist in SDP Cloud API
      console.error(`Using technician email directly: ${updates.technician_email}`);
      request.technician = { email_id: updates.technician_email };
    }
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.put(`/requests/${requestId}`, null, { params });
    return response.data.request;
  }
  
  /**
   * Add note - use correct v3 API format
   * 
   * @param {string} requestId - ID of the request to add note to
   * @param {string} noteContent - Content of the note
   * @param {boolean} isPublic - Whether the note is visible to requester (default: true)
   * @param {boolean} notifyTechnician - Whether to notify technician (default: false)
   * @param {boolean} addToLinkedRequests - Whether to add to linked requests (default: false)
   * @param {boolean} markFirstResponse - Whether to mark as first response (default: false)
   * @returns {Promise<Object>} The created note object
   */
  async addNote(requestId, noteContent, isPublic = true, notifyTechnician = false, addToLinkedRequests = false, markFirstResponse = false) {
    try {
      const request_note = {
        description: noteContent,
        notify_technician: notifyTechnician,
        show_to_requester: isPublic,
        add_to_linked_requests: addToLinkedRequests,
        mark_first_response: markFirstResponse
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
   * Reply to requester via email
   * This sends an email reply that appears in the ticket conversation
   * 
   * @param {string} requestId - ID of the request to reply to
   * @param {string} replyMessage - The reply message content
   * @param {boolean} markFirstResponse - Whether to mark as first response (default: false)
   * @returns {Promise<Object>} The created reply note object
   */
  async replyToRequester(requestId, replyMessage, markFirstResponse = false) {
    try {
      const request_note = {
        description: replyMessage,
        show_to_requester: true,       // This makes it visible to requester and sends email
        notify_technician: false,      // Don't notify technician
        add_to_linked_requests: false, // Don't add to linked requests
        mark_first_response: markFirstResponse
      };
      
      const params = {
        input_data: JSON.stringify({ request_note })
      };
      
      console.error(`Replying to requester for request ${requestId}`);
      const response = await this.client.post(`/requests/${requestId}/notes`, null, { params });
      return response.data.request_note;
    } catch (error) {
      console.error('Failed to reply to requester:', error.message);
      throw error;
    }
  }
  
  /**
   * Send private note to technician (not visible to requester)
   * 
   * @param {string} requestId - ID of the request
   * @param {string} noteContent - The note content
   * @param {boolean} notifyTechnician - Whether to notify technician (default: true)
   * @returns {Promise<Object>} The created private note object
   */
  async addPrivateNote(requestId, noteContent, notifyTechnician = true) {
    try {
      const request_note = {
        description: noteContent,
        show_to_requester: false,      // Private - not visible to requester
        notify_technician: notifyTechnician,
        add_to_linked_requests: false,
        mark_first_response: false
      };
      
      const params = {
        input_data: JSON.stringify({ request_note })
      };
      
      console.error(`Adding private note for request ${requestId}`);
      const response = await this.client.post(`/requests/${requestId}/notes`, null, { params });
      return response.data.request_note;
    } catch (error) {
      console.error('Failed to add private note:', error.message);
      throw error;
    }
  }
  
  /**
   * Send first response to requester
   * This marks the note as the first response and sends email to requester
   * 
   * @param {string} requestId - ID of the request
   * @param {string} responseMessage - The first response message
   * @returns {Promise<Object>} The created first response note object
   */
  async sendFirstResponse(requestId, responseMessage) {
    try {
      const request_note = {
        description: responseMessage,
        show_to_requester: true,       // Visible to requester and sends email
        notify_technician: false,      // Don't notify technician
        add_to_linked_requests: false, // Don't add to linked requests
        mark_first_response: true      // Mark as first response
      };
      
      const params = {
        input_data: JSON.stringify({ request_note })
      };
      
      console.error(`Sending first response for request ${requestId}`);
      const response = await this.client.post(`/requests/${requestId}/notes`, null, { params });
      return response.data.request_note;
    } catch (error) {
      console.error('Failed to send first response:', error.message);
      throw error;
    }
  }
  
  /**
   * Get all notes/conversation for a request
   * 
   * @param {string} requestId - ID of the request
   * @returns {Promise<Array>} Array of notes/conversation entries
   */
  async getRequestConversation(requestId) {
    try {
      const response = await this.client.get(`/requests/${requestId}/notes`);
      return response.data.request_notes || [];
    } catch (error) {
      console.error('Failed to get request conversation:', error.message);
      throw error;
    }
  }
  
  /**
   * Close request
   * 
   * @param {string} requestId - ID of the request to close
   * @param {Object} closeData - Closure data
   * @param {string} closeData.closure_comments - Comments for closure
   * @param {string} closeData.closure_code - Optional closure code
   * @param {string} closeData.status - Status to set (default: 'Closed')
   * @param {Object} closeData.resolution - Resolution details
   * @returns {Promise<Object>} The closed request object
   */
  async closeRequest(requestId, closeData) {
    await this.ensureMetadata();
    
    const { closure_comments, closure_code, status = 'Closed', resolution } = closeData;
    
    // Try closing with just closure_comments and status change
    // Skip closure_code as it's causing validation errors
    const request = {
      closure_info: {
        closure_comments: closure_comments || 'Request closed'
      },
      // Use the name format for status
      status: { name: status }
    };
    
    // Add resolution if provided
    if (resolution) {
      request.resolution = resolution;
    }
    
    // Add closure_code if provided (may cause validation errors in some instances)
    if (closure_code) {
      request.closure_info.closure_code = closure_code;
    }
    
    const params = {
      input_data: JSON.stringify({ request })
    };
    
    const response = await this.client.put(`/requests/${requestId}`, null, { params });
    return response.data.request;
  }
  
  /**
   * Search requests with proper format
   * 
   * @param {string} query - Search query string
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results (default: 10, max: 100)
   * @param {number} options.offset - Starting offset for pagination (default: 0)
   * @param {string} options.searchIn - Field to search in (default: 'subject')
   * @param {string} options.sortBy - Field to sort by (default: 'created_time')
   * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (default: 'desc')
   * @param {boolean} options.getTotalCount - Whether to get total count (default: true)
   * @returns {Promise<Object>} Search results with requests array and pagination info
   */
  async searchRequests(query, options = {}) {
    const { 
      limit = 10, 
      offset = 0, 
      searchIn = 'subject', 
      sortBy = 'created_time', 
      sortOrder = 'desc',
      getTotalCount = true 
    } = options;
    
    // Enforce API maximum of 100 rows per request
    const rowCount = Math.min(limit, 100);
    
    // Use search_criteria for searching (object format, not array)
    // Service Desk Plus requires object format for single criteria
    const listInfo = {
      row_count: rowCount,
      start_index: offset || 1,  // SDP uses 1-based indexing
      sort_field: sortBy,
      sort_order: sortOrder,
      get_total_count: getTotalCount,
      search_criteria: {
        field: searchIn,
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
      total_count: response.data.list_info?.total_count || 0,
      has_more: response.data.list_info?.has_more_rows || false
    };
  }
  
  /**
   * Advanced search with multiple criteria
   * 
   * @param {Object|Array} criteria - Search criteria object or array
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results (default: 10, max: 100)
   * @param {number} options.page - Page number for pagination (default: 1)
   * @param {string} options.sortBy - Field to sort by (default: 'created_time')
   * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (default: 'desc')
   * @param {boolean} options.getTotalCount - Whether to get total count (default: true)
   * @returns {Promise<Object>} Search results with requests array and pagination info
   */
  async advancedSearchRequests(criteria, options = {}) {
    const { 
      limit = 10, 
      page = 1, 
      sortBy = 'created_time', 
      sortOrder = 'desc',
      getTotalCount = true 
    } = options;
    
    // Enforce API maximum of 100 rows per request
    const rowCount = Math.min(limit, 100);
    
    const listInfo = {
      row_count: rowCount,
      page: page,  // Use page instead of start_index for easier pagination
      sort_field: sortBy,
      sort_order: sortOrder,
      get_total_count: getTotalCount,
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
   * Add email notifications to a request
   * 
   * @param {string} requestId - ID of the request
   * @param {Array<string>} emailList - Array of email addresses to notify
   * @returns {Promise<Object>} The updated request object
   */
  async addEmailNotifications(requestId, emailList) {
    if (!Array.isArray(emailList)) {
      throw new Error('Email list must be an array');
    }
    
    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emailList.filter(email => emailRegex.test(email));
    
    if (validEmails.length === 0) {
      throw new Error('No valid email addresses provided');
    }
    
    const request = {
      email_ids_to_notify: validEmails
    };
    
    return await this.updateRequest(requestId, request);
  }
  
  /**
   * Get email addresses associated with a request
   * 
   * @param {string} requestId - ID of the request
   * @returns {Promise<Object>} Object containing email addresses
   */
  async getRequestEmailAddresses(requestId) {
    const request = await this.getRequest(requestId);
    return {
      email_to: request.email_to || [],
      email_cc: request.email_cc || [],
      email_bcc: request.email_bcc || [],
      email_ids_to_notify: request.email_ids_to_notify || []
    };
  }
  
  /**
   * Create request with email mode
   * 
   * @param {Object} requestData - Request data with email-specific fields
   * @param {Array<string>} requestData.notify_emails - Emails to notify
   * @returns {Promise<Object>} The created request object
   */
  async createEmailRequest(requestData) {
    const emailRequestData = {
      ...requestData,
      mode: 'E-Mail',
      email_ids_to_notify: requestData.notify_emails || []
    };
    
    return await this.createRequest(emailRequestData);
  }
  
  /**
   * Set requester by email address
   * 
   * @param {string} requestId - ID of the request
   * @param {string} emailAddress - Email address of the requester
   * @param {string} name - Optional name of the requester
   * @returns {Promise<Object>} The updated request object
   */
  async setRequesterByEmail(requestId, emailAddress, name) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      throw new Error('Invalid email address format');
    }
    
    const request = {
      requester: { 
        email_id: emailAddress,
        ...(name && { name })
      }
    };
    
    return await this.updateRequest(requestId, request);
  }
  
  /**
   * Assign technician by email address
   * 
   * @param {string} requestId - ID of the request
   * @param {string} technicianEmail - Email address of the technician
   * @returns {Promise<Object>} The updated request object
   */
  async assignTechnicianByEmail(requestId, technicianEmail) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!technicianEmail || !emailRegex.test(technicianEmail)) {
      throw new Error('Valid technician email address is required');
    }
    
    const request = {
      technician: { email_id: technicianEmail }
    };
    
    return await this.updateRequest(requestId, request);
  }
  
  /**
   * Search requests by requester email
   * 
   * @param {string} requesterEmail - Email address of the requester
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchRequestsByRequesterEmail(requesterEmail, options = {}) {
    const criteria = {
      field: 'requester.email_id',
      condition: 'is',
      value: requesterEmail
    };
    
    return await this.advancedSearchRequests(criteria, options);
  }
  
  /**
   * Search requests by technician email
   * 
   * @param {string} technicianEmail - Email address of the technician
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchRequestsByTechnicianEmail(technicianEmail, options = {}) {
    const criteria = {
      field: 'technician.email_id',
      condition: 'is',
      value: technicianEmail
    };
    
    return await this.advancedSearchRequests(criteria, options);
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