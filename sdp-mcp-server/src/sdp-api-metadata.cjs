/**
 * Service Desk Plus API Metadata Client
 * Fetches valid values for priorities, categories, statuses, etc.
 */

const axios = require('axios');
const { SDPOAuthClient } = require('./sdp-oauth-client.cjs');

class SDPMetadataClient {
  constructor(config = {}) {
    this.portalName = config.portalName || process.env.SDP_PORTAL_NAME || 'kaltentech';
    this.dataCenter = config.dataCenter || process.env.SDP_DATA_CENTER || 'US';
    this.customDomain = config.customDomain || process.env.SDP_BASE_URL || 'https://helpdesk.pttg.com';
    this.instanceName = config.instanceName || process.env.SDP_INSTANCE_NAME || 'itdesk';
    
    this.oauth = SDPOAuthClient.getInstance(config);
    
    // Check if we should use mock API
    const baseURL = process.env.SDP_USE_MOCK_API === 'true'
      ? `${process.env.SDP_BASE_URL || 'http://localhost:3457'}/app/${this.instanceName}/api/v3`
      : this.customDomain 
        ? `${this.customDomain}/app/${this.instanceName}/api/v3`
        : `https://sdpondemand.manageengine.com/app/${this.portalName}/api/v3`;
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    
    // Add auth interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.oauth.getAccessToken();
        config.headers['Authorization'] = `Zoho-oauthtoken ${token}`;
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Cache for metadata
    this.cache = {
      priorities: null,
      statuses: null,
      categories: null,
      requesters: null,
      templates: null
    };
  }
  
  /**
   * Get all priorities
   */
  async getPriorities() {
    if (this.cache.priorities) return this.cache.priorities;
    
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0
          }
        })
      };
      
      const response = await this.client.get('/priorities', { params });
      this.cache.priorities = response.data.priorities || [];
      
      // Create mapping for easy lookup
      const priorityMap = {};
      this.cache.priorities.forEach(p => {
        priorityMap[p.name.toLowerCase()] = p.id;
        priorityMap[p.id] = p.name;
        // Add common aliases for priorities
        if (p.name === '1 - Low') {
          priorityMap['low'] = p.id;
        } else if (p.name === '2 - Normal') {
          priorityMap['normal'] = p.id;
        } else if (p.name === '3 - High') {
          priorityMap['high'] = p.id;
        } else if (p.name === '4 - Critical') {
          priorityMap['critical'] = p.id;
          priorityMap['urgent'] = p.id;  // alias
        } else if (p.name === 'z - Medium') {
          priorityMap['medium'] = p.id;
        }
      });
      this.cache.priorityMap = priorityMap;
      
      return this.cache.priorities;
    } catch (error) {
      console.error('Failed to fetch priorities:', error.message);
      return [];
    }
  }
  
  /**
   * Get all statuses
   */
  async getStatuses() {
    if (this.cache.statuses) return this.cache.statuses;
    
    // Since the statuses endpoint returns 404, use hardcoded common statuses
    // Note: These don't have real IDs - we'll use names instead
    this.cache.statuses = [
      { id: null, name: 'Open' },
      { id: null, name: 'On Hold' },
      { id: null, name: 'In Progress' },
      { id: null, name: 'Resolved' },
      { id: null, name: 'Closed' },
      { id: null, name: 'Cancelled' }
    ];
    
    // Create mapping - map to names since we don't have IDs
    const statusMap = {};
    this.cache.statuses.forEach(s => {
      statusMap[s.name.toLowerCase()] = s.name;  // Map to name, not ID
      statusMap[s.name.toLowerCase().replace(/\s+/g, '')] = s.name; // Handle no spaces
    });
    this.cache.statusMap = statusMap;
    
    return this.cache.statuses;
  }
  
  /**
   * Get all categories
   */
  async getCategories() {
    if (this.cache.categories) return this.cache.categories;
    
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 200,
            start_index: 0
          }
        })
      };
      
      const response = await this.client.get('/categories', { params });
      this.cache.categories = response.data.categories || [];
      
      // Create mapping
      const categoryMap = {};
      this.cache.categories.forEach(c => {
        categoryMap[c.name.toLowerCase()] = c.id;
        categoryMap[c.id] = c.name;
      });
      this.cache.categoryMap = categoryMap;
      
      return this.cache.categories;
    } catch (error) {
      console.error('Failed to fetch categories:', error.message);
      return [];
    }
  }
  
  /**
   * Get request templates
   */
  async getTemplates() {
    if (this.cache.templates) return this.cache.templates;
    
    try {
      const params = {
        input_data: JSON.stringify({
          list_info: {
            row_count: 100,
            start_index: 0
          }
        })
      };
      
      const response = await this.client.get('/request_templates', { params });
      this.cache.templates = response.data.request_templates || [];
      
      return this.cache.templates;
    } catch (error) {
      console.error('Failed to fetch templates:', error.message);
      return [];
    }
  }
  
  /**
   * Get all metadata at once
   */
  async getAllMetadata() {
    const [priorities, statuses, categories, templates] = await Promise.all([
      this.getPriorities(),
      this.getStatuses(),
      this.getCategories(),
      this.getTemplates()
    ]);
    
    return {
      priorities: priorities.map(p => ({ id: p.id, name: p.name, color: p.color })),
      statuses: statuses.map(s => ({ id: s.id, name: s.name, color: s.color })),
      categories: categories.map(c => ({ id: c.id, name: c.name, description: c.description })),
      templates: templates.map(t => ({ id: t.id, name: t.name, description: t.description })),
      mappings: {
        priority: this.cache.priorityMap,
        status: this.cache.statusMap,
        category: this.cache.categoryMap
      }
    };
  }
  
  /**
   * Helper to convert friendly names to IDs
   */
  getPriorityId(name) {
    if (!this.cache.priorityMap) {
      console.error('Priority map not loaded');
      return name;
    }
    const id = this.cache.priorityMap[name.toLowerCase()];
    console.error(`Priority lookup: "${name}" -> "${id || 'not found'}"`);
    return id || name;
  }
  
  getStatusId(name) {
    if (!this.cache.statusMap) return null;
    // For statuses, we return the properly formatted name, not an ID
    return this.cache.statusMap[name.toLowerCase()] || null;
  }
  
  getCategoryId(name) {
    if (!this.cache.categoryMap) return name;
    return this.cache.categoryMap[name.toLowerCase()] || name;
  }
}

module.exports = { SDPMetadataClient };