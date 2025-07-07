import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';
import { ProblemsAPI } from '../../sdp/modules/problems.js';
import {
  CreateProblemSchema,
  UpdateProblemSchema,
  ListProblemParamsSchema,
} from '../../sdp/schemas/problems.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';

/**
 * Register problem management tools
 */
export function registerProblemTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Create Problem Tool
  registry.registerTool({
    tool: createTool(
      'create_problem',
      'Create a new problem in Service Desk Plus',
      CreateProblemSchema,
      [OAUTH_SCOPES.PROBLEMS_CREATE],
      'problems',
      'create'
    ),
    module: 'problems',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.create(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => CreateProblemSchema.safeParse(args).success,
  });

  // Get Problem Tool
  registry.registerTool({
    tool: createTool(
      'get_problem',
      'Get details of a specific problem',
      z.object({
        id: z.string().describe('The problem ID'),
      }),
      [OAUTH_SCOPES.PROBLEMS_READ],
      'problems',
      'get'
    ),
    module: 'problems',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.get(args.id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Update Problem Tool
  registry.registerTool({
    tool: createTool(
      'update_problem',
      'Update an existing problem',
      z.object({
        id: z.string().describe('The problem ID'),
        data: UpdateProblemSchema.describe('The update data'),
      }),
      [OAUTH_SCOPES.PROBLEMS_UPDATE],
      'problems',
      'update'
    ),
    module: 'problems',
    handler: async (args: { id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.update(args.id, args.data);
      
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
        data: UpdateProblemSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // Delete Problem Tool
  registry.registerTool({
    tool: createTool(
      'delete_problem',
      'Delete a problem',
      z.object({
        id: z.string().describe('The problem ID'),
      }),
      [OAUTH_SCOPES.PROBLEMS_DELETE],
      'problems',
      'delete'
    ),
    module: 'problems',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      await problemsAPI.delete(args.id);
      
      return {
        content: [{
          type: 'text',
          text: `Problem ${args.id} deleted successfully`,
        }],
      };
    },
  });

  // List Problems Tool
  registry.registerTool({
    tool: createTool(
      'list_problems',
      'List problems with optional filtering and pagination',
      ListProblemParamsSchema,
      [OAUTH_SCOPES.PROBLEMS_READ],
      'problems',
      'list'
    ),
    module: 'problems',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.list(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => ListProblemParamsSchema.safeParse(args).success,
  });

  // Analyze Root Cause Tool
  registry.registerTool({
    tool: createTool(
      'analyze_problem_root_cause',
      'Analyze root cause for a problem',
      z.object({
        id: z.string().describe('The problem ID'),
        analysis: z.object({
          root_cause: z.string().describe('Root cause description'),
          impact_assessment: z.string().optional().describe('Impact assessment'),
          resolution_steps: z.array(z.string()).optional().describe('Resolution steps'),
          preventive_measures: z.array(z.string()).optional().describe('Preventive measures'),
        }).describe('Root cause analysis details'),
      }),
      [OAUTH_SCOPES.PROBLEMS_UPDATE],
      'problems',
      'analyze'
    ),
    module: 'problems',
    handler: async (args: { id: string; analysis: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.updateAnalysis(args.id, args.analysis);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Link Related Incidents Tool
  registry.registerTool({
    tool: createTool(
      'link_incidents_to_problem',
      'Link related incidents to a problem',
      z.object({
        id: z.string().describe('The problem ID'),
        incident_ids: z.array(z.string()).describe('Array of incident IDs to link'),
      }),
      [OAUTH_SCOPES.PROBLEMS_UPDATE],
      'problems',
      'link_incidents'
    ),
    module: 'problems',
    handler: async (args: { id: string; incident_ids: string[] }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.linkIncidents(args.id, args.incident_ids);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Search Problems Tool
  registry.registerTool({
    tool: createTool(
      'search_problems',
      'Search problems by various criteria',
      z.object({
        criteria: z.record(z.string(), z.any()).describe('Search criteria as key-value pairs'),
      }),
      [OAUTH_SCOPES.PROBLEMS_READ],
      'problems',
      'search'
    ),
    module: 'problems',
    handler: async (args: { criteria: Record<string, any> }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.search(args.criteria);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Get Problem Statistics Tool
  registry.registerTool({
    tool: createTool(
      'get_problem_statistics',
      'Get statistics about problems (open, solved, recurring, etc.)',
      z.object({}),
      [OAUTH_SCOPES.PROBLEMS_READ],
      'problems',
      'statistics'
    ),
    module: 'problems',
    handler: async (_args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const problemsAPI = new ProblemsAPI(client);
      
      const result = await problemsAPI.getStatistics();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });
}