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
    // IMPORTANT: Cannot use both search_criteria and filter_by - causes 400 error
    if (searchTerm) {
      listInfo.search_criteria = [{
        field: 'name',
        condition: 'contains',
        value: searchTerm
      }];
    }
    
    const params = {
      input_data: JSON.stringify({ list_info: listInfo })
    };
    
    try {
      // Only try /users endpoint - /technicians doesn't exist in SDP Cloud
      const response = await this.client.get('/users', { params });
      
      // Filter technicians from users list based on properties
      // Look for users who have technician-specific properties
      const allUsers = response.data.users || [];
      const technicians = allUsers.filter(user => {
        // Check various indicators that user is a technician
        return user.is_technician === true || 
               user.is_vip_user === true ||
               user.employee_id || 
               user.department?.name;
      });
      
      return {
        technicians: technicians,
        total_count: technicians.length,
        has_more: response.data.list_info?.has_more_rows || false
      };
    } catch (error) {
      console.error('Failed to list users/technicians:', error.message);
      throw error;
    }
  }

  /**
   * Get technician details
   */
  async getTechnician(technicianId) {
    try {
      // Only use /users endpoint
      const response = await this.client.get(`/users/${technicianId}`);
      return response.data.user;
    } catch (error) {
      console.error('Failed to get user/technician:', error.message);
      throw error;
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
    // IMPORTANT: Cannot use both search_criteria and filter_by - causes 400 error
    if (searchTerm) {
      listInfo.search_criteria = [{
        field: 'name',
        condition: 'contains',
        value: searchTerm
      }];
    }
    
    const params = {
      input_data: JSON.stringify({ list_info: listInfo })
    };
    
    const response = await this.client.get('/users', { params });
    
    // Filter results after getting them if needed
    let users = response.data.users || [];
    if (!includeInactive) {
      // Filter out inactive users client-side
      users = users.filter(user => user.is_active !== false);
    }
    
    return {
      users: users,
      total_count: users.length,
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