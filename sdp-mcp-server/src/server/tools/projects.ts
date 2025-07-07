import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';
import { ProjectsAPI } from '../../sdp/modules/projects.js';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateMilestoneSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  ListProjectParamsSchema,
} from '../../sdp/schemas/projects.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';

/**
 * Register project management tools
 */
export function registerProjectTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Create Project Tool
  registry.registerTool({
    tool: createTool(
      'create_project',
      'Create a new project in Service Desk Plus',
      CreateProjectSchema,
      [OAUTH_SCOPES.PROJECTS_CREATE],
      'projects',
      'create'
    ),
    module: 'projects',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.create(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => CreateProjectSchema.safeParse(args).success,
  });

  // Get Project Tool
  registry.registerTool({
    tool: createTool(
      'get_project',
      'Get details of a specific project',
      z.object({
        id: z.string().describe('The project ID'),
      }),
      [OAUTH_SCOPES.PROJECTS_READ],
      'projects',
      'get'
    ),
    module: 'projects',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.get(args.id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Update Project Tool
  registry.registerTool({
    tool: createTool(
      'update_project',
      'Update an existing project',
      z.object({
        id: z.string().describe('The project ID'),
        data: UpdateProjectSchema.describe('The update data'),
      }),
      [OAUTH_SCOPES.PROJECTS_UPDATE],
      'projects',
      'update'
    ),
    module: 'projects',
    handler: async (args: { id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.update(args.id, args.data);
      
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
        data: UpdateProjectSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // Delete Project Tool
  registry.registerTool({
    tool: createTool(
      'delete_project',
      'Delete a project',
      z.object({
        id: z.string().describe('The project ID'),
      }),
      [OAUTH_SCOPES.PROJECTS_DELETE],
      'projects',
      'delete'
    ),
    module: 'projects',
    handler: async (args: { id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      await projectsAPI.delete(args.id);
      
      return {
        content: [{
          type: 'text',
          text: `Project ${args.id} deleted successfully`,
        }],
      };
    },
  });

  // List Projects Tool
  registry.registerTool({
    tool: createTool(
      'list_projects',
      'List projects with optional filtering and pagination',
      ListProjectParamsSchema,
      [OAUTH_SCOPES.PROJECTS_READ],
      'projects',
      'list'
    ),
    module: 'projects',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.list(args);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => ListProjectParamsSchema.safeParse(args).success,
  });

  // Create Milestone Tool
  registry.registerTool({
    tool: createTool(
      'create_project_milestone',
      'Create a new milestone in a project',
      z.object({
        project_id: z.string().describe('The project ID'),
        data: CreateMilestoneSchema.describe('Milestone data'),
      }),
      [OAUTH_SCOPES.PROJECTS_UPDATE],
      'projects',
      'create_milestone'
    ),
    module: 'projects',
    handler: async (args: { project_id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.createMilestone(args.project_id, args.data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => {
      const schema = z.object({
        project_id: z.string(),
        data: CreateMilestoneSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // List Milestones Tool
  registry.registerTool({
    tool: createTool(
      'list_project_milestones',
      'List milestones for a project',
      z.object({
        project_id: z.string().describe('The project ID'),
      }),
      [OAUTH_SCOPES.PROJECTS_READ],
      'projects',
      'list_milestones'
    ),
    module: 'projects',
    handler: async (args: { project_id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.listMilestones(args.project_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Create Task Tool
  registry.registerTool({
    tool: createTool(
      'create_project_task',
      'Create a new task in a project milestone',
      z.object({
        project_id: z.string().describe('The project ID'),
        milestone_id: z.string().describe('The milestone ID'),
        data: CreateTaskSchema.describe('Task data'),
      }),
      [OAUTH_SCOPES.PROJECTS_UPDATE],
      'projects',
      'create_task'
    ),
    module: 'projects',
    handler: async (args: { project_id: string; milestone_id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.createTask(args.project_id, args.milestone_id, args.data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => {
      const schema = z.object({
        project_id: z.string(),
        milestone_id: z.string(),
        data: CreateTaskSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // List Tasks Tool
  registry.registerTool({
    tool: createTool(
      'list_project_tasks',
      'List tasks for a project milestone',
      z.object({
        project_id: z.string().describe('The project ID'),
        milestone_id: z.string().describe('The milestone ID'),
      }),
      [OAUTH_SCOPES.PROJECTS_READ],
      'projects',
      'list_tasks'
    ),
    module: 'projects',
    handler: async (args: { project_id: string; milestone_id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.listTasks(args.project_id, args.milestone_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Update Task Tool
  registry.registerTool({
    tool: createTool(
      'update_project_task',
      'Update a task in a project',
      z.object({
        project_id: z.string().describe('The project ID'),
        milestone_id: z.string().describe('The milestone ID'),
        task_id: z.string().describe('The task ID'),
        data: UpdateTaskSchema.describe('Task update data'),
      }),
      [OAUTH_SCOPES.PROJECTS_UPDATE],
      'projects',
      'update_task'
    ),
    module: 'projects',
    handler: async (args: { project_id: string; milestone_id: string; task_id: string; data: any }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.updateTask(args.project_id, args.milestone_id, args.task_id, args.data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
    validateArgs: async (args) => {
      const schema = z.object({
        project_id: z.string(),
        milestone_id: z.string(),
        task_id: z.string(),
        data: UpdateTaskSchema,
      });
      return schema.safeParse(args).success;
    },
  });

  // Complete Task Tool
  registry.registerTool({
    tool: createTool(
      'complete_project_task',
      'Mark a project task as completed',
      z.object({
        project_id: z.string().describe('The project ID'),
        milestone_id: z.string().describe('The milestone ID'),
        task_id: z.string().describe('The task ID'),
        completion_notes: z.string().optional().describe('Completion notes'),
      }),
      [OAUTH_SCOPES.PROJECTS_UPDATE],
      'projects',
      'complete_task'
    ),
    module: 'projects',
    handler: async (args: { project_id: string; milestone_id: string; task_id: string; completion_notes?: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.completeTask(args.project_id, args.milestone_id, args.task_id, {
        status: { name: 'Completed' },
        completion_notes: args.completion_notes,
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Get Project Progress Tool
  registry.registerTool({
    tool: createTool(
      'get_project_progress',
      'Get progress statistics for a project',
      z.object({
        project_id: z.string().describe('The project ID'),
      }),
      [OAUTH_SCOPES.PROJECTS_READ],
      'projects',
      'get_progress'
    ),
    module: 'projects',
    handler: async (args: { project_id: string }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.getProgress(args.project_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Search Projects Tool
  registry.registerTool({
    tool: createTool(
      'search_projects',
      'Search projects by various criteria',
      z.object({
        criteria: z.record(z.string(), z.any()).describe('Search criteria as key-value pairs'),
      }),
      [OAUTH_SCOPES.PROJECTS_READ],
      'projects',
      'search'
    ),
    module: 'projects',
    handler: async (args: { criteria: Record<string, any> }, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.search(args.criteria);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });

  // Get Project Statistics Tool
  registry.registerTool({
    tool: createTool(
      'get_project_statistics',
      'Get statistics about projects (active, completed, overdue, etc.)',
      z.object({}),
      [OAUTH_SCOPES.PROJECTS_READ],
      'projects',
      'statistics'
    ),
    module: 'projects',
    handler: async (_args: any, context: ToolContext): Promise<ToolResult> => {
      const tenant = context.tenantId;
      const client = sdpClientFactory.getClient(tenant);
      const projectsAPI = new ProjectsAPI(client);
      
      const result = await projectsAPI.getStatistics();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  });
}