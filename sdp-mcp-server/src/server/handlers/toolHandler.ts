import { logger } from '../../monitoring/logging.js';
import { auditLogger } from '../../monitoring/auditLogger.js';
import { SDPError } from '../../utils/errors.js';
import type { ToolContext, ToolResult } from '../types.js';
import type { SDPClient } from '../../sdp/client.js';

/**
 * Tool execution metrics
 */
interface ToolMetrics {
  toolName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  errorCode?: string;
  tenantId: string;
}

/**
 * Base handler for MCP tools
 * Provides common functionality for all tool handlers
 */
export abstract class BaseToolHandler {
  protected readonly moduleName: string;
  protected readonly metrics: ToolMetrics;

  constructor(
    moduleName: string,
    toolName: string,
    context: ToolContext
  ) {
    this.moduleName = moduleName;
    this.metrics = {
      toolName,
      startTime: Date.now(),
      success: false,
      tenantId: context.tenantId,
    };
  }

  /**
   * Execute the tool handler with metrics and error handling
   */
  async execute<T extends any[], R>(
    handler: (...args: T) => Promise<R>,
    ...args: T
  ): Promise<R> {
    try {
      // Execute the handler
      const result = await handler(...args);
      
      // Mark as successful
      this.metrics.success = true;
      this.metrics.endTime = Date.now();
      this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
      
      // Log metrics
      await this.logMetrics();
      
      return result;
    } catch (error) {
      // Mark as failed
      this.metrics.success = false;
      this.metrics.endTime = Date.now();
      this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
      this.metrics.errorCode = error instanceof SDPError ? error.code : 'UNKNOWN_ERROR';
      
      // Log metrics
      await this.logMetrics();
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Log tool execution metrics
   */
  private async logMetrics(): Promise<void> {
    try {
      // Log to monitoring
      logger.info('Tool execution completed', {
        ...this.metrics,
        module: this.moduleName,
      });

      // Log to audit
      await auditLogger.log({
        tenantId: this.metrics.tenantId,
        eventType: `mcp.tool.${this.metrics.success ? 'success' : 'error'}`,
        eventCategory: 'tool',
        actorType: 'system',
        actorId: 'mcp-server',
        action: this.metrics.toolName,
        result: this.metrics.success ? 'success' : 'error',
        errorCode: this.metrics.errorCode,
        metadata: {
          module: this.moduleName,
          duration: this.metrics.duration,
        },
      });
    } catch (error) {
      logger.error('Failed to log tool metrics', { error, metrics: this.metrics });
    }
  }

  /**
   * Transform API response to tool result
   */
  protected transformToToolResult(data: any, options?: {
    format?: 'json' | 'text' | 'table';
    includeMetadata?: boolean;
  }): ToolResult {
    const { format = 'json', includeMetadata = false } = options || {};

    let content: string;
    
    switch (format) {
      case 'table':
        content = this.formatAsTable(data);
        break;
      case 'text':
        content = this.formatAsText(data);
        break;
      case 'json':
      default:
        content = JSON.stringify(data, null, 2);
        break;
    }

    const result: ToolResult = {
      content: [{
        type: 'text',
        text: content,
      }],
    };

    if (includeMetadata && this.metrics.duration) {
      result.content.push({
        type: 'text',
        text: `\n---\nExecution time: ${this.metrics.duration}ms`,
      });
    }

    return result;
  }

  /**
   * Format data as a text table
   */
  protected formatAsTable(data: any): string {
    if (Array.isArray(data)) {
      return this.arrayToTable(data);
    } else if (typeof data === 'object' && data !== null) {
      return this.objectToTable(data);
    } else {
      return String(data);
    }
  }

  /**
   * Format data as human-readable text
   */
  protected formatAsText(data: any): string {
    if (Array.isArray(data)) {
      return data.map((item, index) => 
        `${index + 1}. ${this.formatAsText(item)}`
      ).join('\n\n');
    } else if (typeof data === 'object' && data !== null) {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        lines.push(`${this.humanizeKey(key)}: ${this.formatValue(value)}`);
      }
      return lines.join('\n');
    } else {
      return String(data);
    }
  }

  /**
   * Convert array to ASCII table
   */
  private arrayToTable(data: any[]): string {
    if (data.length === 0) {
      return 'No data';
    }

    // Get all unique keys
    const keys = new Set<string>();
    data.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => keys.add(key));
      }
    });

    const columns = Array.from(keys);
    if (columns.length === 0) {
      return data.map((item, index) => `${index + 1}. ${item}`).join('\n');
    }

    // Calculate column widths
    const widths: Record<string, number> = {};
    columns.forEach(col => {
      widths[col] = col.length;
      data.forEach(item => {
        const value = String(item[col] || '');
        widths[col] = Math.max(widths[col], value.length);
      });
    });

    // Build table
    const lines: string[] = [];
    
    // Header
    lines.push(columns.map(col => col.padEnd(widths[col])).join(' | '));
    lines.push(columns.map(col => '-'.repeat(widths[col])).join('-+-'));
    
    // Rows
    data.forEach(item => {
      lines.push(columns.map(col => 
        String(item[col] || '').padEnd(widths[col])
      ).join(' | '));
    });

    return lines.join('\n');
  }

  /**
   * Convert object to table format
   */
  private objectToTable(data: Record<string, any>): string {
    const lines: string[] = [];
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
    
    for (const [key, value] of Object.entries(data)) {
      lines.push(`${key.padEnd(maxKeyLength)} : ${this.formatValue(value)}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Humanize a camelCase or snake_case key
   */
  private humanizeKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format a value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'N/A';
    } else if (value instanceof Date) {
      return value.toISOString();
    } else if (typeof value === 'object') {
      return JSON.stringify(value);
    } else {
      return String(value);
    }
  }
}

/**
 * Tool handler factory
 * Creates appropriate handlers for different tool types
 */
export class ToolHandlerFactory {
  /**
   * Create a handler for a specific tool
   */
  static createHandler(
    toolName: string,
    module: string,
    context: ToolContext
  ): BaseToolHandler {
    // For now, return a generic handler
    // In the future, we can create specific handlers for different tools
    return new GenericToolHandler(module, toolName, context);
  }
}

/**
 * Generic tool handler for standard operations
 */
class GenericToolHandler extends BaseToolHandler {
  constructor(
    moduleName: string,
    toolName: string,
    context: ToolContext
  ) {
    super(moduleName, toolName, context);
  }
}