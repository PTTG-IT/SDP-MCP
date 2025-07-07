import { z } from 'zod';
import { createTool } from '../toolRegistry.js';
import { OAUTH_SCOPES } from '../middleware/scopes.js';
import { RequestsAPI } from '../../sdp/modules/requests.js';
import { ToolErrorHandler } from './errorHandling.js';
import { RequestTransformer, ResponseTransformer } from '../../utils/transformer.js';
import { Paginator, PaginationHelper } from '../../utils/paginator.js';
import { ResponseFormatter } from '../formatters/responseFormatter.js';
import { BaseToolHandler } from '../handlers/toolHandler.js';
import type { ToolRegistry, ToolContext, ToolResult } from '../types.js';

/**
 * Enhanced request tools with advanced features
 */
export function registerEnhancedRequestTools(
  registry: ToolRegistry,
  sdpClientFactory: any
): void {
  // List Requests with Advanced Formatting
  registry.registerTool({
    tool: createTool(
      'list_requests_formatted',
      'List requests with advanced formatting and pagination',
      z.object({
        filters: z.object({
          status: z.string().optional(),
          priority: z.string().optional(),
          category: z.string().optional(),
          requester: z.string().optional(),
          technician: z.string().optional(),
          created_after: z.string().optional(),
          created_before: z.string().optional(),
        }).optional().describe('Filter criteria'),
        pagination: z.object({
          page_size: z.number().min(1).max(100).default(20).optional(),
          max_pages: z.number().min(1).default(5).optional(),
          max_items: z.number().min(1).default(100).optional(),
        }).optional().describe('Pagination options'),
        format: z.object({
          type: z.enum(['json', 'table', 'summary', 'detailed']).default('table').optional(),
          fields: z.array(z.string()).optional().describe('Fields to include'),
          sort_by: z.string().optional().describe('Field to sort by (prefix with - for descending)'),
          group_by: z.string().optional().describe('Field to group by'),
        }).optional().describe('Formatting options'),
      }),
      [OAUTH_SCOPES.REQUESTS_READ],
      'requests',
      'list_formatted'
    ),
    module: 'requests',
    handler: ToolErrorHandler.wrapHandler(
      async (args: any, context: ToolContext): Promise<ToolResult> => {
        const handler = new RequestListHandler('requests', 'list_requests_formatted', context);
        return await handler.execute(
          handler.handleListRequests.bind(handler),
          args,
          sdpClientFactory
        );
      },
      { toolName: 'list_requests_formatted', operation: 'list_formatted', module: 'requests' }
    ),
  });

  // Search Requests with Smart Filtering
  registry.registerTool({
    tool: createTool(
      'search_requests_smart',
      'Search requests with intelligent filtering and natural language support',
      z.object({
        query: z.string().optional().describe('Natural language search query'),
        filters: z.record(z.string(), z.any()).optional().describe('Structured filters'),
        date_range: z.object({
          field: z.enum(['created', 'updated', 'due']).default('created'),
          from: z.string().optional(),
          to: z.string().optional(),
          last_n_days: z.number().optional(),
        }).optional().describe('Date range filter'),
        output: z.object({
          format: z.enum(['json', 'table', 'summary']).default('summary').optional(),
          include_stats: z.boolean().default(true).optional(),
          max_results: z.number().min(1).max(500).default(50).optional(),
        }).optional(),
      }),
      [OAUTH_SCOPES.REQUESTS_READ],
      'requests',
      'search_smart'
    ),
    module: 'requests',
    handler: ToolErrorHandler.wrapHandler(
      async (args: any, context: ToolContext): Promise<ToolResult> => {
        const handler = new RequestSearchHandler('requests', 'search_requests_smart', context);
        return await handler.execute(
          handler.handleSmartSearch.bind(handler),
          args,
          sdpClientFactory
        );
      },
      { toolName: 'search_requests_smart', operation: 'search_smart', module: 'requests' }
    ),
  });

  // Bulk Status Update Tool
  registry.registerTool({
    tool: createTool(
      'bulk_update_request_status',
      'Update status for multiple requests based on criteria',
      z.object({
        selection: z.union([
          z.object({
            ids: z.array(z.string()).min(1).max(100).describe('Specific request IDs'),
          }),
          z.object({
            filter: z.record(z.string(), z.any()).describe('Filter to select requests'),
            limit: z.number().min(1).max(100).default(50).optional(),
          }),
        ]).describe('How to select requests'),
        new_status: z.object({
          id: z.string().optional(),
          name: z.string().optional(),
        }).describe('New status to apply'),
        options: z.object({
          dry_run: z.boolean().default(false).optional().describe('Preview changes without applying'),
          notify_requesters: z.boolean().default(true).optional(),
          add_note: z.string().optional().describe('Note to add to each request'),
        }).optional(),
      }),
      [OAUTH_SCOPES.REQUESTS_UPDATE],
      'requests',
      'bulk_status_update'
    ),
    module: 'requests',
    handler: ToolErrorHandler.wrapHandler(
      async (args: any, context: ToolContext): Promise<ToolResult> => {
        const handler = new BulkUpdateHandler('requests', 'bulk_update_request_status', context);
        return await handler.execute(
          handler.handleBulkStatusUpdate.bind(handler),
          args,
          sdpClientFactory
        );
      },
      { toolName: 'bulk_update_request_status', operation: 'bulk_status_update', module: 'requests' }
    ),
  });

  // Request Analytics Tool
  registry.registerTool({
    tool: createTool(
      'analyze_requests',
      'Analyze request patterns and generate insights',
      z.object({
        time_period: z.object({
          start: z.string().optional(),
          end: z.string().optional(),
          last_n_days: z.number().min(1).max(365).optional(),
        }).describe('Time period for analysis'),
        dimensions: z.array(
          z.enum(['status', 'priority', 'category', 'technician', 'requester', 'site', 'group'])
        ).default(['status', 'priority']).optional(),
        metrics: z.array(
          z.enum(['count', 'avg_resolution_time', 'sla_compliance', 'reopen_rate'])
        ).default(['count']).optional(),
        output: z.object({
          include_charts: z.boolean().default(false).optional(),
          format: z.enum(['summary', 'detailed', 'csv']).default('summary').optional(),
        }).optional(),
      }),
      [OAUTH_SCOPES.REQUESTS_READ],
      'requests',
      'analyze'
    ),
    module: 'requests',
    handler: ToolErrorHandler.wrapHandler(
      async (args: any, context: ToolContext): Promise<ToolResult> => {
        const handler = new RequestAnalyticsHandler('requests', 'analyze_requests', context);
        return await handler.execute(
          handler.handleAnalytics.bind(handler),
          args,
          sdpClientFactory
        );
      },
      { toolName: 'analyze_requests', operation: 'analyze', module: 'requests' }
    ),
  });
}

/**
 * Handler for list requests with advanced features
 */
class RequestListHandler extends BaseToolHandler {
  async handleListRequests(args: any, sdpClientFactory: any): Promise<ToolResult> {
    const client = sdpClientFactory.getClient(this.metrics.tenantId);
    const requestsAPI = new RequestsAPI(client);

    // Transform filters if provided
    const filters = args.filters ? 
      RequestTransformer.transformSearchCriteria(args.filters) : 
      undefined;

    // Create paginated fetcher
    const fetcher = Paginator.createSDPFetcher(
      client,
      '/api/v3/requests',
      'requests',
      filters ? { list_info: { filter_by: filters } } : undefined
    );

    // Fetch with pagination
    const result = await Paginator.fetchAll(
      fetcher,
      args.pagination || {}
    );

    // Transform response
    const transformed = result.items.map(item => 
      ResponseTransformer.transformEntity(item, 'request')
    );

    // Apply formatting
    const formatOptions = {
      format: args.format?.type || 'table',
      fields: args.format?.fields,
      sortBy: args.format?.sort_by,
      groupBy: args.format?.group_by,
      includeMetadata: true,
    };

    const formatted = ResponseFormatter.format(transformed, formatOptions);

    // Add pagination info
    if (result.pagesFetched > 1) {
      formatted.content.push({
        type: 'text',
        text: `\n${PaginationHelper.formatPaginationInfo(result)}`,
      });
    }

    return formatted;
  }
}

/**
 * Handler for smart search functionality
 */
class RequestSearchHandler extends BaseToolHandler {
  async handleSmartSearch(args: any, sdpClientFactory: any): Promise<ToolResult> {
    const client = sdpClientFactory.getClient(this.metrics.tenantId);
    
    // Build search filters
    const filters: Record<string, any> = {};
    
    // Parse natural language query if provided
    if (args.query) {
      this.parseNaturalLanguageQuery(args.query, filters);
    }
    
    // Merge with structured filters
    if (args.filters) {
      Object.assign(filters, args.filters);
    }
    
    // Apply date range
    if (args.date_range) {
      this.applyDateRange(args.date_range, filters);
    }
    
    // Transform to SDP format
    const sdpFilters = RequestTransformer.transformSearchCriteria(filters);
    
    // Create fetcher with filters
    const fetcher = Paginator.createSDPFetcher(
      client,
      '/api/v3/requests',
      'requests',
      { list_info: { filter_by: sdpFilters } }
    );
    
    // Fetch results
    const result = await Paginator.fetchAll(fetcher, {
      maxItems: args.output?.max_results || 50,
    });
    
    // Transform results
    const transformed = result.items.map(item => 
      ResponseTransformer.transformEntity(item, 'request')
    );
    
    // Generate output based on format
    if (args.output?.format === 'summary' && args.output?.include_stats) {
      return this.generateSearchSummary(transformed, filters, result);
    } else {
      return ResponseFormatter.format(transformed, {
        format: args.output?.format || 'summary',
        includeMetadata: true,
      });
    }
  }
  
  private parseNaturalLanguageQuery(query: string, filters: Record<string, any>): void {
    const lowerQuery = query.toLowerCase();
    
    // Status patterns
    if (lowerQuery.includes('open') || lowerQuery.includes('pending')) {
      filters.status = 'Open';
    } else if (lowerQuery.includes('closed') || lowerQuery.includes('resolved')) {
      filters.status = 'Closed';
    }
    
    // Priority patterns
    if (lowerQuery.includes('high priority') || lowerQuery.includes('urgent')) {
      filters.priority = 'High';
    } else if (lowerQuery.includes('low priority')) {
      filters.priority = 'Low';
    }
    
    // Time patterns
    const todayMatch = lowerQuery.match(/today|from today/);
    if (todayMatch) {
      filters.created_after = new Date().toISOString().split('T')[0];
    }
    
    const daysMatch = lowerQuery.match(/last (\d+) days?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const date = new Date();
      date.setDate(date.getDate() - days);
      filters.created_after = date.toISOString();
    }
  }
  
  private applyDateRange(dateRange: any, filters: Record<string, any>): void {
    const fieldMap: Record<string, string> = {
      created: 'created',
      updated: 'updated',
      due: 'due',
    };
    
    const baseField = fieldMap[dateRange.field] || 'created';
    
    if (dateRange.last_n_days) {
      const date = new Date();
      date.setDate(date.getDate() - dateRange.last_n_days);
      filters[`${baseField}_after`] = date.toISOString();
    } else {
      if (dateRange.from) {
        filters[`${baseField}_after`] = dateRange.from;
      }
      if (dateRange.to) {
        filters[`${baseField}_before`] = dateRange.to;
      }
    }
  }
  
  private generateSearchSummary(
    items: any[],
    filters: Record<string, any>,
    paginationResult: any
  ): ToolResult {
    const lines: string[] = [
      '# Request Search Results',
      '',
      `Found ${paginationResult.totalCount} requests matching your criteria.`,
      '',
    ];
    
    // Show applied filters
    if (Object.keys(filters).length > 0) {
      lines.push('## Applied Filters:');
      for (const [key, value] of Object.entries(filters)) {
        lines.push(`- ${this.formatFilterName(key)}: ${value}`);
      }
      lines.push('');
    }
    
    // Generate statistics
    const stats = this.calculateRequestStats(items);
    lines.push('## Statistics:');
    lines.push(`- Total Results: ${items.length}`);
    lines.push(`- Status Distribution: ${this.formatDistribution(stats.statusDist)}`);
    lines.push(`- Priority Distribution: ${this.formatDistribution(stats.priorityDist)}`);
    lines.push(`- Average Age: ${stats.avgAge} days`);
    lines.push('');
    
    // Show top results
    if (items.length > 0) {
      lines.push('## Top Results:');
      const topItems = items.slice(0, 5);
      topItems.forEach((item, index) => {
        lines.push(`${index + 1}. [${item.id}] ${item.subject}`);
        lines.push(`   Status: ${item.status?.name || 'Unknown'} | Priority: ${item.priority?.name || 'Normal'}`);
        lines.push(`   Requester: ${item.requester?.name || 'Unknown'} | Created: ${this.formatDate(item.created_at)}`);
        lines.push('');
      });
    }
    
    return {
      content: [{
        type: 'text',
        text: lines.join('\n'),
      }],
    };
  }
  
  private calculateRequestStats(items: any[]): any {
    const stats = {
      statusDist: {} as Record<string, number>,
      priorityDist: {} as Record<string, number>,
      avgAge: 0,
    };
    
    let totalAge = 0;
    const now = Date.now();
    
    items.forEach(item => {
      // Status distribution
      const status = item.status?.name || 'Unknown';
      stats.statusDist[status] = (stats.statusDist[status] || 0) + 1;
      
      // Priority distribution
      const priority = item.priority?.name || 'Normal';
      stats.priorityDist[priority] = (stats.priorityDist[priority] || 0) + 1;
      
      // Age calculation
      if (item.created_at) {
        const createdTime = new Date(item.created_at).getTime();
        totalAge += (now - createdTime) / (1000 * 60 * 60 * 24); // Days
      }
    });
    
    stats.avgAge = items.length > 0 ? Math.round(totalAge / items.length) : 0;
    
    return stats;
  }
  
  private formatFilterName(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  private formatDistribution(dist: Record<string, number>): string {
    return Object.entries(dist)
      .map(([key, count]) => `${key} (${count})`)
      .join(', ');
  }
  
  private formatDate(date: string | null): string {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  }
}

/**
 * Handler for bulk update operations
 */
class BulkUpdateHandler extends BaseToolHandler {
  async handleBulkStatusUpdate(args: any, sdpClientFactory: any): Promise<ToolResult> {
    const client = sdpClientFactory.getClient(this.metrics.tenantId);
    const requestsAPI = new RequestsAPI(client);
    
    // Get requests to update
    let requestIds: string[];
    
    if ('ids' in args.selection) {
      requestIds = args.selection.ids;
    } else {
      // Fetch requests based on filter
      const filters = RequestTransformer.transformSearchCriteria(args.selection.filter);
      const fetcher = Paginator.createSDPFetcher(
        client,
        '/api/v3/requests',
        'requests',
        { list_info: { filter_by: filters } }
      );
      
      const result = await Paginator.fetchAll(fetcher, {
        maxItems: args.selection.limit || 50,
      });
      
      requestIds = result.items.map(item => item.id);
    }
    
    if (requestIds.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No requests found matching the selection criteria.',
        }],
      };
    }
    
    // Preview mode
    if (args.options?.dry_run) {
      return this.generateDryRunReport(requestIds, args.new_status);
    }
    
    // Perform updates
    const results = await this.performBulkUpdate(
      requestIds,
      args.new_status,
      args.options,
      requestsAPI
    );
    
    return this.generateBulkUpdateReport(results);
  }
  
  private async performBulkUpdate(
    requestIds: string[],
    newStatus: any,
    options: any,
    requestsAPI: RequestsAPI
  ): Promise<Array<{ id: string; success: boolean; error?: string }>> {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    
    for (const id of requestIds) {
      try {
        const updateData: any = { status: newStatus };
        
        if (options?.add_note) {
          updateData.notes = options.add_note;
        }
        
        await requestsAPI.update(id, updateData);
        results.push({ id, success: true });
      } catch (error) {
        results.push({
          id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return results;
  }
  
  private generateDryRunReport(requestIds: string[], newStatus: any): ToolResult {
    const lines = [
      '# Bulk Update Preview (Dry Run)',
      '',
      `**Requests to update:** ${requestIds.length}`,
      `**New status:** ${newStatus.name || newStatus.id}`,
      '',
      '## Request IDs:',
      ...requestIds.slice(0, 20).map(id => `- ${id}`),
    ];
    
    if (requestIds.length > 20) {
      lines.push(`... and ${requestIds.length - 20} more`);
    }
    
    lines.push('', '**Note:** This is a preview. Run without dry_run to apply changes.');
    
    return {
      content: [{
        type: 'text',
        text: lines.join('\n'),
      }],
    };
  }
  
  private generateBulkUpdateReport(
    results: Array<{ id: string; success: boolean; error?: string }>
  ): ToolResult {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    const lines = [
      '# Bulk Update Results',
      '',
      `**Total processed:** ${results.length}`,
      `**Successful:** ${successful}`,
      `**Failed:** ${failed}`,
      '',
    ];
    
    if (failed > 0) {
      lines.push('## Failed Updates:');
      results
        .filter(r => !r.success)
        .forEach(r => {
          lines.push(`- Request ${r.id}: ${r.error}`);
        });
    }
    
    return {
      content: [{
        type: 'text',
        text: lines.join('\n'),
      }],
    };
  }
}

/**
 * Handler for request analytics
 */
class RequestAnalyticsHandler extends BaseToolHandler {
  async handleAnalytics(args: any, sdpClientFactory: any): Promise<ToolResult> {
    const client = sdpClientFactory.getClient(this.metrics.tenantId);
    
    // Build date filter
    const dateFilter = this.buildDateFilter(args.time_period);
    
    // Fetch all requests in the time period
    const fetcher = Paginator.createSDPFetcher(
      client,
      '/api/v3/requests',
      'requests',
      dateFilter ? { list_info: { filter_by: dateFilter } } : undefined
    );
    
    const result = await Paginator.fetchAll(fetcher, {
      maxItems: 5000, // Reasonable limit for analytics
    });
    
    // Transform requests
    const requests = result.items.map(item => 
      ResponseTransformer.transformEntity(item, 'request')
    );
    
    // Calculate analytics
    const analytics = this.calculateAnalytics(
      requests,
      args.dimensions || ['status', 'priority'],
      args.metrics || ['count']
    );
    
    // Format output
    return this.formatAnalyticsReport(analytics, args.output?.format || 'summary');
  }
  
  private buildDateFilter(timePeriod: any): any[] | null {
    if (!timePeriod) return null;
    
    const filters: any[] = [];
    
    if (timePeriod.last_n_days) {
      const date = new Date();
      date.setDate(date.getDate() - timePeriod.last_n_days);
      filters.push({
        name: 'created_time',
        operation: 'gte',
        value: date.getTime().toString(),
      });
    } else {
      if (timePeriod.start) {
        filters.push({
          name: 'created_time',
          operation: 'gte',
          value: new Date(timePeriod.start).getTime().toString(),
        });
      }
      if (timePeriod.end) {
        filters.push({
          name: 'created_time',
          operation: 'lte',
          value: new Date(timePeriod.end).getTime().toString(),
        });
      }
    }
    
    return filters.length > 0 ? filters : null;
  }
  
  private calculateAnalytics(
    requests: any[],
    dimensions: string[],
    metrics: string[]
  ): any {
    const analytics: any = {
      total_requests: requests.length,
      dimensions: {},
      metrics: {},
    };
    
    // Calculate dimensional breakdowns
    dimensions.forEach(dimension => {
      analytics.dimensions[dimension] = this.calculateDimension(requests, dimension);
    });
    
    // Calculate metrics
    metrics.forEach(metric => {
      analytics.metrics[metric] = this.calculateMetric(requests, metric);
    });
    
    return analytics;
  }
  
  private calculateDimension(requests: any[], dimension: string): Record<string, number> {
    const counts: Record<string, number> = {};
    
    requests.forEach(request => {
      let value: string;
      
      switch (dimension) {
        case 'status':
          value = request.status?.name || 'Unknown';
          break;
        case 'priority':
          value = request.priority?.name || 'Normal';
          break;
        case 'category':
          value = request.category?.name || 'Uncategorized';
          break;
        case 'technician':
          value = request.technician?.name || 'Unassigned';
          break;
        case 'requester':
          value = request.requester?.name || 'Unknown';
          break;
        case 'site':
          value = request.site?.name || 'Default';
          break;
        case 'group':
          value = request.group?.name || 'Unassigned';
          break;
        default:
          value = 'Other';
      }
      
      counts[value] = (counts[value] || 0) + 1;
    });
    
    return counts;
  }
  
  private calculateMetric(requests: any[], metric: string): any {
    switch (metric) {
      case 'count':
        return requests.length;
        
      case 'avg_resolution_time':
        const resolvedRequests = requests.filter(r => 
          r.status?.name === 'Closed' || r.status?.name === 'Resolved'
        );
        
        if (resolvedRequests.length === 0) return 0;
        
        const totalTime = resolvedRequests.reduce((sum, request) => {
          if (request.created_at && request.updated_at) {
            const created = new Date(request.created_at).getTime();
            const resolved = new Date(request.updated_at).getTime();
            return sum + (resolved - created);
          }
          return sum;
        }, 0);
        
        return Math.round(totalTime / resolvedRequests.length / (1000 * 60 * 60)); // Hours
        
      case 'sla_compliance':
        const withDueDate = requests.filter(r => r.due_date);
        if (withDueDate.length === 0) return 100;
        
        const onTime = withDueDate.filter(r => !r.is_overdue).length;
        return Math.round((onTime / withDueDate.length) * 100);
        
      case 'reopen_rate':
        // This would require tracking request history
        // For now, return a placeholder
        return 'N/A';
        
      default:
        return null;
    }
  }
  
  private formatAnalyticsReport(analytics: any, format: string): ToolResult {
    if (format === 'csv') {
      return this.formatAsCSV(analytics);
    }
    
    const lines: string[] = [
      '# Request Analytics Report',
      '',
      `**Total Requests Analyzed:** ${analytics.total_requests}`,
      '',
    ];
    
    // Add dimensional breakdowns
    Object.entries(analytics.dimensions).forEach(([dimension, data]) => {
      lines.push(`## ${this.formatDimensionName(dimension)} Distribution:`);
      
      const sorted = Object.entries(data as Record<string, number>)
        .sort(([, a], [, b]) => (b as number) - (a as number));
      
      sorted.forEach(([value, count]) => {
        const percentage = ((count as number) / analytics.total_requests * 100).toFixed(1);
        lines.push(`- ${value}: ${count} (${percentage}%)`);
      });
      
      lines.push('');
    });
    
    // Add metrics
    if (Object.keys(analytics.metrics).length > 0) {
      lines.push('## Key Metrics:');
      Object.entries(analytics.metrics).forEach(([metric, value]) => {
        lines.push(`- ${this.formatMetricName(metric)}: ${this.formatMetricValue(metric, value)}`);
      });
    }
    
    return {
      content: [{
        type: 'text',
        text: lines.join('\n'),
      }],
    };
  }
  
  private formatAsCSV(analytics: any): ToolResult {
    const lines: string[] = ['Dimension,Value,Count,Percentage'];
    
    Object.entries(analytics.dimensions).forEach(([dimension, data]) => {
      Object.entries(data as Record<string, number>).forEach(([value, count]) => {
        const percentage = ((count as number) / analytics.total_requests * 100).toFixed(1);
        lines.push(`${dimension},${value},${count},${percentage}%`);
      });
    });
    
    return {
      content: [{
        type: 'text',
        text: lines.join('\n'),
      }],
    };
  }
  
  private formatDimensionName(dimension: string): string {
    return dimension.charAt(0).toUpperCase() + dimension.slice(1);
  }
  
  private formatMetricName(metric: string): string {
    const names: Record<string, string> = {
      count: 'Total Count',
      avg_resolution_time: 'Average Resolution Time',
      sla_compliance: 'SLA Compliance Rate',
      reopen_rate: 'Reopen Rate',
    };
    return names[metric] || metric;
  }
  
  private formatMetricValue(metric: string, value: any): string {
    switch (metric) {
      case 'avg_resolution_time':
        return `${value} hours`;
      case 'sla_compliance':
        return `${value}%`;
      default:
        return String(value);
    }
  }
}