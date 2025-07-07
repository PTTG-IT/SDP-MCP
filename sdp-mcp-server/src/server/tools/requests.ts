import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';
import { RequestsAPI } from '../../sdp/modules/requests.js';
import {
  CreateRequestSchema,
  UpdateRequestSchema,
  CloseRequestSchema,
  ListRequestParamsSchema,
} from '../../sdp/schemas/requests.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';

/**
 * Register request management tools
 */
export function registerRequestTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Create Request Tool
  registry.registerTool({
    tool: createTool(
      'create_request',
      'Create a new service request in Service Desk Plus',
      CreateRequestSchema,
      [OAUTH_SCOPES.REQUESTS_CREATE],
      'requests',
      'create'
    ),
    module: 'requests',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.create(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => CreateRequestSchema.safeParse(args).success,
  });

  // Get Request Tool
  registry.registerTool({
    tool: createTool(
      'get_request',
      'Get details of a specific request',
      z.object({
        id: z.string().describe('The request ID'),
      }),
      [OAUTH_SCOPES.REQUESTS_READ],
      'requests',
      'get'
    ),
    module: 'requests',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.get(args.id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Update Request Tool
  registry.registerTool({
    tool: createTool(
      'update_request',
      'Update an existing request',
      z.object({
        id: z.string().describe('The request ID'),
        data: UpdateRequestSchema.describe('The update data'),
      }),
      [OAUTH_SCOPES.REQUESTS_UPDATE],
      'requests',
      'update'
    ),
    module: 'requests',
    handler: async (args: { id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.update(args.id, args.data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => {
      const schema = z.object({
        id: z.string(),
        data: UpdateRequestSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // Delete Request Tool
  registry.registerTool({
    tool: createTool(
      'delete_request',
      'Delete a request',
      z.object({
        id: z.string().describe('The request ID'),
      }),
      [OAUTH_SCOPES.REQUESTS_DELETE],
      'requests',
      'delete'
    ),
    module: 'requests',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      await requestsAPI.delete(args.id);
      
      return {
        content: [{
          type: 'text',
          text: `Request ${args.id} deleted successfully`,
        }],
      };
    },
  });

  // List Requests Tool
  registry.registerTool({
    tool: createTool(
      'list_requests',
      'List requests with optional filtering and pagination',
      ListRequestParamsSchema,
      [OAUTH_SCOPES.REQUESTS_READ],
      'requests',
      'list'
    ),
    module: 'requests',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.list(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => ListRequestParamsSchema.safeParse(args).success,
  });

  // Close Request Tool
  registry.registerTool({
    tool: createTool(
      'close_request',
      'Close a request with optional closure details',
      z.object({
        id: z.string().describe('The request ID'),
        data: CloseRequestSchema.optional().describe('Closure details'),
      }),
      [OAUTH_SCOPES.REQUESTS_UPDATE],
      'requests',
      'close'
    ),
    module: 'requests',
    handler: async (args: { id: string; data?: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.close(args.id, args.data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => {
      const schema = z.object({
        id: z.string(),
        data: CloseRequestSchema.optional(),
      });
      return schema.safeParse(args).success;
    },
  });

  // Pickup Request Tool
  registry.registerTool({
    tool: createTool(
      'pickup_request',
      'Pickup a request (assign to current technician)',
      z.object({
        id: z.string().describe('The request ID'),
        technician: z.object({
          id: z.string().optional(),
          email: z.string().email().optional(),
        }).optional().describe('Specific technician to assign (optional)'),
      }),
      [OAUTH_SCOPES.REQUESTS_UPDATE],
      'requests',
      'pickup'
    ),
    module: 'requests',
    handler: async (args: { id: string; technician?: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.pickup(args.id, { technician: args.technician });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Search Requests Tool
  registry.registerTool({
    tool: createTool(
      'search_requests',
      'Search requests by various criteria',
      z.object({
        criteria: z.record(z.string(), z.any()).describe('Search criteria as key-value pairs'),
      }),
      [OAUTH_SCOPES.REQUESTS_READ],
      'requests',
      'search'
    ),
    module: 'requests',
    handler: async (args: { criteria: Record<string, any> }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.search(args.criteria);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Get Request Statistics Tool
  registry.registerTool({
    tool: createTool(
      'get_request_statistics',
      'Get statistics about requests (open, closed, overdue, etc.)',
      z.object({}),
      [OAUTH_SCOPES.REQUESTS_READ],
      'requests',
      'statistics'
    ),
    module: 'requests',
    handler: async (_args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const requestsAPI = new RequestsAPI(client);
      
      const result = await requestsAPI.getStatistics();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });
}