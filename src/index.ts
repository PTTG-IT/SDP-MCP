#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from 'zod-to-json-schema';
import dotenv from 'dotenv';

import { SDPClient } from './api/client.js';
import { tools, toolSchemas } from './mcp/tools.js';
import { createToolHandler } from './mcp/handlers.js';
import { SDPError, formatSDPError } from './utils/errors.js';
import { loadConfig } from './utils/config.js';

// Load environment variables
dotenv.config();

// Initialize configuration
const config = loadConfig();

// Initialize API client
const sdpClient = new SDPClient({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  baseUrl: config.baseUrl,
  instanceName: config.instanceName,
});

// Initialize MCP server
const server = new Server(
  {
    name: config.serverName || "service-desk-plus",
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
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(toolSchemas[tool.name]),
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = createToolHandler(name, sdpClient);
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
    if (error instanceof SDPError) {
      return {
        content: [
          {
            type: "text",
            text: formatSDPError(error),
          },
        ],
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`Service Desk Plus MCP server started`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});