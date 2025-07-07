import { AxiosInstance } from 'axios';
import { SDPResponse, SDPListResponse } from '../types.js';

export interface TemplateField {
  name: string;
  api_field_name: string;
  type: string;
  is_mandatory: boolean;
  is_editable: boolean;
  options?: Array<{ id: string; name: string }>;
}

export interface RequestTemplate {
  id: string;
  name: string;
  description?: string;
  fields?: TemplateField[];
  is_default?: boolean;
}

export interface RequestType {
  id: string;
  name: string;
  fields?: TemplateField[];
}

export class TemplatesAPI {
  constructor(private axios: AxiosInstance) {}

  /**
   * Get all request templates
   * Note: This endpoint might not be available in all instances
   */
  async listTemplates(): Promise<RequestTemplate[]> {
    try {
      const response = await this.axios.get<any>('/request_templates');
      return response.data.request_templates || [];
    } catch (error) {
      console.warn('Request templates endpoint not available:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get a specific request template
   */
  async getTemplate(templateId: string): Promise<RequestTemplate | null> {
    try {
      const response = await this.axios.get<SDPResponse<RequestTemplate>>(`/request_templates/${templateId}`);
      return (response.data as any).request_template || null;
    } catch (error) {
      console.warn('Could not fetch template:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Get request types (alternative to templates)
   */
  async listRequestTypes(): Promise<RequestType[]> {
    try {
      const response = await this.axios.get<SDPListResponse<RequestType>>('/request_types');
      return response.data.request_types || [];
    } catch (error) {
      console.warn('Request types endpoint not available:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Discover required fields by attempting to create a request with minimal data
   * This uses the error response to determine which fields are mandatory
   */
  async discoverRequiredFields(): Promise<{ requiredFields: string[]; fieldDetails: any }> {
    try {
      // Try to create a request with only subject
      const params = new URLSearchParams();
      params.append('input_data', JSON.stringify({
        request: {
          subject: '__TEMPLATE_DISCOVERY__'
        }
      }));

      await this.axios.post('/requests', params);
      
      // If we reach here, only subject is required
      return {
        requiredFields: ['subject'],
        fieldDetails: {}
      };
    } catch (error: any) {
      if (error.response?.data?.response_status?.messages) {
        const messages = error.response.data.response_status.messages;
        const requiredFields: string[] = [];
        const fieldDetails: any = {};

        // Parse error messages to extract required fields
        messages.forEach((msg: any) => {
          if (msg.field) {
            requiredFields.push(msg.field);
            fieldDetails[msg.field] = {
              statusCode: msg.status_code,
              type: msg.type,
              message: msg.message || 'Field is required'
            };
          }
        });

        return { requiredFields, fieldDetails };
      }
      
      throw error;
    }
  }

  /**
   * Get field metadata by analyzing the request form structure
   * This is a workaround when proper API endpoints are not available
   */
  async analyzeRequestFields(): Promise<any> {
    try {
      // Try different potential endpoints
      const endpoints = [
        '/request_fields',
        '/requests/fields',
        '/metadata/request_fields',
        '/forms/request'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await this.axios.get(endpoint);
          if (response.data) {
            return response.data;
          }
        } catch (e) {
          // Continue to next endpoint
        }
      }

      // If no endpoint works, return discovered fields
      return await this.discoverRequiredFields();
    } catch (error) {
      console.error('Failed to analyze request fields:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
}