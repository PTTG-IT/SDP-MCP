import { auditLogger } from '../db/auditLog.js';
import { changeTracker } from '../db/changeTracking.js';
import { dbFeatures } from '../db/config.js';

/**
 * Wrapper for MCP tools to add audit logging and change tracking
 */
export class MCPToolWrapper {
  /**
   * Wrap a tool handler to add logging and tracking
   */
  static wrapTool<T extends (...args: any[]) => Promise<any>>(
    toolName: string,
    handler: T
  ): T {
    return (async (...args: any[]) => {
      const startTime = Date.now();
      let mcpToolUsageId: number | undefined;
      
      try {
        // Log tool usage start
        if (dbFeatures.useAuditLog) {
          mcpToolUsageId = await auditLogger.logToolUsage({
            toolName,
            arguments: args[0], // MCP tools receive args as first parameter
            success: false, // Will update on success
            executionTimeMs: 0,
          });
        }
        
        // Execute the tool
        const result = await handler(...args);
        
        // Log successful execution
        if (dbFeatures.useAuditLog) {
          await auditLogger.logToolUsage({
            toolName,
            arguments: args[0],
            result,
            success: true,
            executionTimeMs: Date.now() - startTime,
          });
        }
        
        // Track changes if applicable
        if (dbFeatures.useChangeTracking && result && typeof result === 'object') {
          await trackChanges(toolName, args[0], result, mcpToolUsageId);
        }
        
        return result;
      } catch (error) {
        // Log failed execution
        if (dbFeatures.useAuditLog) {
          await auditLogger.logToolUsage({
            toolName,
            arguments: args[0],
            success: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            executionTimeMs: Date.now() - startTime,
          });
        }
        
        throw error;
      }
    }) as T;
  }
}

/**
 * Track changes based on tool name and result
 */
async function trackChanges(
  toolName: string,
  args: any,
  result: any,
  mcpToolUsageId?: number
): Promise<void> {
  try {
    // Map tool names to entity types
    const entityTypeMap: Record<string, string> = {
      'create_request': 'request',
      'update_request': 'request',
      'close_request': 'request',
      'create_asset': 'asset',
      'update_asset': 'asset',
      'create_problem': 'problem',
      'create_change': 'change',
      'create_project': 'project',
      'update_project': 'project',
      'create_task': 'task',
      'update_task': 'task',
      'complete_task': 'task',
    };
    
    const entityType = entityTypeMap[toolName];
    if (!entityType) return;
    
    // Extract entity ID from result
    const entityId = result.id || result.request_id || result.asset_id || 
                    result.project_id || result.task_id || result.problem_id || 
                    result.change_id;
    
    if (!entityId) return;
    
    // Determine operation type
    let operation: 'create' | 'update' | 'delete' = 'update';
    if (toolName.startsWith('create_')) {
      operation = 'create';
    } else if (toolName.includes('delete')) {
      operation = 'delete';
    }
    
    // Track the change
    if (operation === 'create') {
      await changeTracker.trackChange({
        entityType,
        entityId: String(entityId),
        operation,
        newValue: result,
        toolName,
        mcpToolUsageId,
      });
    } else if (operation === 'update' && args) {
      // For updates, track individual field changes
      const changes: Array<{ fieldName: string; oldValue: any; newValue: any }> = [];
      
      // Extract fields that were updated
      for (const key in args) {
        if (key !== 'request_id' && key !== 'id' && args[key] !== undefined) {
          changes.push({
            fieldName: key,
            oldValue: null, // We don't have the old value in this context
            newValue: args[key]
          });
        }
      }
      
      if (changes.length > 0) {
        await changeTracker.trackMultipleChanges(
          entityType,
          String(entityId),
          changes,
          {
            toolName,
            mcpToolUsageId,
          }
        );
      }
    }
  } catch (error) {
    console.error('Failed to track changes:', error);
    // Don't let tracking failures break the tool execution
  }
}

/**
 * Create a wrapped tool handler
 */
export function createWrappedToolHandler<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  handler: T
): T {
  return MCPToolWrapper.wrapTool(toolName, handler);
}