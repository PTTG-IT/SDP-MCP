import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';
import type { SDPClient } from '../../sdp/client.js';
import { logger } from '../../monitoring/logging.js';
import { SDPError } from '../../utils/errors.js';

/**
 * Batch operation result
 */
interface BatchOperationResult {
  successful: number;
  failed: number;
  results: Array<{
    index: number;
    success: boolean;
    data?: any;
    error?: string;
  }>;
}

/**
 * Execute operations in batches with rate limiting
 */
async function executeBatch<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    continueOnError?: boolean;
  } = {}
): Promise<BatchOperationResult> {
  const {
    batchSize = 10,
    delayBetweenBatches = 1000,
    continueOnError = true,
  } = options;

  const results: BatchOperationResult['results'] = [];
  let successful = 0;
  let failed = 0;

  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const index = i + batchIndex;
      try {
        const data = await operation(item);
        results[index] = { index, success: true, data };
        successful++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results[index] = { index, success: false, error: errorMessage };
        failed++;
        
        if (!continueOnError) {
          throw error;
        }
      }
    });

    await Promise.all(batchPromises);

    // Delay between batches to respect rate limits
    if (i + batchSize < items.length && delayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return { successful, failed, results };
}

/**
 * Register batch operation tools
 */
export function registerBatchTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Batch Create Requests Tool
  registry.registerTool({
    tool: createTool(
      'batch_create_requests',
      'Create multiple service requests in batch',
      z.object({
        requests: z.array(z.object({
          subject: z.string(),
          description: z.string().optional(),
          requester: z.object({
            id: z.string().optional(),
            email: z.string().email().optional(),
            name: z.string().optional(),
          }).optional(),
          category: z.object({
            id: z.string().optional(),
            name: z.string().optional(),
          }).optional(),
          priority: z.object({
            id: z.string().optional(),
            name: z.string().optional(),
          }).optional(),
        })).min(1).max(100).describe('Array of requests to create (max 100)'),
        options: z.object({
          batchSize: z.number().min(1).max(20).default(10).optional(),
          delayBetweenBatches: z.number().min(0).default(1000).optional(),
          continueOnError: z.boolean().default(true).optional(),
        }).optional().describe('Batch processing options'),
      }),
      [OAUTH_SCOPES.REQUESTS_CREATE],
      'requests',
      'batch_create'
    ),
    module: 'requests',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      
      logger.info('Starting batch request creation', {
        tenantId: tenant,
        count: args.requests.length,
      });

      const result = await executeBatch(
        args.requests,
        async (requestData) => {
          const response = await client.post('/api/v3/requests', {
            request: requestData,
          });
          return response.data.request;
        },
        args.options || {}
      );

      logger.info('Batch request creation completed', {
        tenantId: tenant,
        successful: result.successful,
        failed: result.failed,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Batch Update Requests Tool
  registry.registerTool({
    tool: createTool(
      'batch_update_requests',
      'Update multiple service requests in batch',
      z.object({
        updates: z.array(z.object({
          id: z.string().describe('Request ID to update'),
          data: z.object({
            subject: z.string().optional(),
            description: z.string().optional(),
            status: z.object({
              id: z.string().optional(),
              name: z.string().optional(),
            }).optional(),
            priority: z.object({
              id: z.string().optional(),
              name: z.string().optional(),
            }).optional(),
          }).describe('Update data'),
        })).min(1).max(50).describe('Array of updates (max 50)'),
        options: z.object({
          batchSize: z.number().min(1).max(10).default(5).optional(),
          delayBetweenBatches: z.number().min(0).default(1500).optional(),
          continueOnError: z.boolean().default(true).optional(),
        }).optional(),
      }),
      [OAUTH_SCOPES.REQUESTS_UPDATE],
      'requests',
      'batch_update'
    ),
    module: 'requests',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);

      const result = await executeBatch(
        args.updates,
        async (update) => {
          const response = await client.put(`/api/v3/requests/${update.id}`, {
            request: update.data,
          });
          return response.data.request;
        },
        args.options || {}
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Batch Close Requests Tool
  registry.registerTool({
    tool: createTool(
      'batch_close_requests',
      'Close multiple service requests in batch',
      z.object({
        closures: z.array(z.object({
          id: z.string().describe('Request ID to close'),
          closure_code: z.object({
            id: z.string().optional(),
            name: z.string().optional(),
          }).optional(),
          closure_comments: z.string().optional(),
        })).min(1).max(50).describe('Array of requests to close (max 50)'),
        options: z.object({
          batchSize: z.number().min(1).max(10).default(5).optional(),
          delayBetweenBatches: z.number().min(0).default(1500).optional(),
          continueOnError: z.boolean().default(true).optional(),
        }).optional(),
      }),
      [OAUTH_SCOPES.REQUESTS_UPDATE],
      'requests',
      'batch_close'
    ),
    module: 'requests',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);

      const result = await executeBatch(
        args.closures,
        async (closure) => {
          const response = await client.post(`/api/v3/requests/${closure.id}/close`, {
            request: {
              closure_code: closure.closure_code,
              closure_comments: closure.closure_comments,
            },
          });
          return response.data.request;
        },
        args.options || {}
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Batch Delete Assets Tool
  registry.registerTool({
    tool: createTool(
      'batch_delete_assets',
      'Delete multiple assets in batch',
      z.object({
        asset_ids: z.array(z.string()).min(1).max(50).describe('Array of asset IDs to delete (max 50)'),
        options: z.object({
          batchSize: z.number().min(1).max(10).default(5).optional(),
          delayBetweenBatches: z.number().min(0).default(2000).optional(),
          continueOnError: z.boolean().default(true).optional(),
        }).optional(),
      }),
      [OAUTH_SCOPES.ASSETS_DELETE],
      'assets',
      'batch_delete'
    ),
    module: 'assets',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);

      const result = await executeBatch(
        args.asset_ids,
        async (assetId) => {
          await client.delete(`/api/v3/assets/${assetId}`);
          return { id: assetId, deleted: true };
        },
        args.options || {}
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Batch Assign Assets Tool
  registry.registerTool({
    tool: createTool(
      'batch_assign_assets',
      'Assign multiple assets to users in batch',
      z.object({
        assignments: z.array(z.object({
          asset_id: z.string(),
          user: z.object({
            id: z.string().optional(),
            email: z.string().email().optional(),
          }),
        })).min(1).max(50).describe('Array of asset assignments (max 50)'),
        options: z.object({
          batchSize: z.number().min(1).max(10).default(5).optional(),
          delayBetweenBatches: z.number().min(0).default(1500).optional(),
          continueOnError: z.boolean().default(true).optional(),
        }).optional(),
      }),
      [OAUTH_SCOPES.ASSETS_UPDATE],
      'assets',
      'batch_assign'
    ),
    module: 'assets',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);

      const result = await executeBatch(
        args.assignments,
        async (assignment) => {
          const response = await client.put(`/api/v3/assets/${assignment.asset_id}`, {
            asset: {
              user: assignment.user,
            },
          });
          return response.data.asset;
        },
        args.options || {}
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Batch Create Tasks Tool
  registry.registerTool({
    tool: createTool(
      'batch_create_project_tasks',
      'Create multiple tasks in a project milestone',
      z.object({
        project_id: z.string(),
        milestone_id: z.string(),
        tasks: z.array(z.object({
          title: z.string(),
          description: z.string().optional(),
          owner: z.object({
            id: z.string().optional(),
            email: z.string().email().optional(),
          }).optional(),
          scheduled_start_time: z.string().optional(),
          scheduled_end_time: z.string().optional(),
          estimated_effort: z.number().optional(),
        })).min(1).max(50).describe('Array of tasks to create (max 50)'),
        options: z.object({
          batchSize: z.number().min(1).max(10).default(5).optional(),
          delayBetweenBatches: z.number().min(0).default(1500).optional(),
          continueOnError: z.boolean().default(true).optional(),
        }).optional(),
      }),
      [OAUTH_SCOPES.PROJECTS_UPDATE],
      'projects',
      'batch_create_tasks'
    ),
    module: 'projects',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);

      const result = await executeBatch(
        args.tasks,
        async (taskData) => {
          const response = await client.post(
            `/api/v3/projects/${args.project_id}/milestones/${args.milestone_id}/tasks`,
            { task: taskData }
          );
          return response.data.task;
        },
        args.options || {}
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Batch Operations Status Tool
  registry.registerTool({
    tool: createTool(
      'get_batch_operation_tips',
      'Get tips and best practices for batch operations',
      z.object({}),
      [], // No special scopes required
      'batch',
      'tips'
    ),
    module: 'batch',
    handler: async (_args: any, _context: ToolContext): Promise<ToolResult> => {
      const tips = {
        best_practices: [
          'Use batch operations for bulk data processing to improve performance',
          'Default batch size is optimized for rate limits - only change if needed',
          'Enable continueOnError to process all items even if some fail',
          'Monitor the results array to identify which operations failed',
          'Respect rate limits by using appropriate delays between batches',
        ],
        recommended_limits: {
          create_operations: { max_items: 100, recommended_batch_size: 10 },
          update_operations: { max_items: 50, recommended_batch_size: 5 },
          delete_operations: { max_items: 50, recommended_batch_size: 5 },
        },
        performance_tips: [
          'Batch operations are faster than individual API calls',
          'Use smaller batch sizes for operations that modify critical data',
          'Increase delay between batches if you encounter rate limit errors',
        ],
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tips, null, 2),
        }],
      };
    },
  });
}