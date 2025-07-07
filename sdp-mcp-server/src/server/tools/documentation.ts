import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import type { ToolRegistry, ToolContext, ToolResult, MCPTool } from '../types.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';

/**
 * Tool documentation entry
 */
interface ToolDocumentation {
  name: string;
  description: string;
  module: string;
  operation: string;
  requiredScopes: string[];
  parameters: Record<string, any>;
  examples?: {
    description: string;
    input: any;
    output?: any;
  }[];
}

/**
 * Generate documentation for tools
 */
export class ToolDocumentationGenerator {
  private tools: Map<string, MCPTool> = new Map();

  /**
   * Register a tool for documentation
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Generate markdown documentation for all tools
   */
  generateMarkdown(): string {
    const sections = new Map<string, ToolDocumentation[]>();

    // Group tools by module
    for (const tool of this.tools.values()) {
      const module = tool.module || 'general';
      if (!sections.has(module)) {
        sections.set(module, []);
      }
      sections.get(module)!.push(this.getToolDocumentation(tool));
    }

    // Generate markdown
    const markdown: string[] = [
      '# Service Desk Plus MCP Tools Documentation',
      '',
      'This document provides detailed information about all available MCP tools for interacting with Service Desk Plus Cloud API.',
      '',
      '## Table of Contents',
      '',
    ];

    // Add TOC
    for (const [module, _tools] of sections) {
      markdown.push(`- [${this.formatModuleName(module)} Tools](#${module}-tools)`);
    }

    markdown.push('', '---', '');

    // Add sections
    for (const [module, tools] of sections) {
      markdown.push(`## ${this.formatModuleName(module)} Tools`, '');
      
      for (const tool of tools) {
        markdown.push(...this.generateToolMarkdown(tool));
      }
    }

    return markdown.join('\n');
  }

  /**
   * Generate JSON documentation
   */
  generateJSON(): Record<string, ToolDocumentation[]> {
    const documentation: Record<string, ToolDocumentation[]> = {};

    for (const tool of this.tools.values()) {
      const module = tool.module || 'general';
      if (!documentation[module]) {
        documentation[module] = [];
      }
      documentation[module].push(this.getToolDocumentation(tool));
    }

    return documentation;
  }

  /**
   * Get documentation for a specific tool
   */
  private getToolDocumentation(tool: MCPTool): ToolDocumentation {
    return {
      name: tool.name,
      description: tool.description,
      module: tool.module || 'general',
      operation: tool.operation || 'unknown',
      requiredScopes: tool.requiredScopes,
      parameters: tool.inputSchema,
      examples: this.getToolExamples(tool.name),
    };
  }

  /**
   * Generate markdown for a single tool
   */
  private generateToolMarkdown(tool: ToolDocumentation): string[] {
    const markdown: string[] = [
      `### ${tool.name}`,
      '',
      tool.description,
      '',
      '**Required Scopes:**',
      ...tool.requiredScopes.map(scope => `- \`${scope}\``),
      '',
    ];

    // Add parameters section
    if (tool.parameters.properties) {
      markdown.push('**Parameters:**', '');
      markdown.push(...this.generateParameterMarkdown(tool.parameters.properties));
      markdown.push('');
    }

    // Add examples if available
    if (tool.examples && tool.examples.length > 0) {
      markdown.push('**Examples:**', '');
      for (const example of tool.examples) {
        markdown.push(`*${example.description}*`, '', '```json', JSON.stringify(example.input, null, 2), '```', '');
      }
    }

    markdown.push('---', '');
    return markdown;
  }

  /**
   * Generate parameter documentation
   */
  private generateParameterMarkdown(
    properties: Record<string, any>,
    indent: string = ''
  ): string[] {
    const markdown: string[] = [];

    for (const [name, schema] of Object.entries(properties)) {
      const required = schema.required ? ' *(required)*' : ' *(optional)*';
      const type = schema.type || 'any';
      const description = schema.description || '';

      markdown.push(`${indent}- **${name}**${required} \`${type}\`: ${description}`);

      // Handle nested objects
      if (schema.type === 'object' && schema.properties) {
        markdown.push(...this.generateParameterMarkdown(schema.properties, indent + '  '));
      }

      // Handle arrays
      if (schema.type === 'array' && schema.items) {
        if (schema.items.type === 'object' && schema.items.properties) {
          markdown.push(`${indent}  - Array items:`);
          markdown.push(...this.generateParameterMarkdown(schema.items.properties, indent + '    '));
        } else {
          markdown.push(`${indent}  - Array of \`${schema.items.type || 'any'}\``);
        }
      }
    }

    return markdown;
  }

  /**
   * Format module name for display
   */
  private formatModuleName(module: string): string {
    return module.charAt(0).toUpperCase() + module.slice(1);
  }

  /**
   * Get examples for specific tools
   */
  private getToolExamples(toolName: string): ToolDocumentation['examples'] {
    const examples: Record<string, ToolDocumentation['examples']> = {
      create_request: [
        {
          description: 'Create a simple service request',
          input: {
            subject: 'Laptop not starting',
            description: 'My laptop won\'t turn on after the weekend',
            requester: { email: 'john.doe@example.com' },
            category: { name: 'Hardware' },
            priority: { name: 'High' },
          },
        },
      ],
      batch_create_requests: [
        {
          description: 'Create multiple requests in batch',
          input: {
            requests: [
              { subject: 'Monitor issue', requester: { email: 'user1@example.com' } },
              { subject: 'Keyboard replacement', requester: { email: 'user2@example.com' } },
            ],
            options: { batchSize: 5, continueOnError: true },
          },
        },
      ],
      close_request: [
        {
          description: 'Close a request with resolution details',
          input: {
            id: '12345',
            data: {
              closure_code: { name: 'Resolved' },
              closure_comments: 'Replaced the power adapter, laptop is working now',
            },
          },
        },
      ],
    };

    return examples[toolName];
  }
}

/**
 * Register documentation tools
 */
export function registerDocumentationTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // Get Tool Documentation
  registry.registerTool({
    tool: createTool(
      'get_tool_documentation',
      'Get documentation for available MCP tools',
      z.object({
        format: z.enum(['markdown', 'json']).default('markdown').optional(),
        module: z.string().optional().describe('Filter by module (e.g., requests, assets)'),
        include_examples: z.boolean().default(true).optional(),
      }),
      [], // No special scopes required
      'documentation',
      'get'
    ),
    module: 'documentation',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      // Get available tools for the tenant
      const tenantTools = await registry.getToolsForTenant(context.tenantId);
      
      // Create documentation generator
      const generator = new ToolDocumentationGenerator();
      for (const tool of tenantTools) {
        generator.registerTool(tool);
      }

      let content: string;
      if (args.format === 'json') {
        const docs = generator.generateJSON();
        content = JSON.stringify(
          args.module ? { [args.module]: docs[args.module] || [] } : docs,
          null,
          2
        );
      } else {
        content = generator.generateMarkdown();
      }

      return {
        content: [{
          type: 'text',
          text: content,
        }],
      };
    },
  });

  // Search Tools
  registry.registerTool({
    tool: createTool(
      'search_tools',
      'Search for tools by name, description, or module',
      z.object({
        query: z.string().describe('Search query'),
        search_in: z.array(z.enum(['name', 'description', 'module'])).default(['name', 'description']).optional(),
      }),
      [], // No special scopes required
      'documentation',
      'search'
    ),
    module: 'documentation',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenantTools = await registry.getToolsForTenant(context.tenantId);
      const query = args.query.toLowerCase();
      const searchIn = args.search_in || ['name', 'description'];

      const matches = tenantTools.filter(tool => {
        if (searchIn.includes('name') && tool.name.toLowerCase().includes(query)) {
          return true;
        }
        if (searchIn.includes('description') && tool.description.toLowerCase().includes(query)) {
          return true;
        }
        if (searchIn.includes('module') && tool.module?.toLowerCase().includes(query)) {
          return true;
        }
        return false;
      });

      const results = matches.map(tool => ({
        name: tool.name,
        description: tool.description,
        module: tool.module,
        requiredScopes: tool.requiredScopes,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: args.query,
            found: results.length,
            tools: results,
          }, null, 2),
        }],
      };
    },
  });

  // Get Tool Details
  registry.registerTool({
    tool: createTool(
      'get_tool_details',
      'Get detailed information about a specific tool',
      z.object({
        tool_name: z.string().describe('Name of the tool'),
      }),
      [], // No special scopes required
      'documentation',
      'details'
    ),
    module: 'documentation',
    handler: async (args: any, context: ToolContext): Promise<ToolResult> => {
      const tenantTools = await registry.getToolsForTenant(context.tenantId);
      const tool = tenantTools.find(t => t.name === args.tool_name);

      if (!tool) {
        return {
          content: [{
            type: 'text',
            text: `Tool "${args.tool_name}" not found or not available for your tenant.`,
          }],
          isError: true,
        };
      }

      const generator = new ToolDocumentationGenerator();
      generator.registerTool(tool);
      const docs = generator.generateJSON();
      const toolDoc = Object.values(docs).flat().find(d => d.name === args.tool_name);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(toolDoc, null, 2),
        }],
      };
    },
  });

  // List Available Scopes
  registry.registerTool({
    tool: createTool(
      'list_available_scopes',
      'List all OAuth scopes and their associated tools',
      z.object({}),
      [], // No special scopes required
      'documentation',
      'scopes'
    ),
    module: 'documentation',
    handler: async (_args: any, context: ToolContext): Promise<ToolResult> => {
      const tenantTools = await registry.getToolsForTenant(context.tenantId);
      const scopeMap: Record<string, string[]> = {};

      // Build scope to tools mapping
      for (const tool of tenantTools) {
        for (const scope of tool.requiredScopes) {
          if (!scopeMap[scope]) {
            scopeMap[scope] = [];
          }
          scopeMap[scope].push(tool.name);
        }
      }

      // Get all possible scopes
      const allScopes = Object.values(OAUTH_SCOPES);
      const scopeInfo = allScopes.map(scope => ({
        scope,
        description: getScopeDescription(scope),
        available: scope in scopeMap,
        tools: scopeMap[scope] || [],
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total_scopes: allScopes.length,
            available_scopes: Object.keys(scopeMap).length,
            scopes: scopeInfo,
          }, null, 2),
        }],
      };
    },
  });
}

/**
 * Get human-readable description for OAuth scope
 */
function getScopeDescription(scope: string): string {
  const descriptions: Record<string, string> = {
    'SDPOnDemand.requests.READ': 'Read service requests',
    'SDPOnDemand.requests.CREATE': 'Create new service requests',
    'SDPOnDemand.requests.UPDATE': 'Update existing service requests',
    'SDPOnDemand.requests.DELETE': 'Delete service requests',
    'SDPOnDemand.problems.READ': 'Read problems',
    'SDPOnDemand.problems.CREATE': 'Create new problems',
    'SDPOnDemand.problems.UPDATE': 'Update existing problems',
    'SDPOnDemand.problems.DELETE': 'Delete problems',
    'SDPOnDemand.changes.READ': 'Read change requests',
    'SDPOnDemand.changes.CREATE': 'Create new change requests',
    'SDPOnDemand.changes.UPDATE': 'Update existing change requests',
    'SDPOnDemand.changes.DELETE': 'Delete change requests',
    'SDPOnDemand.changes.APPROVE': 'Approve or reject change requests',
    'SDPOnDemand.projects.READ': 'Read projects',
    'SDPOnDemand.projects.CREATE': 'Create new projects',
    'SDPOnDemand.projects.UPDATE': 'Update existing projects',
    'SDPOnDemand.projects.DELETE': 'Delete projects',
    'SDPOnDemand.assets.READ': 'Read assets',
    'SDPOnDemand.assets.CREATE': 'Create new assets',
    'SDPOnDemand.assets.UPDATE': 'Update existing assets',
    'SDPOnDemand.assets.DELETE': 'Delete assets',
  };

  return descriptions[scope] || 'Unknown scope';
}