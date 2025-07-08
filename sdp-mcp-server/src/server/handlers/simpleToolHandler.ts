/**
 * Simple tool handler for MCP tools
 * Based on working implementation patterns
 */

import { SDPClient } from '../../sdp/simpleClient.js';
import { SDPMetadataClient } from '../../sdp/metadataClient.js';
import { logger } from '../../monitoring/simpleLogging.js';

export type ToolHandler = (args: any) => Promise<any>;

/**
 * Create a simple tool handler for the given tool name
 */
export function createSimpleToolHandler(
  toolName: string,
  sdpClient: SDPClient
): ToolHandler {
  const handlers: Record<string, ToolHandler> = {
    // Request tools
    async list_requests(args: any) {
      logger.info('Executing list_requests', { args });
      
      const params: any = {
        list_info: {
          row_count: args.limit || 10,
          start_index: args.offset || 0,
        },
      };

      // Add search criteria if provided
      if (args.status) {
        params.list_info.search_criteria = [{
          field: 'status.name',
          condition: 'is',
          value: args.status,
        }];
      }

      const response = await sdpClient.requests.list(params);
      
      return {
        requests: response.requests || [],
        total_count: response.response_status?.total_count || 0,
      };
    },

    async get_request(args: any) {
      logger.info('Executing get_request', { args });
      
      if (!args.request_id) {
        throw new Error('request_id is required');
      }

      const request = await sdpClient.requests.get(args.request_id);
      return request;
    },

    async create_request(args: any) {
      logger.info('Executing create_request', { args });
      
      // Build request data
      const requestData: any = {
        subject: args.subject,
        description: args.description || '',
      };

      // Add requester
      if (args.requester_email) {
        requestData.requester = {
          email: args.requester_email,
        };
      }

      // Add other fields if provided
      if (args.priority) {
        requestData.priority = { name: args.priority };
      }

      if (args.category) {
        requestData.category = { name: args.category };
      }

      if (args.urgency) {
        requestData.urgency = { name: args.urgency };
      }

      if (args.impact) {
        requestData.impact = { name: args.impact };
      }

      const response = await sdpClient.requests.create({
        request: requestData,
      });

      return response;
    },

    async update_request(args: any) {
      logger.info('Executing update_request', { args });
      
      if (!args.request_id) {
        throw new Error('request_id is required');
      }

      const updateData: any = {};

      // Update fields if provided
      if (args.subject) updateData.subject = args.subject;
      if (args.description) updateData.description = args.description;
      if (args.priority) updateData.priority = { name: args.priority };
      if (args.status) updateData.status = { name: args.status };
      if (args.category) updateData.category = { name: args.category };

      const response = await sdpClient.requests.update(args.request_id, {
        request: updateData,
      });

      return response;
    },

    async close_request(args: any) {
      logger.info('Executing close_request', { args });
      
      if (!args.request_id) {
        throw new Error('request_id is required');
      }

      // Close the request with closure details
      const response = await sdpClient.requests.close(args.request_id, {
        closure_info: {
          closure_code: { name: args.closure_code || 'Success' },
          closure_comments: args.closure_comments || 'Request closed via MCP',
        },
      });

      return response;
    },

    // Add more tool handlers as needed...
  };

  const handler = handlers[toolName];
  if (!handler) {
    throw new Error(`No handler found for tool: ${toolName}`);
  }

  return handler;
}