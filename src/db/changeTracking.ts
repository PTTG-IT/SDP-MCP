import { query, queryOne, transaction } from './config.js';

/**
 * Change Tracking System for rollback capability
 */
export class ChangeTracker {
  /**
   * Track a change to an entity
   */
  async trackChange(params: {
    entityType: string;
    entityId: string;
    operation: 'create' | 'update' | 'delete';
    fieldName?: string;
    oldValue?: any;
    newValue?: any;
    changedBy?: string;
    toolName?: string;
    mcpToolUsageId?: number;
    notes?: string;
  }): Promise<number> {
    try {
      const result = await queryOne<{ id: number }>(
        `INSERT INTO change_history 
         (entity_type, entity_id, operation, field_name, old_value, 
          new_value, changed_by, tool_name, mcp_tool_usage_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          params.entityType,
          params.entityId,
          params.operation,
          params.fieldName || null,
          params.oldValue ? JSON.stringify(params.oldValue) : null,
          params.newValue ? JSON.stringify(params.newValue) : null,
          params.changedBy || 'SDP MCP Server',
          params.toolName || null,
          params.mcpToolUsageId || null,
          params.notes || null
        ]
      );
      
      return result?.id || 0;
    } catch (error) {
      console.error('Change tracking failed:', error);
      return 0;
    }
  }
  
  /**
   * Track multiple field changes in a single transaction
   */
  async trackMultipleChanges(
    entityType: string,
    entityId: string,
    changes: Array<{
      fieldName: string;
      oldValue: any;
      newValue: any;
    }>,
    metadata: {
      changedBy?: string;
      toolName?: string;
      mcpToolUsageId?: number;
      notes?: string;
    }
  ): Promise<number[]> {
    return await transaction(async (client) => {
      const changeIds: number[] = [];
      
      for (const change of changes) {
        const result = await client.query(
          `INSERT INTO change_history 
           (entity_type, entity_id, operation, field_name, old_value, 
            new_value, changed_by, tool_name, mcp_tool_usage_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            entityType,
            entityId,
            'update',
            change.fieldName,
            JSON.stringify(change.oldValue),
            JSON.stringify(change.newValue),
            metadata.changedBy || 'SDP MCP Server',
            metadata.toolName || null,
            metadata.mcpToolUsageId || null,
            metadata.notes || null
          ]
        );
        
        if (result.rows[0]) {
          changeIds.push(result.rows[0].id);
        }
      }
      
      return changeIds;
    });
  }
  
  /**
   * Get change history for an entity
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<any[]> {
    return await query(
      `SELECT 
        ch.*,
        mtu.tool_name as executed_tool,
        mtu.timestamp as execution_time
       FROM change_history ch
       LEFT JOIN mcp_tool_usage mtu ON ch.mcp_tool_usage_id = mtu.id
       WHERE ch.entity_type = $1 AND ch.entity_id = $2
       ORDER BY ch.changed_at DESC
       LIMIT $3`,
      [entityType, entityId, limit]
    );
  }
  
  /**
   * Get all changes made by a specific tool
   */
  async getToolChanges(
    toolName: string,
    hours: number = 24
  ): Promise<any[]> {
    return await query(
      `SELECT *
       FROM change_history
       WHERE tool_name = $1
       AND changed_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
       ORDER BY changed_at DESC`,
      [toolName]
    );
  }
  
  /**
   * Get changes that can be rolled back
   */
  async getRollbackableChanges(
    entityType?: string,
    hours: number = 24
  ): Promise<any[]> {
    let sql = `
      SELECT *
      FROM change_history
      WHERE rollback_applied = false
      AND old_value IS NOT NULL
      AND changed_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
    `;
    
    const params: any[] = [];
    
    if (entityType) {
      sql += ' AND entity_type = $1';
      params.push(entityType);
    }
    
    sql += ' ORDER BY changed_at DESC';
    
    return await query(sql, params);
  }
  
  /**
   * Get rollback data for a specific change
   */
  async getRollbackData(changeId: number): Promise<{
    entityType: string;
    entityId: string;
    fieldName: string;
    oldValue: any;
    currentValue: any;
    canRollback: boolean;
  } | null> {
    const change = await queryOne<any>(
      `SELECT *
       FROM change_history
       WHERE id = $1
       AND rollback_applied = false`,
      [changeId]
    );
    
    if (!change) {
      return null;
    }
    
    return {
      entityType: change.entity_type,
      entityId: change.entity_id,
      fieldName: change.field_name,
      oldValue: change.old_value,
      currentValue: change.new_value,
      canRollback: change.old_value !== null && change.operation !== 'create'
    };
  }
  
  /**
   * Mark a change as rolled back
   */
  async markRollback(changeId: number, notes?: string): Promise<boolean> {
    try {
      await query(
        `UPDATE change_history
         SET rollback_applied = true,
             rollback_at = CURRENT_TIMESTAMP,
             notes = COALESCE(notes || E'\\n' || $2, $2)
         WHERE id = $1
         AND rollback_applied = false`,
        [changeId, notes || 'Rollback applied']
      );
      
      return true;
    } catch (error) {
      console.error('Failed to mark rollback:', error);
      return false;
    }
  }
  
  /**
   * Get change statistics
   */
  async getChangeStats(hours: number = 24): Promise<any> {
    const stats = await queryOne(
      `SELECT 
        COUNT(*) as total_changes,
        COUNT(DISTINCT entity_type) as entity_types_changed,
        COUNT(DISTINCT entity_id) as entities_changed,
        COUNT(CASE WHEN operation = 'create' THEN 1 END) as creates,
        COUNT(CASE WHEN operation = 'update' THEN 1 END) as updates,
        COUNT(CASE WHEN operation = 'delete' THEN 1 END) as deletes,
        COUNT(CASE WHEN rollback_applied = true THEN 1 END) as rollbacks
       FROM change_history
       WHERE changed_at > CURRENT_TIMESTAMP - INTERVAL '${hours} hours'`,
      []
    );
    
    return stats;
  }
  
  /**
   * Get recent changes summary
   */
  async getRecentChangesSummary(limit: number = 20): Promise<any[]> {
    return await query(
      `SELECT 
        entity_type,
        entity_id,
        operation,
        COUNT(*) as change_count,
        MAX(changed_at) as last_changed,
        array_agg(DISTINCT tool_name) as tools_used,
        array_agg(DISTINCT changed_by) as changed_by_users
       FROM change_history
       WHERE changed_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
       GROUP BY entity_type, entity_id, operation
       ORDER BY MAX(changed_at) DESC
       LIMIT $1`,
      [limit]
    );
  }
  
  /**
   * Compare values for change detection
   */
  hasValueChanged(oldValue: any, newValue: any): boolean {
    // Handle null/undefined cases
    if (oldValue === newValue) return false;
    if (oldValue == null || newValue == null) return true;
    
    // Deep comparison for objects
    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    }
    
    // Simple comparison for primitives
    return oldValue !== newValue;
  }
  
  /**
   * Extract changed fields from two objects
   */
  extractChangedFields(
    oldObject: Record<string, any>,
    newObject: Record<string, any>
  ): Array<{ fieldName: string; oldValue: any; newValue: any }> {
    const changes: Array<{ fieldName: string; oldValue: any; newValue: any }> = [];
    
    // Check all keys in the new object
    for (const key in newObject) {
      if (this.hasValueChanged(oldObject[key], newObject[key])) {
        changes.push({
          fieldName: key,
          oldValue: oldObject[key],
          newValue: newObject[key]
        });
      }
    }
    
    // Check for deleted fields
    for (const key in oldObject) {
      if (!(key in newObject)) {
        changes.push({
          fieldName: key,
          oldValue: oldObject[key],
          newValue: undefined
        });
      }
    }
    
    return changes;
  }
}

// Export singleton instance
export const changeTracker = new ChangeTracker();