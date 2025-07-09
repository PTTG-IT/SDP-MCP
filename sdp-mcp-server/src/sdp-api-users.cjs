/**
 * Service Desk Plus API Users/Technicians Module
 * Handles user and technician lookups
 */

const axios = require('axios');

class SDPUsersAPI {
  constructor(client, metadata) {
    this.client = client;
    this.metadata = metadata;
  }

  /**
   * List technicians
   */
  async listTechnicians(options = {}) {
    const { limit = 25, offset = 0, searchTerm } = options;
    
    // Enforce API maximum of 100 rows per request
    const rowCount = Math.min(limit, 100);
    
    const listInfo = {
      row_count: rowCount,
      start_index: offset,
      sort_field: 'name',
      sort_order: 'asc',
      get_total_count: true
    };
    
    // Add search using search_criteria if provided
    if (searchTerm) {
      listInfo.search_criteria = [{
        field: 'name',
        condition: 'contains',
        value: searchTerm
      }];
    }
    
    // Filter to only get technicians (users with technician role)
    listInfo.filter_by = {
      name: 'is_technician',
      value: true
    };
    
    const params = {
      input_data: JSON.stringify({ list_info: listInfo })
    };
    
    try {
      // Try /technicians endpoint first
      const response = await this.client.get('/technicians', { params });
      return {
        technicians: response.data.technicians || [],
        total_count: response.data.list_info?.total_count || 0,
        has_more: response.data.list_info?.has_more_rows || false
      };
    } catch (error) {
      // If /technicians doesn't exist, try /users with technician filter
      console.error('Technicians endpoint not found, trying users endpoint');
      const response = await this.client.get('/users', { params });
      return {
        technicians: response.data.users || [],
        total_count: response.data.list_info?.total_count || 0,
        has_more: response.data.list_info?.has_more_rows || false
      };
    }
  }

  /**
   * Get technician details
   */
  async getTechnician(technicianId) {
    try {
      // Try /technicians endpoint first
      const response = await this.client.get(`/technicians/${technicianId}`);
      return response.data.technician;
    } catch (error) {
      // If /technicians doesn't exist, try /users
      console.error('Technicians endpoint not found, trying users endpoint');
      const response = await this.client.get(`/users/${technicianId}`);
      return response.data.user;
    }
  }

  /**
   * List users (requesters)
   */
  async listUsers(options = {}) {
    const { limit = 25, offset = 0, searchTerm, includeInactive = false } = options;
    
    // Enforce API maximum of 100 rows per request
    const rowCount = Math.min(limit, 100);
    
    const listInfo = {
      row_count: rowCount,
      start_index: offset,
      sort_field: 'name',
      sort_order: 'asc',
      get_total_count: true
    };
    
    // Add search using search_criteria if provided
    if (searchTerm) {
      listInfo.search_criteria = [{
        field: 'name',
        condition: 'contains',
        value: searchTerm
      }];
    }
    
    // Filter by active status
    if (!includeInactive) {
      listInfo.filter_by = {
        name: 'is_vip_user',
        value: false  // This might need adjustment based on API
      };
    }
    
    const params = {
      input_data: JSON.stringify({ list_info: listInfo })
    };
    
    const response = await this.client.get('/users', { params });
    return {
      users: response.data.users || [],
      total_count: response.data.list_info?.total_count || 0,
      has_more: response.data.list_info?.has_more_rows || false
    };
  }

  /**
   * Get user details
   */
  async getUser(userId) {
    const response = await this.client.get(`/users/${userId}`);
    return response.data.user;
  }

  /**
   * Search for technician by name or email
   */
  async findTechnician(searchTerm) {
    // First try exact email match
    try {
      const result = await this.listTechnicians({ 
        searchTerm, 
        limit: 5 
      });
      
      if (result.technicians.length > 0) {
        // Return best match
        const exactMatch = result.technicians.find(
          t => t.email_id?.toLowerCase() === searchTerm.toLowerCase() ||
               t.name?.toLowerCase() === searchTerm.toLowerCase()
        );
        
        return exactMatch || result.technicians[0];
      }
    } catch (error) {
      console.error('Failed to find technician:', error.message);
    }
    
    return null;
  }

  /**
   * Get current user (the API user)
   */
  async getCurrentUser() {
    try {
      // This endpoint might vary by SDP version
      const response = await this.client.get('/users/me');
      return response.data.user;
    } catch (error) {
      console.error('Failed to get current user:', error.message);
      // Fallback: try to get from technicians list
      const techs = await this.listTechnicians({ limit: 1 });
      return techs.technicians[0] || null;
    }
  }
}

module.exports = { SDPUsersAPI };