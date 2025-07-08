/**
 * Simple tool definitions for MCP
 * Based on working implementation
 */

import { z } from 'zod';

export interface Tool {
  name: string;
  description: string;
  schema: z.ZodSchema<any>;
}

export const tools: Tool[] = [
  // Request Management Tools
  {
    name: 'list_requests',
    description: 'List service desk requests with optional filters',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of requests to return (default: 10)'),
      offset: z.number().optional().describe('Number of requests to skip (default: 0)'),
      status: z.string().optional().describe('Filter by status (e.g., "Open", "Closed")'),
      requester_email: z.string().optional().describe('Filter by requester email'),
      technician_email: z.string().optional().describe('Filter by assigned technician email'),
      priority: z.string().optional().describe('Filter by priority (e.g., "High", "Medium", "Low")'),
    }),
  },
  
  {
    name: 'get_request',
    description: 'Get details of a specific request by ID',
    schema: z.object({
      request_id: z.string().describe('The ID of the request to retrieve'),
    }),
  },
  
  {
    name: 'create_request',
    description: 'Create a new service desk request',
    schema: z.object({
      subject: z.string().describe('Subject/title of the request'),
      description: z.string().optional().describe('Detailed description of the request'),
      requester_email: z.string().describe('Email of the person making the request'),
      priority: z.string().optional().describe('Priority level (e.g., "High", "Medium", "Low")'),
      category: z.string().optional().describe('Category of the request'),
      urgency: z.string().optional().describe('Urgency level'),
      impact: z.string().optional().describe('Impact level'),
    }),
  },
  
  {
    name: 'update_request',
    description: 'Update an existing request',
    schema: z.object({
      request_id: z.string().describe('The ID of the request to update'),
      subject: z.string().optional().describe('New subject/title'),
      description: z.string().optional().describe('New description'),
      status: z.string().optional().describe('New status'),
      priority: z.string().optional().describe('New priority'),
      category: z.string().optional().describe('New category'),
      technician_email: z.string().optional().describe('Email of technician to assign'),
    }),
  },
  
  {
    name: 'close_request',
    description: 'Close a request with resolution details',
    schema: z.object({
      request_id: z.string().describe('The ID of the request to close'),
      closure_code: z.string().optional().describe('Closure code (default: "Success")'),
      closure_comments: z.string().optional().describe('Comments about the resolution'),
    }),
  },

  // Problem Management Tools
  {
    name: 'list_problems',
    description: 'List problems with optional filters',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of problems to return'),
      offset: z.number().optional().describe('Number of problems to skip'),
      status: z.string().optional().describe('Filter by status'),
    }),
  },

  {
    name: 'get_problem',
    description: 'Get details of a specific problem',
    schema: z.object({
      problem_id: z.string().describe('The ID of the problem to retrieve'),
    }),
  },

  {
    name: 'create_problem',
    description: 'Create a new problem record',
    schema: z.object({
      title: z.string().describe('Title of the problem'),
      description: z.string().optional().describe('Detailed description'),
      impact: z.string().optional().describe('Impact level'),
      urgency: z.string().optional().describe('Urgency level'),
    }),
  },

  // Change Management Tools
  {
    name: 'list_changes',
    description: 'List change requests with optional filters',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of changes to return'),
      offset: z.number().optional().describe('Number of changes to skip'),
      status: z.string().optional().describe('Filter by status'),
      change_type: z.string().optional().describe('Filter by type (e.g., "Normal", "Emergency")'),
    }),
  },

  {
    name: 'get_change',
    description: 'Get details of a specific change request',
    schema: z.object({
      change_id: z.string().describe('The ID of the change to retrieve'),
    }),
  },

  {
    name: 'create_change',
    description: 'Create a new change request',
    schema: z.object({
      title: z.string().describe('Title of the change'),
      description: z.string().optional().describe('Detailed description'),
      change_type: z.string().optional().describe('Type of change (e.g., "Normal", "Emergency")'),
      impact: z.string().optional().describe('Impact level'),
      risk: z.string().optional().describe('Risk level'),
    }),
  },

  // Project Management Tools
  {
    name: 'list_projects',
    description: 'List projects with optional filters',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of projects to return'),
      offset: z.number().optional().describe('Number of projects to skip'),
      status: z.string().optional().describe('Filter by status'),
    }),
  },

  {
    name: 'get_project',
    description: 'Get details of a specific project',
    schema: z.object({
      project_id: z.string().describe('The ID of the project to retrieve'),
    }),
  },

  // Asset Management Tools
  {
    name: 'list_assets',
    description: 'List assets with optional filters',
    schema: z.object({
      limit: z.number().optional().describe('Maximum number of assets to return'),
      offset: z.number().optional().describe('Number of assets to skip'),
      asset_type: z.string().optional().describe('Filter by asset type'),
      status: z.string().optional().describe('Filter by status'),
    }),
  },

  {
    name: 'get_asset',
    description: 'Get details of a specific asset',
    schema: z.object({
      asset_id: z.string().describe('The ID of the asset to retrieve'),
    }),
  },

  // Utility Tools
  {
    name: 'search_users',
    description: 'Search for users in the system',
    schema: z.object({
      query: z.string().describe('Search query (name or email)'),
      limit: z.number().optional().describe('Maximum results to return'),
    }),
  },

  {
    name: 'get_metadata',
    description: 'Get metadata for a specific entity type (statuses, priorities, etc.)',
    schema: z.object({
      entity_type: z.string().describe('Type of entity (e.g., "request", "problem", "change")'),
      metadata_type: z.string().describe('Type of metadata (e.g., "status", "priority", "category")'),
    }),
  },
];