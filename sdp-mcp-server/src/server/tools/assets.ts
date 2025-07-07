import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';
import { AssetsAPI } from '../../sdp/modules/assets.js';
import {
  CreateAssetSchema,
  UpdateAssetSchema,
  ListAssetParamsSchema,
} from '../../sdp/schemas/assets.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';

/**
 * Register asset management tools
 */
export function registerAssetTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Create Asset Tool
  registry.registerTool({
    tool: createTool(
      'create_asset',
      'Create a new asset in Service Desk Plus',
      CreateAssetSchema,
      [OAUTH_SCOPES.ASSETS_CREATE],
      'assets',
      'create'
    ),
    module: 'assets',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.create(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => CreateAssetSchema.safeParse(args).success,
  });

  // Get Asset Tool
  registry.registerTool({
    tool: createTool(
      'get_asset',
      'Get details of a specific asset',
      z.object({
        id: z.string().describe('The asset ID'),
      }),
      [OAUTH_SCOPES.ASSETS_READ],
      'assets',
      'get'
    ),
    module: 'assets',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.get(args.id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Update Asset Tool
  registry.registerTool({
    tool: createTool(
      'update_asset',
      'Update an existing asset',
      z.object({
        id: z.string().describe('The asset ID'),
        data: UpdateAssetSchema.describe('The update data'),
      }),
      [OAUTH_SCOPES.ASSETS_UPDATE],
      'assets',
      'update'
    ),
    module: 'assets',
    handler: async (args: { id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.update(args.id, args.data);
      
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
        data: UpdateAssetSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // Delete Asset Tool
  registry.registerTool({
    tool: createTool(
      'delete_asset',
      'Delete an asset',
      z.object({
        id: z.string().describe('The asset ID'),
      }),
      [OAUTH_SCOPES.ASSETS_DELETE],
      'assets',
      'delete'
    ),
    module: 'assets',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      await assetsAPI.delete(args.id);
      
      return {
        content: [{
          type: 'text',
          text: `Asset ${args.id} deleted successfully`,
        }],
      };
    },
  });

  // List Assets Tool
  registry.registerTool({
    tool: createTool(
      'list_assets',
      'List assets with optional filtering and pagination',
      ListAssetParamsSchema,
      [OAUTH_SCOPES.ASSETS_READ],
      'assets',
      'list'
    ),
    module: 'assets',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.list(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => ListAssetParamsSchema.safeParse(args).success,
  });

  // List Computers Tool
  registry.registerTool({
    tool: createTool(
      'list_asset_computers',
      'List computer assets specifically',
      z.object({
        limit: z.number().optional().describe('Number of results to return'),
        offset: z.number().optional().describe('Offset for pagination'),
        filter: z.string().optional().describe('Filter criteria'),
      }),
      [OAUTH_SCOPES.ASSETS_READ],
      'assets',
      'list_computers'
    ),
    module: 'assets',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.listComputers(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Assign Asset to User Tool
  registry.registerTool({
    tool: createTool(
      'assign_asset_to_user',
      'Assign an asset to a user',
      z.object({
        asset_id: z.string().describe('The asset ID'),
        user: z.object({
          id: z.string().optional(),
          email: z.string().email().optional(),
        }).describe('User to assign the asset to'),
      }),
      [OAUTH_SCOPES.ASSETS_UPDATE],
      'assets',
      'assign_user'
    ),
    module: 'assets',
    handler: async (args: { asset_id: string; user: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.assignToUser(args.asset_id, args.user);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Update Asset State Tool
  registry.registerTool({
    tool: createTool(
      'update_asset_state',
      'Update the state of an asset (In Use, In Store, In Repair, etc.)',
      z.object({
        asset_id: z.string().describe('The asset ID'),
        state: z.enum(['In Use', 'In Store', 'In Repair', 'Expired', 'Disposed']).describe('New asset state'),
      }),
      [OAUTH_SCOPES.ASSETS_UPDATE],
      'assets',
      'update_state'
    ),
    module: 'assets',
    handler: async (args: { asset_id: string; state: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.updateState(args.asset_id, args.state);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Link Asset to Request Tool
  registry.registerTool({
    tool: createTool(
      'link_asset_to_request',
      'Link an asset to a service request',
      z.object({
        asset_id: z.string().describe('The asset ID'),
        request_id: z.string().describe('The request ID to link to'),
      }),
      [OAUTH_SCOPES.ASSETS_UPDATE],
      'assets',
      'link_request'
    ),
    module: 'assets',
    handler: async (args: { asset_id: string; request_id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.linkToRequest(args.asset_id, args.request_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Get Asset History Tool
  registry.registerTool({
    tool: createTool(
      'get_asset_history',
      'Get the history of changes for an asset',
      z.object({
        asset_id: z.string().describe('The asset ID'),
      }),
      [OAUTH_SCOPES.ASSETS_READ],
      'assets',
      'get_history'
    ),
    module: 'assets',
    handler: async (args: { asset_id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.getHistory(args.asset_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Search Assets Tool
  registry.registerTool({
    tool: createTool(
      'search_assets',
      'Search assets by various criteria',
      z.object({
        criteria: z.record(z.string(), z.any()).describe('Search criteria as key-value pairs'),
      }),
      [OAUTH_SCOPES.ASSETS_READ],
      'assets',
      'search'
    ),
    module: 'assets',
    handler: async (args: { criteria: Record<string, any> }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.search(args.criteria);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Get Asset Statistics Tool
  registry.registerTool({
    tool: createTool(
      'get_asset_statistics',
      'Get statistics about assets (by type, state, location, etc.)',
      z.object({}),
      [OAUTH_SCOPES.ASSETS_READ],
      'assets',
      'statistics'
    ),
    module: 'assets',
    handler: async (_args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.getStatistics();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Import Assets Tool (CSV)
  registry.registerTool({
    tool: createTool(
      'import_assets_csv',
      'Import multiple assets from CSV data',
      z.object({
        csv_data: z.string().describe('CSV data with headers'),
        asset_type: z.string().describe('Type of assets being imported'),
      }),
      [OAUTH_SCOPES.ASSETS_CREATE],
      'assets',
      'import_csv'
    ),
    module: 'assets',
    handler: async (args: { csv_data: string; asset_type: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const assetsAPI = new AssetsAPI(client);
      
      const result = await assetsAPI.importCSV(args.csv_data, args.asset_type);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });
}