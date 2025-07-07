import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';
import { ChangesAPI } from '../../sdp/modules/changes.js';
import {
  CreateChangeSchema,
  UpdateChangeSchema,
  ListChangeParamsSchema,
} from '../../sdp/schemas/changes.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';

/**
 * Register change management tools
 */
export function registerChangeTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Create Change Tool
  registry.registerTool({
    tool: createTool(
      'create_change',
      'Create a new change request in Service Desk Plus',
      CreateChangeSchema,
      [OAUTH_SCOPES.CHANGES_CREATE],
      'changes',
      'create'
    ),
    module: 'changes',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.create(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => CreateChangeSchema.safeParse(args).success,
  });

  // Get Change Tool
  registry.registerTool({
    tool: createTool(
      'get_change',
      'Get details of a specific change',
      z.object({
        id: z.string().describe('The change ID'),
      }),
      [OAUTH_SCOPES.CHANGES_READ],
      'changes',
      'get'
    ),
    module: 'changes',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.get(args.id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Update Change Tool
  registry.registerTool({
    tool: createTool(
      'update_change',
      'Update an existing change',
      z.object({
        id: z.string().describe('The change ID'),
        data: UpdateChangeSchema.describe('The update data'),
      }),
      [OAUTH_SCOPES.CHANGES_UPDATE],
      'changes',
      'update'
    ),
    module: 'changes',
    handler: async (args: { id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.update(args.id, args.data);
      
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
        data: UpdateChangeSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // Delete Change Tool
  registry.registerTool({
    tool: createTool(
      'delete_change',
      'Delete a change',
      z.object({
        id: z.string().describe('The change ID'),
      }),
      [OAUTH_SCOPES.CHANGES_DELETE],
      'changes',
      'delete'
    ),
    module: 'changes',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      await changesAPI.delete(args.id);
      
      return {
        content: [{
          type: 'text',
          text: `Change ${args.id} deleted successfully`,
        }],
      };
    },
  });

  // List Changes Tool
  registry.registerTool({
    tool: createTool(
      'list_changes',
      'List changes with optional filtering and pagination',
      ListChangeParamsSchema,
      [OAUTH_SCOPES.CHANGES_READ],
      'changes',
      'list'
    ),
    module: 'changes',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.list(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => ListChangeParamsSchema.safeParse(args).success,
  });

  // Submit Change for Approval Tool
  registry.registerTool({
    tool: createTool(
      'submit_change_for_approval',
      'Submit a change for approval',
      z.object({
        id: z.string().describe('The change ID'),
        approval_comments: z.string().optional().describe('Comments for approvers'),
      }),
      [OAUTH_SCOPES.CHANGES_UPDATE],
      'changes',
      'submit_approval'
    ),
    module: 'changes',
    handler: async (args: { id: string; approval_comments?: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.submitForApproval(args.id, { comments: args.approval_comments });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Approve Change Tool
  registry.registerTool({
    tool: createTool(
      'approve_change',
      'Approve a change request',
      z.object({
        id: z.string().describe('The change ID'),
        approval_id: z.string().describe('The approval ID'),
        comments: z.string().optional().describe('Approval comments'),
      }),
      [OAUTH_SCOPES.CHANGES_APPROVE],
      'changes',
      'approve'
    ),
    module: 'changes',
    handler: async (args: { id: string; approval_id: string; comments?: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.approve(args.id, args.approval_id, { comments: args.comments });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Reject Change Tool
  registry.registerTool({
    tool: createTool(
      'reject_change',
      'Reject a change request',
      z.object({
        id: z.string().describe('The change ID'),
        approval_id: z.string().describe('The approval ID'),
        reason: z.string().describe('Rejection reason'),
      }),
      [OAUTH_SCOPES.CHANGES_APPROVE],
      'changes',
      'reject'
    ),
    module: 'changes',
    handler: async (args: { id: string; approval_id: string; reason: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.reject(args.id, args.approval_id, { reason: args.reason });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Schedule Change Implementation Tool
  registry.registerTool({
    tool: createTool(
      'schedule_change_implementation',
      'Schedule the implementation of a change',
      z.object({
        id: z.string().describe('The change ID'),
        scheduled_start: z.string().describe('Scheduled start time (ISO 8601)'),
        scheduled_end: z.string().describe('Scheduled end time (ISO 8601)'),
        implementation_plan: z.string().optional().describe('Implementation plan details'),
        rollback_plan: z.string().optional().describe('Rollback plan details'),
      }),
      [OAUTH_SCOPES.CHANGES_UPDATE],
      'changes',
      'schedule'
    ),
    module: 'changes',
    handler: async (args: { id: string; scheduled_start: string; scheduled_end: string; implementation_plan?: string; rollback_plan?: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.schedule(args.id, {
        scheduled_start: args.scheduled_start,
        scheduled_end: args.scheduled_end,
        implementation_plan: args.implementation_plan,
        rollback_plan: args.rollback_plan,
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Complete Change Tool
  registry.registerTool({
    tool: createTool(
      'complete_change',
      'Mark a change as completed',
      z.object({
        id: z.string().describe('The change ID'),
        completion_notes: z.string().optional().describe('Completion notes'),
        actual_start: z.string().optional().describe('Actual start time (ISO 8601)'),
        actual_end: z.string().optional().describe('Actual end time (ISO 8601)'),
      }),
      [OAUTH_SCOPES.CHANGES_UPDATE],
      'changes',
      'complete'
    ),
    module: 'changes',
    handler: async (args: { id: string; completion_notes?: string; actual_start?: string; actual_end?: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.complete(args.id, {
        notes: args.completion_notes,
        actual_start: args.actual_start,
        actual_end: args.actual_end,
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Search Changes Tool
  registry.registerTool({
    tool: createTool(
      'search_changes',
      'Search changes by various criteria',
      z.object({
        criteria: z.record(z.string(), z.any()).describe('Search criteria as key-value pairs'),
      }),
      [OAUTH_SCOPES.CHANGES_READ],
      'changes',
      'search'
    ),
    module: 'changes',
    handler: async (args: { criteria: Record<string, any> }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.search(args.criteria);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Get Change Statistics Tool
  registry.registerTool({
    tool: createTool(
      'get_change_statistics',
      'Get statistics about changes (pending approval, scheduled, completed, etc.)',
      z.object({}),
      [OAUTH_SCOPES.CHANGES_READ],
      'changes',
      'statistics'
    ),
    module: 'changes',
    handler: async (_args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const changesAPI = new ChangesAPI(client);
      
      const result = await changesAPI.getStatistics();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });
}