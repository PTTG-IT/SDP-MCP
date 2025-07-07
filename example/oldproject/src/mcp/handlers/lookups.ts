import { getClient } from '../../utils/clientFactory.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool definitions
export const lookupTools: Tool[] = [
  {
    name: 'get_priorities',
    description: 'Get all available priority options with their IDs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_categories',
    description: 'Get all available category options with their IDs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_statuses',
    description: 'Get all available status options with their IDs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_technicians',
    description: 'Get all available technicians with their IDs and emails',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_request_types',
    description: 'Get all available request type options with their IDs',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_subcategories',
    description: 'Get subcategories for a specific category',
    inputSchema: {
      type: 'object',
      properties: {
        category_name: {
          type: 'string',
          description: 'Name of the parent category',
        },
      },
      required: ['category_name'],
    },
  },
];

// Zod schemas for validation
const subcategoriesSchema = z.object({
  category_name: z.string().describe('Name of the parent category'),
});

// Handler implementations
export const lookupHandlers = {
  get_priorities: async () => {
    const client = getClient();
    const priorities = await client.lookups.getPriorities();
    
    return {
      total: priorities.length,
      priorities: priorities.map((p: any) => ({
        id: p.id,
        name: p.name,
        color: p.color,
      })),
    };
  },

  get_categories: async () => {
    const client = getClient();
    const categories = await client.lookups.getCategories();
    
    return {
      total: categories.length,
      categories: categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        parent_category: c.parent_category?.name,
      })),
    };
  },

  get_statuses: async () => {
    const client = getClient();
    const statuses = await client.lookups.getStatuses();
    
    return {
      total: statuses.length,
      statuses: statuses.map((s: any) => ({
        id: s.id,
        name: s.name,
        stage: s.stage,
        color: s.color,
      })),
    };
  },

  get_technicians: async () => {
    const client = getClient();
    // Use the technicians API directly instead of lookups
    const response = await client.technicians.list({ per_page: 100 });
    
    return {
      total: response.technicians?.length || 0,
      technicians: (response.technicians || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        email: t.email_id || t.email,
        department: t.department?.name,
        job_title: t.job_title,
        mobile: t.mobile,
        phone: t.phone,
      })),
    };
  },

  get_request_types: async () => {
    const client = getClient();
    const requestTypes = await client.lookups.getRequestTypes();
    
    return {
      total: requestTypes.length,
      request_types: requestTypes.map((rt: any) => ({
        id: rt.id,
        name: rt.name,
        description: rt.description,
      })),
    };
  },

  get_subcategories: async (args: unknown) => {
    const { category_name } = subcategoriesSchema.parse(args);
    const client = getClient();
    
    // First find the category ID
    const categoryId = await client.lookups.findIdByName('category', category_name);
    if (!categoryId) {
      throw new Error(`Category "${category_name}" not found`);
    }
    
    const subcategories = await client.lookups.getSubcategories(categoryId);
    
    return {
      category: category_name,
      total: subcategories.length,
      subcategories: subcategories.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
    };
  },
};