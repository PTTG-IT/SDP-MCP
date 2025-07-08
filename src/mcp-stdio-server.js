#!/usr/bin/env node

/**
 * MCP STDIO Server for Service Desk Plus
 * This runs as a subprocess of Claude Desktop
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Define available tools
const tools = [
  {
    name: 'list_requests',
    description: 'List service desk requests',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status (open, closed, pending)',
          enum: ['open', 'closed', 'pending', 'all']
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10
        }
      }
    }
  },
  {
    name: 'get_request',
    description: 'Get details of a specific request',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'The ID of the request'
        }
      },
      required: ['request_id']
    }
  },
  {
    name: 'create_request',
    description: 'Create a new service desk request',
    inputSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Subject/title of the request'
        },
        description: {
          type: 'string',
          description: 'Detailed description'
        },
        priority: {
          type: 'string',
          description: 'Priority level',
          enum: ['low', 'medium', 'high'],
          default: 'medium'
        }
      },
      required: ['subject']
    }
  }
];

// Create server
const server = new Server(
  {
    name: 'service-desk-plus',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    // Get credentials from environment
    const clientId = process.env.SDP_CLIENT_ID;
    const clientSecret = process.env.SDP_CLIENT_SECRET;
    
    // For now, return mock data
    // TODO: Replace with actual Service Desk Plus API calls
    let result;
    
    switch (name) {
      case 'list_requests':
        result = {
          requests: [
            {
              id: '1001',
              subject: 'Sample Request 1',
              status: args.status || 'open',
              priority: 'medium',
              created_date: new Date().toISOString()
            },
            {
              id: '1002',
              subject: 'Sample Request 2',
              status: args.status || 'open',
              priority: 'high',
              created_date: new Date().toISOString()
            }
          ],
          total_count: 2,
          client_info: clientId ? `Using client: ${clientId.substring(0, 10)}...` : 'No client ID'
        };
        break;
        
      case 'get_request':
        result = {
          id: args.request_id,
          subject: `Request ${args.request_id}`,
          description: 'This is a detailed description of the request',
          status: 'open',
          priority: 'medium',
          requester: 'user@example.com',
          created_date: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };
        break;
        
      case 'create_request':
        result = {
          id: Date.now().toString(),
          subject: args.subject,
          description: args.description || '',
          priority: args.priority || 'medium',
          status: 'open',
          created_date: new Date().toISOString(),
          message: 'Request created successfully (mock)'
        };
        break;
        
      default:
        throw new Error(`Tool ${name} not implemented`);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr so it doesn't interfere with protocol
  console.error('Service Desk Plus MCP server running (stdio mode)');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});