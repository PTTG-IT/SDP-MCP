import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';
import { logger } from '../monitoring/logging.js';
import { TenantManager } from '../tenants/manager.js';
import type { SDPClient } from '../sdp/client.js';
import type { MCPTool, ToolHandler, ToolRegistryEntry, ToolContext, ToolResult } from './types.js';

// Import tool implementations
import { registerRequestTools } from './tools/requests.js';
import { registerProblemTools } from './tools/problems.js';
import { registerChangeTools } from './tools/changes.js';
import { registerProjectTools } from './tools/projects.js';
import { registerAssetTools } from './tools/assets.js';

/**
 * Tool Registry for MCP Server
 * Manages tool registration, validation, and execution
 */
export interface ToolRegistry {
  registerTool(entry: ToolRegistryEntry): void;
  registerAllTools(): Promise<void>;
  getToolsForTenant(tenantId: string): Promise<MCPTool[]>;
  validateToolAccess(toolName: string, tenantId: string): Promise<boolean>;
  executeTool(toolName: string, args: any, context: ToolContext): Promise<ToolResult>;
}

/**
 * Create tool registry
 */
export function createToolRegistry(
  server: Server,
  sdpClientFactory: any
): ToolRegistry {
  const tools = new Map<string, ToolRegistryEntry>();
  const tenantManager = new TenantManager();

  /**
   * Register a tool
   */
  function registerTool(entry: ToolRegistryEntry): void {
    const { tool } = entry;
    
    logger.info('Registering tool', {
      name: tool.name,
      module: entry.module,
      requiredScopes: tool.requiredScopes,
    });

    // Register with MCP server
    server.setToolHandler(tool.name, async (args, extra) => {
      const context: ToolContext = {
        tenantId: extra?.context?.tenantId || '',
        clientId: extra?.context?.clientId,
        sessionId: extra?.context?.sessionId,
        scopes: extra?.context?.scopes,
      };

      return entry.handler(args, context);
    });

    // Store in registry
    tools.set(tool.name, entry);
  }

  /**
   * Register all tools
   */
  async function registerAllTools(): Promise<void> {
    logger.info('Registering all MCP tools');

    try {
      // Register tools for each module
      registerRequestTools({ registerTool }, sdpClientFactory);
      registerProblemTools({ registerTool }, sdpClientFactory);
      registerChangeTools({ registerTool }, sdpClientFactory);
      registerProjectTools({ registerTool }, sdpClientFactory);
      registerAssetTools({ registerTool }, sdpClientFactory);

      logger.info('All tools registered successfully', {
        totalTools: tools.size,
      });
    } catch (error) {
      logger.error('Failed to register tools', { error });
      throw error;
    }
  }

  /**
   * Get tools available for a tenant based on their scopes
   */
  async function getToolsForTenant(tenantId: string): Promise<MCPTool[]> {
    try {
      const tenant = await tenantManager.getTenant(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const tenantScopes = tenant.allowedScopes || [];
      const availableTools: MCPTool[] = [];

      // Filter tools based on tenant scopes
      for (const [name, entry] of tools) {
        const { tool } = entry;
        
        // Check if tenant has all required scopes for this tool
        const hasRequiredScopes = tool.requiredScopes.every(scope =>
          tenantScopes.includes(scope)
        );

        if (hasRequiredScopes) {
          availableTools.push(tool);
        }
      }

      logger.debug('Tools available for tenant', {
        tenantId,
        totalTools: tools.size,
        availableTools: availableTools.length,
      });

      return availableTools;
    } catch (error) {
      logger.error('Failed to get tools for tenant', { tenantId, error });
      throw error;
    }
  }

  /**
   * Validate if tenant has access to a tool
   */
  async function validateToolAccess(
    toolName: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const tool = tools.get(toolName);
      if (!tool) {
        logger.warn('Tool not found', { toolName });
        return false;
      }

      const tenant = await tenantManager.getTenant(tenantId);
      if (!tenant) {
        logger.warn('Tenant not found', { tenantId });
        return false;
      }

      const tenantScopes = tenant.allowedScopes || [];
      
      // Check if tenant has all required scopes
      const hasAccess = tool.tool.requiredScopes.every(scope =>
        tenantScopes.includes(scope)
      );

      if (!hasAccess) {
        logger.warn('Tenant lacks required scopes for tool', {
          tenantId,
          toolName,
          requiredScopes: tool.tool.requiredScopes,
          tenantScopes,
        });
      }

      return hasAccess;
    } catch (error) {
      logger.error('Failed to validate tool access', {
        toolName,
        tenantId,
        error,
      });
      return false;
    }
  }

  /**
   * Execute a tool
   */
  async function executeTool(
    toolName: string,
    args: any,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      // Validate arguments if validator provided
      if (tool.validateArgs) {
        const isValid = await tool.validateArgs(args);
        if (!isValid) {
          throw new Error('Invalid arguments');
        }
      }

      // Execute tool handler
      const result = await tool.handler(args, context);

      // Format result as ToolResult
      if (result && typeof result === 'object' && 'content' in result) {
        return result as ToolResult;
      }

      // Convert to standard format
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Tool execution failed', {
        toolName,
        error,
        context,
      });

      // Return error result
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    registerTool,
    registerAllTools,
    getToolsForTenant,
    validateToolAccess,
    executeTool,
  };
}

/**
 * Helper to create tool definition
 */
export function createTool(
  name: string,
  description: string,
  inputSchema: z.ZodType<any>,
  requiredScopes: string[],
  module: string,
  operation: string
): MCPTool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: zodToJsonSchema(inputSchema),
    },
    requiredScopes,
    module,
    operation,
  };
}

/**
 * Convert Zod schema to JSON Schema (simplified)
 */
function zodToJsonSchema(schema: z.ZodType<any>): any {
  // This is a simplified conversion
  // In production, use a proper zod-to-json-schema library
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType<any>);
      
      // Check if required (not optional)
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element),
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }

  // Default fallback
  return { type: 'any' };
}