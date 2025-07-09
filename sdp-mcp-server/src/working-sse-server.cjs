#!/usr/bin/env node

/**
 * MCP SSE Server with Service Desk Plus Integration
 * Full implementation with real API calls
 */

const express = require('express');
const cors = require('cors');
const { SDPAPIClientV2 } = require('./sdp-api-client-v2.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SDP API client
let sdpClient;
try {
  sdpClient = new SDPAPIClientV2({
    clientId: process.env.SDP_CLIENT_ID,
    clientSecret: process.env.SDP_CLIENT_SECRET,
    portalName: process.env.SDP_PORTAL_NAME,
    dataCenter: process.env.SDP_DATA_CENTER || 'US'
  });
  console.error('SDP API client initialized');
} catch (error) {
  console.error('Failed to initialize SDP client:', error.message);
}

// Active SSE connections
const connections = new Map();
let sessionCounter = 0;

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'mcp-sse-sdp',
    connections: connections.size,
    sdp_configured: !!sdpClient
  });
});

// SSE endpoint
app.get('/sse', (req, res) => {
  console.error('New SSE connection established');
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sessionId = `session-${Date.now()}-${++sessionCounter}`;
  connections.set(sessionId, res);
  console.error(`Session created: ${sessionId}`);

  res.write(`data: ${JSON.stringify({
    type: 'connection',
    sessionId: sessionId
  })}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    console.error(`Session closed: ${sessionId}`);
    clearInterval(keepAlive);
    connections.delete(sessionId);
  });
});

// Tool implementations with real SDP API
const toolImplementations = {
  async claude_code_command(params) {
    try {
      const { command, project_path, args = [] } = params;
      
      console.error(`Executing Claude Code command: ${command}`);
      
      // Map of allowed Claude Code commands
      const allowedCommands = {
        'open_project': 'Open a project in Claude Code',
        'create_file': 'Create a new file',
        'read_file': 'Read file contents',
        'write_file': 'Write content to file',
        'list_files': 'List files in directory',
        'run_command': 'Run a shell command',
        'git_status': 'Check git status',
        'git_commit': 'Create a git commit'
      };
      
      if (!allowedCommands[command]) {
        throw new Error(`Unknown command: ${command}. Available: ${Object.keys(allowedCommands).join(', ')}`);
      }
      
      // For now, return instructions on how to use Claude Code
      let result = {
        command,
        status: 'instructions',
        message: `To execute '${command}' in Claude Code:
`
      };
      
      switch (command) {
        case 'open_project':
          result.message += `1. Open Claude Code
2. Navigate to: ${project_path || '/Users/kalten/projects/SDP-MCP'}
3. The MCP server project is at: /Users/kalten/projects/SDP-MCP`;
          break;
          
        case 'create_file':
          result.message += `1. Use the 'Write' tool to create: ${args[0] || 'filename.js'}
2. Add content with the MCP integration`;
          break;
          
        case 'read_file':
          result.message += `1. Use the 'Read' tool for: ${args[0] || 'filename'}
2. The file content will be displayed`;
          break;
          
        case 'list_files':
          result.message += `1. Use the 'LS' tool for: ${project_path || '.'}
2. Shows all files and directories`;
          break;
          
        case 'run_command':
          result.message += `1. Use the 'Bash' tool
2. Command: ${args.join(' ') || 'npm test'}
3. See output in Claude Code terminal`;
          break;
          
        case 'git_status':
          result.message += `1. Use 'Bash' tool with: git status
2. Shows current git state`;
          break;
          
        case 'git_commit':
          result.message += `1. Stage files: git add .
2. Commit: git commit -m "${args[0] || 'Update from MCP'}"
3. Use Bash tool for both`;
          break;
          
        default:
          result.message = `Command '${command}' recognized but not implemented yet`;
      }
      
      // Add project context
      result.project_info = {
        main_project: '/Users/kalten/projects/SDP-MCP',
        server_file: '/Users/kalten/projects/SDP-MCP/src/mcp-sse-sdp-integrated.js',
        api_client: '/Users/kalten/projects/SDP-MCP/src/sdp-api-client-v2.js',
        current_directory: process.cwd()
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Claude Code command failed: ${error.message}`);
    }
  },
  
  async get_metadata(params) {
    try {
      console.error('Fetching SDP metadata...');
      
      const metadata = await sdpClient.getMetadata();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Valid values for Service Desk Plus fields',
            priorities: metadata.priorities,
            statuses: metadata.statuses,
            categories: metadata.categories.slice(0, 20), // Limit for readability
            templates: metadata.templates.slice(0, 10),
            usage_tips: {
              priority: 'Use values like: low, medium, high, urgent',
              status: 'Use values like: open, closed, pending, resolved',
              category: 'Use exact category names from the list above'
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  },
  
  async list_requests(params) {
    try {
      const { limit = 10, status, priority, sort_by, sort_order } = params;
      
      console.error(`Fetching requests: limit=${limit}, status=${status}, priority=${priority}`);
      
      const result = await sdpClient.listRequests({
        limit,
        status,
        priority,
        sortBy: sort_by,
        sortOrder: sort_order
      });
      
      // Format the response
      const formattedRequests = result.requests.map(req => ({
        id: req.id,
        subject: req.subject,
        status: req.status?.name,
        priority: req.priority?.name,
        requester: req.requester?.name || req.requester?.email_id,
        created_time: req.created_time?.display_value,
        due_date: req.due_by_time?.display_value,
        category: req.category?.name,
        subcategory: req.subcategory?.name,
        technician: req.technician?.name
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            requests: formattedRequests,
            total_count: result.total_count,
            has_more: result.has_more
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to list requests: ${error.message}`);
    }
  },
  
  async get_request(params) {
    try {
      const { request_id } = params;
      
      if (!request_id) {
        throw new Error('request_id is required');
      }
      
      console.error(`Fetching request details for ID: ${request_id}`);
      
      const request = await sdpClient.getRequest(request_id);
      
      // Format detailed response
      const formatted = {
        id: request.id,
        subject: request.subject,
        description: request.description,
        status: request.status?.name,
        priority: request.priority?.name,
        requester: {
          name: request.requester?.name,
          email: request.requester?.email_id,
          phone: request.requester?.phone
        },
        category: request.category?.name,
        subcategory: request.subcategory?.name,
        item: request.item?.name,
        technician: request.technician?.name,
        group: request.group?.name,
        created_time: request.created_time?.display_value,
        due_date: request.due_by_time?.display_value,
        completed_time: request.completed_time?.display_value,
        time_elapsed: request.time_elapsed,
        resolution: request.resolution?.content,
        closure_info: request.closure_info,
        has_notes: request.has_notes,
        has_attachments: request.has_attachments
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formatted, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get request: ${error.message}`);
    }
  },
  
  async create_request(params) {
    try {
      const { subject, description, priority, category, subcategory, requester_email, technician_id, technician_email } = params;
      
      if (!subject) {
        throw new Error('subject is required');
      }
      
      console.error(`Creating new request: ${subject}`);
      
      const requestData = {
        subject,
        description: description || ''
      };
      
      // Only add optional fields if they're provided
      if (priority) requestData.priority = priority;
      if (category) requestData.category = category;
      if (subcategory) requestData.subcategory = subcategory;
      if (requester_email) requestData.requester_email = requester_email;
      if (technician_id) requestData.technician_id = technician_id;
      if (technician_email) requestData.technician_email = technician_email;
      
      const request = await sdpClient.createRequest(requestData);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            request_id: request.id,
            subject: request.subject,
            status: request.status?.name,
            message: `Request #${request.id} created successfully`
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to create request: ${error.message}`);
    }
  },
  
  async update_request(params) {
    try {
      const { request_id, ...updates } = params;
      
      if (!request_id) {
        throw new Error('request_id is required');
      }
      
      console.error(`Updating request ${request_id}:`, updates);
      
      const request = await sdpClient.updateRequest(request_id, updates);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            request_id: request.id,
            updated_fields: Object.keys(updates),
            message: `Request #${request.id} updated successfully`
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to update request: ${error.message}`);
    }
  },
  
  async close_request(params) {
    try {
      const { request_id, closure_comments, closure_code } = params;
      
      if (!request_id) {
        throw new Error('request_id is required');
      }
      
      console.error(`Closing request ${request_id}`);
      
      const request = await sdpClient.closeRequest(request_id, {
        closure_comments: closure_comments || 'Request resolved',
        closure_code: closure_code || 'Resolved'
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            request_id: request.id,
            status: request.status?.name,
            closed_time: request.completed_time?.display_value,
            message: `Request #${request.id} closed successfully`
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to close request: ${error.message}`);
    }
  },
  
  async add_note(params) {
    try {
      const { request_id, note_content, is_public = true } = params;
      
      if (!request_id || !note_content) {
        throw new Error('request_id and note_content are required');
      }
      
      console.error(`Adding note to request ${request_id}`);
      
      const note = await sdpClient.addNote(request_id, note_content, is_public);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            note_id: note.id,
            request_id,
            added_time: note.created_time?.display_value,
            message: `Note added to request #${request_id}`
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to add note: ${error.message}`);
    }
  },
  
  async search_requests(params) {
    try {
      const { query, limit = 10 } = params;
      
      if (!query) {
        throw new Error('query is required');
      }
      
      console.error(`Searching requests for: ${query}`);
      
      const result = await sdpClient.searchRequests(query, { limit });
      
      const formattedRequests = result.requests.map(req => ({
        id: req.id,
        subject: req.subject,
        status: req.status?.name,
        priority: req.priority?.name,
        requester: req.requester?.name || req.requester?.email_id,
        created_time: req.created_time?.display_value
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query,
            results: formattedRequests,
            total_count: result.total_count
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to search requests: ${error.message}`);
    }
  },
  
  async list_technicians(params) {
    try {
      const { limit = 25, search_term } = params;
      
      console.error(`Listing technicians: limit=${limit}, search=${search_term}`);
      
      const result = await sdpClient.users.listTechnicians({
        limit,
        searchTerm: search_term
      });
      
      const formattedTechnicians = result.technicians.map(tech => ({
        id: tech.id,
        name: tech.name,
        email: tech.email_id,
        phone: tech.phone,
        mobile: tech.mobile,
        department: tech.department?.name,
        job_title: tech.job_title,
        employee_id: tech.employee_id,
        is_technician: true,
        site: tech.site?.name
      }));
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            technicians: formattedTechnicians,
            total_count: result.total_count,
            has_more: result.has_more,
            usage_hint: 'Use technician ID or email when assigning tickets'
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to list technicians: ${error.message}`);
    }
  },
  
  async get_technician(params) {
    try {
      const { technician_id } = params;
      
      if (!technician_id) {
        throw new Error('technician_id is required');
      }
      
      console.error(`Getting technician details for ID: ${technician_id}`);
      
      const technician = await sdpClient.users.getTechnician(technician_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: technician.id,
            name: technician.name,
            email: technician.email_id,
            phone: technician.phone,
            mobile: technician.mobile,
            department: technician.department,
            job_title: technician.job_title,
            employee_id: technician.employee_id,
            cost_per_hour: technician.cost_per_hour,
            site: technician.site,
            reporting_to: technician.reporting_to,
            groups: technician.associated_groups || []
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get technician: ${error.message}`);
    }
  },
  
  async find_technician(params) {
    try {
      const { search_term } = params;
      
      if (!search_term) {
        throw new Error('search_term is required');
      }
      
      // Remove mailto: prefix if present
      const cleanSearchTerm = search_term.replace(/^mailto:/i, '');
      
      console.error(`Finding technician by: ${cleanSearchTerm}`);
      
      const technician = await sdpClient.users.findTechnician(cleanSearchTerm);
      
      if (!technician) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              found: false,
              message: `No technician found matching "${search_term}"`,
              suggestion: 'Try using list_technicians to see available technicians'
            }, null, 2)
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            found: true,
            technician: {
              id: technician.id,
              name: technician.name,
              email: technician.email_id,
              department: technician.department?.name,
              usage: `Use ID "${technician.id}" or email "${technician.email_id}" to assign tickets`
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to find technician: ${error.message}`);
    }
  }
};

// Tool definitions
const tools = [
  {
    name: 'claude_code_command',
    description: 'Execute Claude Code commands or get instructions for Claude Code integration',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Command to execute',
          enum: ['open_project', 'create_file', 'read_file', 'write_file', 'list_files', 'run_command', 'git_status', 'git_commit']
        },
        project_path: {
          type: 'string',
          description: 'Path to project or file',
          default: '/Users/kalten/projects/SDP-MCP'
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional arguments for the command'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'get_metadata',
    description: 'Get valid values for priorities, statuses, categories, and templates',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_requests',
    description: 'List service desk requests with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { 
          type: 'number', 
          description: 'Maximum number of requests to return (max 100 per API limits)',
          default: 10,
          maximum: 100
        },
        status: { 
          type: 'string',
          description: 'Filter by status (e.g., open, closed, pending)',
          enum: ['open', 'closed', 'pending', 'resolved', 'cancelled']
        },
        priority: {
          type: 'string',
          description: 'Filter by priority',
          enum: ['low', 'medium', 'high', 'urgent']
        },
        sort_by: {
          type: 'string',
          description: 'Sort field',
          enum: ['created_time', 'due_by_time', 'subject', 'priority'],
          default: 'created_time'
        },
        sort_order: {
          type: 'string',
          description: 'Sort order',
          enum: ['asc', 'desc'],
          default: 'desc'
        }
      }
    }
  },
  {
    name: 'get_request',
    description: 'Get detailed information about a specific request',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { 
          type: 'string',
          description: 'The ID of the request to retrieve'
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
          description: 'Detailed description of the request'
        },
        priority: {
          type: 'string',
          description: 'Priority level',
          enum: ['low', 'medium', 'high', 'urgent'],
          default: 'medium'
        },
        category: {
          type: 'string',
          description: 'Category of the request'
        },
        subcategory: {
          type: 'string',
          description: 'Subcategory of the request (often required)'
        },
        requester_email: {
          type: 'string',
          description: 'Email of the requester'
        },
        technician_id: {
          type: 'string',
          description: 'ID of technician to assign (use list_technicians to find IDs)'
        },
        technician_email: {
          type: 'string',
          description: 'Email of technician to assign (will lookup ID automatically)'
        }
      },
      required: ['subject']
    }
  },
  {
    name: 'update_request',
    description: 'Update an existing request',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'ID of the request to update'
        },
        subject: {
          type: 'string',
          description: 'New subject'
        },
        description: {
          type: 'string',
          description: 'New description'
        },
        status: {
          type: 'string',
          description: 'New status',
          enum: ['open', 'pending', 'resolved', 'closed']
        },
        priority: {
          type: 'string',
          description: 'New priority',
          enum: ['low', 'medium', 'high', 'urgent']
        },
        category: {
          type: 'string',
          description: 'New category'
        },
        subcategory: {
          type: 'string',
          description: 'New subcategory'
        },
        technician_id: {
          type: 'string',
          description: 'ID of technician to assign'
        },
        technician_email: {
          type: 'string',
          description: 'Email of technician to assign (will lookup ID)'
        }
      },
      required: ['request_id']
    }
  },
  {
    name: 'close_request',
    description: 'Close a request with resolution details',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'ID of the request to close'
        },
        closure_comments: {
          type: 'string',
          description: 'Resolution/closure comments'
        },
        closure_code: {
          type: 'string',
          description: 'Closure code',
          enum: ['Resolved', 'Cancelled', 'Duplicate'],
          default: 'Resolved'
        }
      },
      required: ['request_id']
    }
  },
  {
    name: 'add_note',
    description: 'Add a note/comment to a request',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: {
          type: 'string',
          description: 'ID of the request'
        },
        note_content: {
          type: 'string',
          description: 'Content of the note'
        },
        is_public: {
          type: 'boolean',
          description: 'Whether the note is visible to requester',
          default: true
        }
      },
      required: ['request_id', 'note_content']
    }
  },
  {
    name: 'search_requests',
    description: 'Search requests by keyword',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (max 100 per API limits)',
          default: 10,
          maximum: 100
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_technicians',
    description: 'List available technicians for ticket assignment',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of technicians to return (max 100 per API limits)',
          default: 25,
          maximum: 100
        },
        search_term: {
          type: 'string',
          description: 'Search by name or email'
        }
      }
    }
  },
  {
    name: 'get_technician',
    description: 'Get detailed information about a specific technician',
    inputSchema: {
      type: 'object',
      properties: {
        technician_id: {
          type: 'string',
          description: 'The ID of the technician'
        }
      },
      required: ['technician_id']
    }
  },
  {
    name: 'find_technician',
    description: 'Find a technician by name or email (returns best match)',
    inputSchema: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'Name or email to search for'
        }
      },
      required: ['search_term']
    }
  }
];

// Handle JSON-RPC messages
function handleJsonRpcMessage(message, sseConnection) {
  const { method, params, id, jsonrpc } = message;
  const isNotification = id === undefined;
  
  console.error(`Received ${isNotification ? 'notification' : 'request'}: ${method}`);
  
  if (isNotification) {
    console.error(`Ignoring notification: ${method}`);
    return null;
  }
  
  try {
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'service-desk-plus',
            version: '2.0.0'
          }
        };
        break;
        
      case 'tools/list':
        result = { tools };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params || {};
        
        if (!sdpClient) {
          throw new Error('SDP client not initialized. Please check OAuth configuration.');
        }
        
        const implementation = toolImplementations[name];
        if (!implementation) {
          throw new Error(`Unknown tool: ${name}`);
        }
        
        // Execute tool asynchronously
        return implementation(args || {}).then(toolResult => ({
          jsonrpc: '2.0',
          result: toolResult,
          id
        })).catch(error => ({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message
          },
          id
        }));
        
      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          },
          id
        };
    }
    
    return {
      jsonrpc: '2.0',
      result,
      id
    };
    
  } catch (error) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id
    };
  }
}

// Message endpoint
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId || req.headers['x-session-id'];
  const sseConnection = connections.get(sessionId);
  
  if (!sseConnection) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const responsePromise = handleJsonRpcMessage(req.body, sseConnection);
  
  if (responsePromise && responsePromise.then) {
    // Handle async response
    const response = await responsePromise;
    if (response) {
      sseConnection.write(`data: ${JSON.stringify(response)}\n\n`);
    }
  } else if (responsePromise) {
    // Handle sync response
    sseConnection.write(`data: ${JSON.stringify(responsePromise)}\n\n`);
  }
  
  res.json({ status: 'ok' });
});

// Direct POST to /sse endpoint
app.post('/sse', async (req, res) => {
  console.error('Direct SSE POST received');
  
  const responsePromise = handleJsonRpcMessage(req.body, null);
  
  if (!responsePromise) {
    return res.status(200).end();
  }
  
  if (responsePromise.then) {
    const response = await responsePromise;
    res.json(response);
  } else {
    res.json(responsePromise);
  }
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, '0.0.0.0', () => {
  console.error(`MCP SSE Server with SDP Integration running on port ${PORT}`);
  console.error(`SSE endpoint: http://0.0.0.0:${PORT}/sse`);
  console.error(`Health: http://0.0.0.0:${PORT}/health`);
  console.error(`\nIntegrated Service Desk Plus tools:`);
  console.error('Request Management:');
  console.error('- list_requests: List service desk requests');
  console.error('- get_request: Get request details');
  console.error('- create_request: Create new request');
  console.error('- update_request: Update existing request');
  console.error('- close_request: Close request');
  console.error('- add_note: Add note to request');
  console.error('- search_requests: Search requests');
  console.error('\nUser Management:');
  console.error('- list_technicians: List available technicians');
  console.error('- get_technician: Get technician details');
  console.error('- find_technician: Find technician by name/email');
  console.error('\nUtilities:');
  console.error('- get_metadata: Get valid field values');
  console.error('- claude_code_command: Claude Code integration');
  
  console.error('\n🪟 Windows VS Code Configuration:');
  console.error('Create .vscode/mcp.json or %USERPROFILE%\\.mcp.json:');
  console.error(JSON.stringify({
    servers: {
      'service-desk-plus': {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'mcp-remote', 'http://10.212.0.7:' + PORT + '/sse', '--allow-http']
      }
    }
  }, null, 2));
  
  if (!sdpClient) {
    console.error('\n⚠️  SDP client not initialized. Please configure OAuth credentials.');
  }
});