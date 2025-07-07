import type { ToolResult } from '../types.js';

/**
 * Format options for tool responses
 */
export interface FormatOptions {
  format?: 'json' | 'table' | 'summary' | 'detailed';
  includeMetadata?: boolean;
  maxItems?: number;
  fields?: string[];
  sortBy?: string;
  groupBy?: string;
}

/**
 * Response formatter for MCP tools
 */
export class ResponseFormatter {
  /**
   * Format a response based on options
   */
  static format(data: any, options: FormatOptions = {}): ToolResult {
    const {
      format = 'json',
      includeMetadata = false,
      maxItems,
      fields,
      sortBy,
      groupBy,
    } = options;

    // Apply transformations
    let processed = data;
    
    if (Array.isArray(data)) {
      // Filter fields if specified
      if (fields && fields.length > 0) {
        processed = data.map(item => this.selectFields(item, fields));
      }
      
      // Sort if specified
      if (sortBy) {
        processed = this.sortArray(processed, sortBy);
      }
      
      // Group if specified
      if (groupBy) {
        processed = this.groupArray(processed, groupBy);
      }
      
      // Limit items if specified
      if (maxItems && processed.length > maxItems) {
        processed = processed.slice(0, maxItems);
      }
    }

    // Format based on type
    let content: string;
    switch (format) {
      case 'table':
        content = this.formatAsTable(processed);
        break;
      case 'summary':
        content = this.formatAsSummary(processed, data);
        break;
      case 'detailed':
        content = this.formatAsDetailed(processed);
        break;
      case 'json':
      default:
        content = JSON.stringify(processed, null, 2);
        break;
    }

    const result: ToolResult = {
      content: [{
        type: 'text',
        text: content,
      }],
    };

    // Add metadata if requested
    if (includeMetadata && Array.isArray(data)) {
      const metadata = {
        total_items: data.length,
        displayed_items: Array.isArray(processed) ? processed.length : 1,
        format_applied: format,
        ...(fields && { fields_selected: fields }),
        ...(sortBy && { sorted_by: sortBy }),
        ...(groupBy && { grouped_by: groupBy }),
      };
      
      result.content.push({
        type: 'text',
        text: `\n---\nMetadata: ${JSON.stringify(metadata, null, 2)}`,
      });
    }

    return result;
  }

  /**
   * Select specific fields from an object
   */
  private static selectFields(obj: any, fields: string[]): any {
    const result: any = {};
    
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields
        const parts = field.split('.');
        let value = obj;
        for (const part of parts) {
          value = value?.[part];
        }
        result[field] = value;
      } else {
        result[field] = obj[field];
      }
    }
    
    return result;
  }

  /**
   * Sort an array by a field
   */
  private static sortArray(arr: any[], sortBy: string): any[] {
    const descending = sortBy.startsWith('-');
    const field = descending ? sortBy.slice(1) : sortBy;
    
    return [...arr].sort((a, b) => {
      const aVal = this.getFieldValue(a, field);
      const bVal = this.getFieldValue(b, field);
      
      if (aVal < bVal) return descending ? 1 : -1;
      if (aVal > bVal) return descending ? -1 : 1;
      return 0;
    });
  }

  /**
   * Group an array by a field
   */
  private static groupArray(arr: any[], groupBy: string): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    for (const item of arr) {
      const key = String(this.getFieldValue(item, groupBy) || 'undefined');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    }
    
    return groups;
  }

  /**
   * Get field value from object (supports nested fields)
   */
  private static getFieldValue(obj: any, field: string): any {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value = obj;
      for (const part of parts) {
        value = value?.[part];
      }
      return value;
    }
    return obj[field];
  }

  /**
   * Format as ASCII table
   */
  private static formatAsTable(data: any): string {
    if (!Array.isArray(data) || data.length === 0) {
      return this.formatSingleItemAsTable(data);
    }

    // Get all unique keys
    const keys = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => keys.add(key));
    });

    const columns = Array.from(keys);
    
    // Calculate column widths
    const widths: Record<string, number> = {};
    columns.forEach(col => {
      widths[col] = col.length;
      data.forEach(item => {
        const value = this.formatCellValue(item[col]);
        widths[col] = Math.max(widths[col], value.length);
      });
    });

    // Build table
    const lines: string[] = [];
    
    // Header
    lines.push('┌' + columns.map(col => '─'.repeat(widths[col] + 2)).join('┬') + '┐');
    lines.push('│ ' + columns.map(col => col.padEnd(widths[col])).join(' │ ') + ' │');
    lines.push('├' + columns.map(col => '─'.repeat(widths[col] + 2)).join('┼') + '┤');
    
    // Rows
    data.forEach(item => {
      lines.push('│ ' + columns.map(col => 
        this.formatCellValue(item[col]).padEnd(widths[col])
      ).join(' │ ') + ' │');
    });
    
    // Footer
    lines.push('└' + columns.map(col => '─'.repeat(widths[col] + 2)).join('┴') + '┘');

    return lines.join('\n');
  }

  /**
   * Format single item as table
   */
  private static formatSingleItemAsTable(data: any): string {
    if (typeof data !== 'object' || data === null) {
      return String(data);
    }

    const entries = Object.entries(data);
    const maxKeyLength = Math.max(...entries.map(([k]) => k.length));
    
    const lines: string[] = [];
    lines.push('┌' + '─'.repeat(maxKeyLength + 2) + '┬' + '─'.repeat(50) + '┐');
    
    for (const [key, value] of entries) {
      const formattedValue = this.formatCellValue(value);
      lines.push(`│ ${key.padEnd(maxKeyLength)} │ ${formattedValue.padEnd(48)} │`);
    }
    
    lines.push('└' + '─'.repeat(maxKeyLength + 2) + '┴' + '─'.repeat(50) + '┘');
    
    return lines.join('\n');
  }

  /**
   * Format as summary
   */
  private static formatAsSummary(processed: any, original: any): string {
    const lines: string[] = ['# Summary Report', ''];
    
    if (Array.isArray(original)) {
      lines.push(`Total items: ${original.length}`);
      
      // If grouped, show group summaries
      if (typeof processed === 'object' && !Array.isArray(processed)) {
        lines.push('', '## Groups:');
        for (const [group, items] of Object.entries(processed)) {
          lines.push(`- ${group}: ${(items as any[]).length} items`);
        }
      }
      
      // Calculate statistics for common fields
      const stats = this.calculateStatistics(original);
      if (Object.keys(stats).length > 0) {
        lines.push('', '## Statistics:');
        for (const [field, stat] of Object.entries(stats)) {
          lines.push(`- ${field}: ${stat}`);
        }
      }
    } else if (typeof processed === 'object') {
      // Single item summary
      lines.push(`Type: ${processed.constructor.name}`);
      lines.push(`Fields: ${Object.keys(processed).length}`);
      
      // Show key fields
      const keyFields = ['id', 'name', 'title', 'subject', 'status', 'priority'];
      lines.push('', '## Key Information:');
      for (const field of keyFields) {
        if (field in processed) {
          lines.push(`- ${field}: ${this.formatCellValue(processed[field])}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format as detailed view
   */
  private static formatAsDetailed(data: any): string {
    if (Array.isArray(data)) {
      return data.map((item, index) => 
        `## Item ${index + 1}\n\n${this.formatAsDetailed(item)}`
      ).join('\n\n---\n\n');
    }
    
    return this.formatObject(data, 0);
  }

  /**
   * Format object with indentation
   */
  private static formatObject(obj: any, indent: number = 0): string {
    if (obj === null || obj === undefined) {
      return 'null';
    }
    
    if (typeof obj !== 'object') {
      return String(obj);
    }
    
    const lines: string[] = [];
    const prefix = '  '.repeat(indent);
    
    for (const [key, value] of Object.entries(obj)) {
      const formattedKey = this.formatKey(key);
      
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          lines.push(`${prefix}**${formattedKey}**: [${value.length} items]`);
          if (value.length > 0 && typeof value[0] === 'object') {
            lines.push(this.formatObject(value[0], indent + 1));
          }
        } else {
          lines.push(`${prefix}**${formattedKey}**:`);
          lines.push(this.formatObject(value, indent + 1));
        }
      } else {
        lines.push(`${prefix}**${formattedKey}**: ${this.formatCellValue(value)}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format key for display
   */
  private static formatKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format cell value for display
   */
  private static formatCellValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }
    
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    
    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }
    
    if (typeof value === 'object') {
      if (value.name) return value.name;
      if (value.id) return `#${value.id}`;
      return '[Object]';
    }
    
    const str = String(value);
    return str.length > 50 ? str.substring(0, 47) + '...' : str;
  }

  /**
   * Calculate statistics for array data
   */
  private static calculateStatistics(data: any[]): Record<string, string> {
    const stats: Record<string, string> = {};
    
    // Count by status
    const statusCounts: Record<string, number> = {};
    data.forEach(item => {
      if (item.status?.name) {
        statusCounts[item.status.name] = (statusCounts[item.status.name] || 0) + 1;
      }
    });
    
    if (Object.keys(statusCounts).length > 0) {
      stats['Status Distribution'] = Object.entries(statusCounts)
        .map(([status, count]) => `${status} (${count})`)
        .join(', ');
    }
    
    // Count by priority
    const priorityCounts: Record<string, number> = {};
    data.forEach(item => {
      if (item.priority?.name) {
        priorityCounts[item.priority.name] = (priorityCounts[item.priority.name] || 0) + 1;
      }
    });
    
    if (Object.keys(priorityCounts).length > 0) {
      stats['Priority Distribution'] = Object.entries(priorityCounts)
        .map(([priority, count]) => `${priority} (${count})`)
        .join(', ');
    }
    
    return stats;
  }
}