import { logger } from '../monitoring/logging.js';
import { parseScope } from '../tenants/validator.js';

/**
 * MCP tool to OAuth scope mapping
 */
export const TOOL_SCOPE_MAPPING: Record<string, string[]> = {
  // Request tools
  'create_request': ['SDPOnDemand.requests.CREATE'],
  'update_request': ['SDPOnDemand.requests.UPDATE'],
  'get_request': ['SDPOnDemand.requests.READ'],
  'list_requests': ['SDPOnDemand.requests.READ'],
  'close_request': ['SDPOnDemand.requests.UPDATE'],
  'delete_request': ['SDPOnDemand.requests.DELETE'],
  'pickup_request': ['SDPOnDemand.requests.UPDATE'],
  
  // Problem tools
  'create_problem': ['SDPOnDemand.problems.CREATE'],
  'update_problem': ['SDPOnDemand.problems.UPDATE'],
  'get_problem': ['SDPOnDemand.problems.READ'],
  'list_problems': ['SDPOnDemand.problems.READ'],
  'delete_problem': ['SDPOnDemand.problems.DELETE'],
  
  // Change tools
  'create_change': ['SDPOnDemand.changes.CREATE'],
  'update_change': ['SDPOnDemand.changes.UPDATE'],
  'get_change': ['SDPOnDemand.changes.READ'],
  'list_changes': ['SDPOnDemand.changes.READ'],
  'delete_change': ['SDPOnDemand.changes.DELETE'],
  'approve_change': ['SDPOnDemand.changes.UPDATE'],
  
  // Project tools
  'create_project': ['SDPOnDemand.projects.CREATE'],
  'update_project': ['SDPOnDemand.projects.UPDATE'],
  'get_project': ['SDPOnDemand.projects.READ'],
  'list_projects': ['SDPOnDemand.projects.READ'],
  'delete_project': ['SDPOnDemand.projects.DELETE'],
  'create_milestone': ['SDPOnDemand.projects.CREATE'],
  'create_task': ['SDPOnDemand.projects.CREATE'],
  
  // Asset tools
  'create_asset': ['SDPOnDemand.assets.CREATE'],
  'update_asset': ['SDPOnDemand.assets.UPDATE'],
  'get_asset': ['SDPOnDemand.assets.READ'],
  'list_assets': ['SDPOnDemand.assets.READ'],
  'delete_asset': ['SDPOnDemand.assets.DELETE'],
  
  // User/Technician tools
  'get_user': ['SDPOnDemand.users.READ'],
  'list_users': ['SDPOnDemand.users.READ'],
  'create_user': ['SDPOnDemand.users.CREATE'],
  'update_user': ['SDPOnDemand.users.UPDATE'],
  'get_technician': ['SDPOnDemand.technicians.READ'],
  'list_technicians': ['SDPOnDemand.technicians.READ'],
  
  // Solution tools
  'create_solution': ['SDPOnDemand.solutions.CREATE'],
  'update_solution': ['SDPOnDemand.solutions.UPDATE'],
  'get_solution': ['SDPOnDemand.solutions.READ'],
  'list_solutions': ['SDPOnDemand.solutions.READ'],
  'delete_solution': ['SDPOnDemand.solutions.DELETE'],
  
  // Contract tools
  'create_contract': ['SDPOnDemand.contracts.CREATE'],
  'update_contract': ['SDPOnDemand.contracts.UPDATE'],
  'get_contract': ['SDPOnDemand.contracts.READ'],
  'list_contracts': ['SDPOnDemand.contracts.READ'],
  'delete_contract': ['SDPOnDemand.contracts.DELETE'],
};

/**
 * Scope validator for OAuth permissions
 */
export class ScopeValidator {
  private readonly adminScope = 'SDPOnDemand.admin.ALL';
  
  /**
   * Check if tenant has required scope for a tool
   */
  hasToolScope(toolName: string, tenantScopes: string[]): boolean {
    // Admin scope grants all permissions
    if (tenantScopes.includes(this.adminScope)) {
      return true;
    }
    
    // Get required scopes for tool
    const requiredScopes = TOOL_SCOPE_MAPPING[toolName];
    if (!requiredScopes) {
      logger.warn('Unknown tool name for scope validation', { toolName });
      return false;
    }
    
    // Check if tenant has any of the required scopes
    return requiredScopes.some(required => 
      this.hasScopePermission(required, tenantScopes)
    );
  }
  
  /**
   * Check if tenant has a specific scope or equivalent
   */
  hasScopePermission(requiredScope: string, tenantScopes: string[]): boolean {
    // Direct match
    if (tenantScopes.includes(requiredScope)) {
      return true;
    }
    
    // Parse required scope
    const required = parseScope(requiredScope);
    if (!required) {
      return false;
    }
    
    // Check for module.ALL scope
    const moduleAllScope = `SDPOnDemand.${required.module}.ALL`;
    if (tenantScopes.includes(moduleAllScope)) {
      return true;
    }
    
    // Admin scope grants everything
    if (tenantScopes.includes(this.adminScope)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get missing scopes for a tool
   */
  getMissingScopes(toolName: string, tenantScopes: string[]): string[] {
    if (tenantScopes.includes(this.adminScope)) {
      return [];
    }
    
    const requiredScopes = TOOL_SCOPE_MAPPING[toolName] || [];
    return requiredScopes.filter(scope => 
      !this.hasScopePermission(scope, tenantScopes)
    );
  }
  
  /**
   * Get all tools available to tenant based on scopes
   */
  getAvailableTools(tenantScopes: string[]): string[] {
    const availableTools: string[] = [];
    
    for (const [toolName, requiredScopes] of Object.entries(TOOL_SCOPE_MAPPING)) {
      const hasScope = requiredScopes.some(scope => 
        this.hasScopePermission(scope, tenantScopes)
      );
      
      if (hasScope) {
        availableTools.push(toolName);
      }
    }
    
    return availableTools;
  }
  
  /**
   * Group scopes by module
   */
  groupScopesByModule(scopes: string[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};
    
    for (const scope of scopes) {
      const parsed = parseScope(scope);
      if (parsed) {
        if (!grouped[parsed.module]) {
          grouped[parsed.module] = [];
        }
        grouped[parsed.module]!.push(parsed.permission);
      }
    }
    
    return grouped;
  }
  
  /**
   * Validate scope format
   */
  validateScopes(scopes: string[]): {
    valid: string[];
    invalid: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    for (const scope of scopes) {
      if (scope === this.adminScope || parseScope(scope)) {
        valid.push(scope);
      } else {
        invalid.push(scope);
      }
    }
    
    return { valid, invalid };
  }
}

// Export singleton instance
export const scopeValidator = new ScopeValidator();