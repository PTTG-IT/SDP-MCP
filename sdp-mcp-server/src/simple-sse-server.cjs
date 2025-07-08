#!/usr/bin/env node

/**
 * Simple SSE MCP Server for Service Desk Plus
 * JavaScript version that works immediately
 * Based on working implementation patterns
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Validate required environment variables
const required = [
  'SDP_BASE_URL',
  'SDP_INSTANCE_NAME',
  'SDP_OAUTH_CLIENT_ID',
  'SDP_OAUTH_CLIENT_SECRET',
  'SDP_OAUTH_REFRESH_TOKEN',
];

const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Simple logger
const logger = {
  info: (msg, meta) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`, meta || ''),
  error: (msg, error) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, error || ''),
  debug: (msg, meta) => process.env.LOG_LEVEL === 'debug' && console.log(`[${new Date().toISOString()}] DEBUG: ${msg}`, meta || ''),
};

// SDP API Client
class SDPClient {
  constructor() {
    this.baseURL = `${process.env.SDP_BASE_URL}/app/${process.env.SDP_INSTANCE_NAME}/api/v3`;
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Accept': 'application/vnd.manageengine.sdp.v3+json',
      },
    });

    // Setup interceptors
    this.client.interceptors.request.use(async (config) => {
      const token = await this.getAccessToken();
      config.headers['Authorization'] = `Bearer ${token}`;
      logger.debug(`API Request: ${config.method.toUpperCase()} ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        if (error.response?.status === 401) {
          logger.info('Access token expired, refreshing...');
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          
          const token = await this.getAccessToken();
          const originalRequest = error.config;
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          
          return this.client(originalRequest);
        }
        throw error;
      }
    );
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const tokenData = await this.refreshAccessToken();
    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;
    
    return this.accessToken;
  }

  async refreshAccessToken() {
    const dataCenter = process.env.SDP_DATA_CENTER || 'US';
    const oauthUrls = {
      US: 'https://accounts.zoho.com/oauth/v2/token',
      EU: 'https://accounts.zoho.eu/oauth/v2/token',
      IN: 'https://accounts.zoho.in/oauth/v2/token',
    };
    
    const oauthUrl = oauthUrls[dataCenter] || oauthUrls.US;
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SDP_OAUTH_REFRESH_TOKEN,
      client_id: process.env.SDP_OAUTH_CLIENT_ID,
      client_secret: process.env.SDP_OAUTH_CLIENT_SECRET,
      scope: 'SDPOnDemand.requests.ALL SDPOnDemand.problems.ALL SDPOnDemand.changes.ALL SDPOnDemand.projects.ALL SDPOnDemand.assets.ALL',
    });

    try {
      const response = await axios.post(oauthUrl, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      logger.info('Access token refreshed successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to refresh access token', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  async listRequests(params = {}) {
    const requestParams = {
      list_info: {
        row_count: params.limit || 10,
        start_index: params.offset || 0,
      },
    };

    if (params.status) {
      requestParams.list_info.search_criteria = [{
        field: 'status.name',
        condition: 'is',
        value: params.status,
      }];
    }

    return this.client.get('/requests', {
      params: { input_data: JSON.stringify(requestParams) },
    });
  }

  async getRequest(id) {
    return this.client.get(`/requests/${id}`);
  }

  async searchRequests(params = {}) {
    const searchParams = {
      list_info: {
        row_count: params.limit || 10,
        start_index: params.offset || 0,
      },
    };

    if (params.query) {
      searchParams.list_info.search_criteria = [{
        field: 'subject',
        condition: 'contains',
        value: params.query,
      }];
    }

    return this.client.get('/requests', {
      params: { input_data: JSON.stringify(searchParams) },
    });
  }

  async getMetadata(entityType) {
    const endpoints = {
      priorities: '/priorities',
      statuses: '/statuses',
      categories: '/categories',
      urgencies: '/urgencies',
      impacts: '/impacts',
    };

    const endpoint = endpoints[entityType];
    if (!endpoint) {
      throw new Error(`Unknown metadata type: ${entityType}`);
    }

    return this.client.get(endpoint, {
      params: {
        input_data: JSON.stringify({
          list_info: { row_count: 100, start_index: 0 },
        }),
      },
    });
  }
}

// Initialize SDP client
const sdpClient = new SDPClient();

// MCP Tools
const tools = [
  {
    name: 'list_requests',
    description: 'List service desk requests with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of requests to return' },
        offset: { type: 'number', description: 'Number of requests to skip' },
        status: { type: 'string', description: 'Filter by status' },
      },
    },
  },
  {
    name: 'get_request',
    description: 'Get details of a specific request by ID',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The ID of the request to retrieve' },
      },
      required: ['request_id'],
    },
  },
  {
    name: 'search_requests',
    description: 'Search requests by subject or other criteria',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for request subjects' },
        limit: { type: 'number', description: 'Maximum number of results' },
        offset: { type: 'number', description: 'Number of results to skip' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_metadata',
    description: 'Get metadata for entity types (priorities, statuses, categories, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: {
          type: 'string',
          enum: ['priorities', 'statuses', 'categories', 'urgencies', 'impacts'],
          description: 'Type of metadata to retrieve',
        },
      },
      required: ['entity_type'],
    },
  },
];

// Tool handlers
const toolHandlers = {
  async list_requests(args) {
    logger.info('Executing list_requests', args);
    const result = await sdpClient.listRequests(args);
    return {
      requests: result.requests || [],
      total_count: result.response_status?.total_count || 0,
    };
  },

  async get_request(args) {
    logger.info('Executing get_request', args);
    if (!args.request_id) {
      throw new Error('request_id is required');
    }
    return sdpClient.getRequest(args.request_id);
  },

  async search_requests(args) {
    logger.info('Executing search_requests', args);
    if (!args.query) {
      throw new Error('query is required');
    }
    const result = await sdpClient.searchRequests(args);
    return {
      requests: result.requests || [],
      total_count: result.response_status?.total_count || 0,
    };
  },

  async get_metadata(args) {
    logger.info('Executing get_metadata', args);
    if (!args.entity_type) {
      throw new Error('entity_type is required');
    }
    return sdpClient.getMetadata(args.entity_type);
  },
};

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sdp-mcp-server',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  logger.info('New SSE connection established');
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  // Initialize MCP server for this connection
  const server = new Server(
    {
      name: "service-desk-plus",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Tools list requested');
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      const result = await handler(args);
      
      return {
        content: [
          {
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          { 
            type: "text", 
            text: `Error: ${error.message || 'Unknown error occurred'}` 
          }
        ],
        isError: true,
      };
    }
  });

  // Create SSE transport
  const transport = new SSEServerTransport(res);
  
  // Connect server to transport
  try {
    await server.connect(transport);
    logger.info('MCP server connected successfully');
  } catch (error) {
    logger.error('Failed to connect MCP server:', error);
    res.end();
    return;
  }
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);
  
  // Handle client disconnect
  req.on('close', () => {
    logger.info('SSE connection closed');
    clearInterval(keepAlive);
    server.close();
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.SDP_HTTP_PORT || 3456;
const HOST = process.env.SDP_HTTP_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`🚀 SDP MCP Server (SSE) running at http://${HOST}:${PORT}`);
  logger.info(`📡 SSE endpoint: http://${HOST}:${PORT}/sse`);
  logger.info(`🏥 Health check: http://${HOST}:${PORT}/health`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('👋 Shutting down server...');
  process.exit(0);
});