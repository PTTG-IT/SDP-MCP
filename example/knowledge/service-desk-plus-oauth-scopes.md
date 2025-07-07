# Service Desk Plus Cloud OAuth Scopes and Permissions Guide

*Last Updated: July 2025*

## Overview

Service Desk Plus Cloud uses OAuth 2.0 scopes to control API access at a granular level. This document provides comprehensive information about available scopes, their permissions, and best practices for multi-tenant MCP implementations.

## Scope Structure

### Format
```
SDPOnDemand.<module>.<operation>
```

Where:
- **SDPOnDemand**: Service identifier (constant)
- **module**: The SDP module (requests, problems, changes, etc.)
- **operation**: The allowed operation (READ, CREATE, UPDATE, DELETE, ALL)

### Examples
- `SDPOnDemand.requests.READ` - Read-only access to requests
- `SDPOnDemand.projects.ALL` - Full access to projects
- `SDPOnDemand.setup.CREATE` - Create access to setup/configuration

## Complete Scope Reference

### Requests Module
Manage service desk requests and incidents.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.requests.ALL` | Full access to requests | All request endpoints |
| `SDPOnDemand.requests.READ` | View requests | GET /api/v3/requests |
| `SDPOnDemand.requests.CREATE` | Create new requests | POST /api/v3/requests |
| `SDPOnDemand.requests.UPDATE` | Update existing requests | PUT /api/v3/requests/{id} |
| `SDPOnDemand.requests.DELETE` | Delete requests | DELETE /api/v3/requests/{id} |

**Sub-resources included:**
- Request notes
- Request tasks
- Request attachments
- Request history
- Request time entries
- Request approvals

### Problems Module
Manage problem records and root cause analysis.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.problems.ALL` | Full access to problems | All problem endpoints |
| `SDPOnDemand.problems.READ` | View problems | GET /api/v3/problems |
| `SDPOnDemand.problems.CREATE` | Create new problems | POST /api/v3/problems |
| `SDPOnDemand.problems.UPDATE` | Update existing problems | PUT /api/v3/problems/{id} |
| `SDPOnDemand.problems.DELETE` | Delete problems | DELETE /api/v3/problems/{id} |

**Sub-resources included:**
- Problem analysis
- Problem workarounds
- Problem symptoms
- Problem root causes
- Problem attachments

### Changes Module
Manage change requests and change advisory board (CAB) processes.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.changes.ALL` | Full access to changes | All change endpoints |
| `SDPOnDemand.changes.READ` | View changes | GET /api/v3/changes |
| `SDPOnDemand.changes.CREATE` | Create new changes | POST /api/v3/changes |
| `SDPOnDemand.changes.UPDATE` | Update existing changes | PUT /api/v3/changes/{id} |
| `SDPOnDemand.changes.DELETE` | Delete changes | DELETE /api/v3/changes/{id} |

**Sub-resources included:**
- Change tasks
- Change approvals
- CAB discussions
- Impact analysis
- Rollback plans

### Projects Module
Manage projects, milestones, and tasks.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.projects.ALL` | Full access to projects | All project endpoints |
| `SDPOnDemand.projects.READ` | View projects | GET /api/v3/projects |
| `SDPOnDemand.projects.CREATE` | Create new projects | POST /api/v3/projects |
| `SDPOnDemand.projects.UPDATE` | Update existing projects | PUT /api/v3/projects/{id} |
| `SDPOnDemand.projects.DELETE` | Delete projects | DELETE /api/v3/projects/{id} |

**Sub-resources included:**
- Project tasks
- Project milestones
- Project members
- Project comments
- Project attachments
- Gantt chart data

### Assets Module
Manage IT assets and inventory.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.assets.ALL` | Full access to assets | All asset endpoints |
| `SDPOnDemand.assets.READ` | View assets | GET /api/v3/assets |
| `SDPOnDemand.assets.CREATE` | Create new assets | POST /api/v3/assets |
| `SDPOnDemand.assets.UPDATE` | Update existing assets | PUT /api/v3/assets/{id} |
| `SDPOnDemand.assets.DELETE` | Delete assets | DELETE /api/v3/assets/{id} |

**Sub-resources included:**
- Asset relationships
- Asset history
- Software installations
- Hardware components
- Asset contracts

### CMDB Module
Configuration Management Database operations.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.cmdb.ALL` | Full access to CMDB | All CMDB endpoints |
| `SDPOnDemand.cmdb.READ` | View CIs | GET /api/v3/cmdb/ci |
| `SDPOnDemand.cmdb.CREATE` | Create new CIs | POST /api/v3/cmdb/ci |
| `SDPOnDemand.cmdb.UPDATE` | Update existing CIs | PUT /api/v3/cmdb/ci/{id} |
| `SDPOnDemand.cmdb.DELETE` | Delete CIs | DELETE /api/v3/cmdb/ci/{id} |

**Sub-resources included:**
- CI relationships
- CI types
- CI attributes
- Impact analysis
- Dependency mapping

### Solutions Module
Knowledge base and solution articles.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.solutions.ALL` | Full access to solutions | All solution endpoints |
| `SDPOnDemand.solutions.READ` | View solutions | GET /api/v3/solutions |
| `SDPOnDemand.solutions.CREATE` | Create new solutions | POST /api/v3/solutions |
| `SDPOnDemand.solutions.UPDATE` | Update existing solutions | PUT /api/v3/solutions/{id} |
| `SDPOnDemand.solutions.DELETE` | Delete solutions | DELETE /api/v3/solutions/{id} |

**Sub-resources included:**
- Solution topics
- Solution comments
- Solution ratings
- Solution attachments
- Solution keywords

### Setup Module
System configuration and administration.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.setup.ALL` | Full setup access | All setup endpoints |
| `SDPOnDemand.setup.READ` | View configurations | GET /api/v3/setup/* |
| `SDPOnDemand.setup.CREATE` | Create configurations | POST /api/v3/setup/* |
| `SDPOnDemand.setup.UPDATE` | Update configurations | PUT /api/v3/setup/* |
| `SDPOnDemand.setup.DELETE` | Delete configurations | DELETE /api/v3/setup/* |

**Configuration areas included:**
- Categories
- Priorities
- Statuses
- Request templates
- Approval workflows
- Business rules
- SLA policies

### Users Module
User and technician management.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.users.ALL` | Full user management | All user endpoints |
| `SDPOnDemand.users.READ` | View users | GET /api/v3/users |
| `SDPOnDemand.users.CREATE` | Create new users | POST /api/v3/users |
| `SDPOnDemand.users.UPDATE` | Update existing users | PUT /api/v3/users/{id} |
| `SDPOnDemand.users.DELETE` | Delete users | DELETE /api/v3/users/{id} |

**Sub-resources included:**
- User profiles
- Technician assignments
- User groups
- Roles and permissions
- Department associations

### Releases Module
Release management and deployment tracking.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.releases.ALL` | Full access to releases | All release endpoints |
| `SDPOnDemand.releases.READ` | View releases | GET /api/v3/releases |
| `SDPOnDemand.releases.CREATE` | Create new releases | POST /api/v3/releases |
| `SDPOnDemand.releases.UPDATE` | Update existing releases | PUT /api/v3/releases/{id} |
| `SDPOnDemand.releases.DELETE` | Delete releases | DELETE /api/v3/releases/{id} |

### Contracts Module
Contract and vendor management.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.contracts.ALL` | Full access to contracts | All contract endpoints |
| `SDPOnDemand.contracts.READ` | View contracts | GET /api/v3/contracts |
| `SDPOnDemand.contracts.CREATE` | Create new contracts | POST /api/v3/contracts |
| `SDPOnDemand.contracts.UPDATE` | Update existing contracts | PUT /api/v3/contracts/{id} |
| `SDPOnDemand.contracts.DELETE` | Delete contracts | DELETE /api/v3/contracts/{id} |

### Purchase Module
Purchase order management.

| Scope | Description | API Endpoints |
|-------|-------------|---------------|
| `SDPOnDemand.purchase.ALL` | Full access to purchases | All purchase endpoints |
| `SDPOnDemand.purchase.READ` | View purchase orders | GET /api/v3/purchases |
| `SDPOnDemand.purchase.CREATE` | Create new POs | POST /api/v3/purchases |
| `SDPOnDemand.purchase.UPDATE` | Update existing POs | PUT /api/v3/purchases/{id} |
| `SDPOnDemand.purchase.DELETE` | Delete POs | DELETE /api/v3/purchases/{id} |

## Scope Combinations

### Common Permission Sets

#### Read-Only Access
```javascript
const readOnlyScopes = [
  'SDPOnDemand.requests.READ',
  'SDPOnDemand.problems.READ',
  'SDPOnDemand.changes.READ',
  'SDPOnDemand.assets.READ',
  'SDPOnDemand.users.READ',
  'SDPOnDemand.setup.READ'
];
```

#### Help Desk Technician
```javascript
const helpDeskScopes = [
  'SDPOnDemand.requests.ALL',
  'SDPOnDemand.users.READ',
  'SDPOnDemand.assets.READ',
  'SDPOnDemand.solutions.READ',
  'SDPOnDemand.setup.READ'
];
```

#### Change Manager
```javascript
const changeManagerScopes = [
  'SDPOnDemand.changes.ALL',
  'SDPOnDemand.problems.ALL',
  'SDPOnDemand.releases.ALL',
  'SDPOnDemand.users.READ',
  'SDPOnDemand.assets.READ',
  'SDPOnDemand.setup.READ'
];
```

#### Project Manager
```javascript
const projectManagerScopes = [
  'SDPOnDemand.projects.ALL',
  'SDPOnDemand.requests.CREATE',
  'SDPOnDemand.requests.UPDATE',
  'SDPOnDemand.users.READ',
  'SDPOnDemand.setup.READ'
];
```

#### Asset Manager
```javascript
const assetManagerScopes = [
  'SDPOnDemand.assets.ALL',
  'SDPOnDemand.cmdb.ALL',
  'SDPOnDemand.contracts.ALL',
  'SDPOnDemand.purchase.ALL',
  'SDPOnDemand.users.READ',
  'SDPOnDemand.setup.READ'
];
```

#### System Administrator
```javascript
const adminScopes = [
  'SDPOnDemand.requests.ALL',
  'SDPOnDemand.problems.ALL',
  'SDPOnDemand.changes.ALL',
  'SDPOnDemand.projects.ALL',
  'SDPOnDemand.assets.ALL',
  'SDPOnDemand.cmdb.ALL',
  'SDPOnDemand.solutions.ALL',
  'SDPOnDemand.setup.ALL',
  'SDPOnDemand.users.ALL',
  'SDPOnDemand.releases.ALL',
  'SDPOnDemand.contracts.ALL',
  'SDPOnDemand.purchase.ALL'
];
```

## Scope Validation in MCP Server

### Implementation Example

```typescript
interface MCPTool {
  name: string;
  requiredScopes: string[];
  optionalScopes?: string[];
}

class ScopeValidator {
  private toolScopeMap: Map<string, MCPTool> = new Map([
    ['create_request', {
      name: 'create_request',
      requiredScopes: ['SDPOnDemand.requests.CREATE'],
      optionalScopes: ['SDPOnDemand.users.READ'] // For requester lookup
    }],
    ['update_request_status', {
      name: 'update_request_status',
      requiredScopes: ['SDPOnDemand.requests.UPDATE']
    }],
    ['assign_technician', {
      name: 'assign_technician',
      requiredScopes: [
        'SDPOnDemand.requests.UPDATE',
        'SDPOnDemand.users.READ'
      ]
    }],
    ['create_problem_from_request', {
      name: 'create_problem_from_request',
      requiredScopes: [
        'SDPOnDemand.requests.READ',
        'SDPOnDemand.problems.CREATE'
      ]
    }],
    ['add_solution', {
      name: 'add_solution',
      requiredScopes: ['SDPOnDemand.solutions.CREATE']
    }],
    ['create_change_request', {
      name: 'create_change_request',
      requiredScopes: ['SDPOnDemand.changes.CREATE'],
      optionalScopes: [
        'SDPOnDemand.assets.READ', // For impact analysis
        'SDPOnDemand.users.READ'   // For CAB members
      ]
    }],
    ['manage_project', {
      name: 'manage_project',
      requiredScopes: ['SDPOnDemand.projects.ALL']
    }],
    ['update_asset', {
      name: 'update_asset',
      requiredScopes: ['SDPOnDemand.assets.UPDATE'],
      optionalScopes: ['SDPOnDemand.cmdb.UPDATE'] // For CI updates
    }]
  ]);

  validateToolAccess(
    tool: string, 
    grantedScopes: string[]
  ): ValidationResult {
    const toolConfig = this.toolScopeMap.get(tool);
    
    if (!toolConfig) {
      return {
        valid: false,
        error: `Unknown tool: ${tool}`
      };
    }
    
    // Check required scopes
    const missingRequired = toolConfig.requiredScopes.filter(
      scope => !this.hasScope(grantedScopes, scope)
    );
    
    if (missingRequired.length > 0) {
      return {
        valid: false,
        error: `Missing required scopes: ${missingRequired.join(', ')}`,
        requiredScopes: toolConfig.requiredScopes,
        grantedScopes
      };
    }
    
    // Check optional scopes (for warnings)
    const missingOptional = (toolConfig.optionalScopes || []).filter(
      scope => !this.hasScope(grantedScopes, scope)
    );
    
    return {
      valid: true,
      warnings: missingOptional.length > 0 
        ? `Limited functionality without: ${missingOptional.join(', ')}`
        : undefined
    };
  }
  
  private hasScope(grantedScopes: string[], requiredScope: string): boolean {
    // Direct match
    if (grantedScopes.includes(requiredScope)) {
      return true;
    }
    
    // Check if user has ALL permission for the module
    const [service, module, operation] = requiredScope.split('.');
    const allScope = `${service}.${module}.ALL`;
    
    return grantedScopes.includes(allScope);
  }
}
```

## Best Practices for Scope Management

### 1. Principle of Least Privilege

Always request the minimum scopes necessary:

```typescript
// Bad - Requesting all permissions
const scopes = ['SDPOnDemand.requests.ALL'];

// Good - Requesting specific permissions
const scopes = [
  'SDPOnDemand.requests.READ',
  'SDPOnDemand.requests.CREATE'
];
```

### 2. Scope Grouping by Role

```typescript
class ScopeTemplates {
  static readonly VIEWER = [
    'SDPOnDemand.requests.READ',
    'SDPOnDemand.problems.READ',
    'SDPOnDemand.changes.READ',
    'SDPOnDemand.assets.READ'
  ];
  
  static readonly TECHNICIAN = [
    ...ScopeTemplates.VIEWER,
    'SDPOnDemand.requests.UPDATE',
    'SDPOnDemand.requests.CREATE',
    'SDPOnDemand.solutions.READ'
  ];
  
  static readonly MANAGER = [
    ...ScopeTemplates.TECHNICIAN,
    'SDPOnDemand.problems.ALL',
    'SDPOnDemand.changes.ALL',
    'SDPOnDemand.projects.ALL'
  ];
  
  static forRole(role: string): string[] {
    switch (role) {
      case 'viewer': return ScopeTemplates.VIEWER;
      case 'technician': return ScopeTemplates.TECHNICIAN;
      case 'manager': return ScopeTemplates.MANAGER;
      default: return ScopeTemplates.VIEWER;
    }
  }
}
```

### 3. Dynamic Scope Checking

```typescript
class DynamicScopeChecker {
  async checkOperationScopes(
    operation: string, 
    context: OperationContext
  ): Promise<string[]> {
    const baseScopes = this.getBaseScopes(operation);
    const additionalScopes = [];
    
    // Add conditional scopes based on context
    if (context.includesAttachments) {
      additionalScopes.push('SDPOnDemand.attachments.CREATE');
    }
    
    if (context.includesApprovals) {
      additionalScopes.push('SDPOnDemand.approvals.CREATE');
    }
    
    if (context.requiresUserLookup) {
      additionalScopes.push('SDPOnDemand.users.READ');
    }
    
    return [...baseScopes, ...additionalScopes];
  }
}
```

### 4. Scope Migration Strategy

When updating scope requirements:

```typescript
class ScopeMigration {
  async migrateScopes(tenantId: string, oldScopes: string[]): Promise<string[]> {
    const scopeMapping = {
      // Old scope -> New scope(s)
      'SDPOnDemand.tickets.ALL': [
        'SDPOnDemand.requests.ALL',
        'SDPOnDemand.problems.ALL'
      ],
      'SDPOnDemand.configuration.READ': [
        'SDPOnDemand.setup.READ',
        'SDPOnDemand.cmdb.READ'
      ]
    };
    
    const newScopes = new Set<string>();
    
    for (const oldScope of oldScopes) {
      if (scopeMapping[oldScope]) {
        scopeMapping[oldScope].forEach(s => newScopes.add(s));
      } else {
        newScopes.add(oldScope); // Keep unchanged scopes
      }
    }
    
    return Array.from(newScopes);
  }
}
```

## OAuth Token Management with Scopes

### Token Structure

```typescript
interface SDPOAuthToken {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // Seconds (typically 3600)
  scope: string; // Space-separated scopes
  api_domain: string;
}

// Example token response
{
  "access_token": "1000.8cb194a6e2c91a1cf7b83d3b4c69a0c4.4638936dfef26dd8cbbc8658c6dd3e9f",
  "refresh_token": "1000.a41e5f3d1c73f6f7f82c2b16c2f19c27.ae821cb52f3c541e2a84f65e5d8634d2",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "SDPOnDemand.requests.ALL SDPOnDemand.problems.READ SDPOnDemand.setup.READ",
  "api_domain": "https://sdpondemand.manageengine.com"
}
```

### Scope Verification

```typescript
class TokenScopeVerifier {
  verifyScopesInToken(token: SDPOAuthToken, requiredScopes: string[]): boolean {
    const grantedScopes = token.scope.split(' ');
    
    return requiredScopes.every(required => 
      this.hasScope(grantedScopes, required)
    );
  }
  
  extractModuleAccess(token: SDPOAuthToken): Record<string, string[]> {
    const scopes = token.scope.split(' ');
    const moduleAccess: Record<string, string[]> = {};
    
    for (const scope of scopes) {
      const [service, module, operation] = scope.split('.');
      if (service === 'SDPOnDemand') {
        if (!moduleAccess[module]) {
          moduleAccess[module] = [];
        }
        moduleAccess[module].push(operation);
      }
    }
    
    return moduleAccess;
  }
}
```

## Error Handling for Scope Issues

### Common Scope-Related Errors

```typescript
enum ScopeErrorCode {
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  INVALID_SCOPE = 'INVALID_SCOPE',
  SCOPE_NOT_GRANTED = 'SCOPE_NOT_GRANTED',
  TOKEN_SCOPE_MISMATCH = 'TOKEN_SCOPE_MISMATCH'
}

class ScopeError extends Error {
  constructor(
    public code: ScopeErrorCode,
    public message: string,
    public requiredScopes: string[],
    public grantedScopes: string[]
  ) {
    super(message);
    this.name = 'ScopeError';
  }
  
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        required_scopes: this.requiredScopes,
        granted_scopes: this.grantedScopes,
        help_url: 'https://docs.example.com/oauth/scopes'
      }
    };
  }
}
```

### Handling Scope Errors in API Responses

```typescript
class SDPAPIErrorHandler {
  handleScopeError(error: any): void {
    if (error.response?.status === 403) {
      const errorData = error.response.data;
      
      if (errorData.error_code === 'INSUFFICIENT_SCOPE') {
        throw new ScopeError(
          ScopeErrorCode.INSUFFICIENT_SCOPE,
          'The access token does not have sufficient scope',
          errorData.required_scopes || [],
          errorData.granted_scopes || []
        );
      }
    }
    
    // Re-throw if not a scope error
    throw error;
  }
}
```

## Monitoring Scope Usage

### Metrics Collection

```typescript
class ScopeMetrics {
  private metrics = {
    scopeRequests: new Counter({
      name: 'sdp_scope_requests_total',
      help: 'Total scope requests by scope and result',
      labelNames: ['scope', 'granted', 'tenant_id']
    }),
    
    insufficientScopeErrors: new Counter({
      name: 'sdp_insufficient_scope_errors_total',
      help: 'Total insufficient scope errors',
      labelNames: ['required_scope', 'tool', 'tenant_id']
    }),
    
    scopeUsageByModule: new Gauge({
      name: 'sdp_scope_usage_by_module',
      help: 'Number of tenants using each module',
      labelNames: ['module']
    })
  };
  
  recordScopeRequest(scope: string, granted: boolean, tenantId: string) {
    this.metrics.scopeRequests.inc({
      scope,
      granted: granted.toString(),
      tenant_id: tenantId
    });
  }
  
  recordInsufficientScope(requiredScope: string, tool: string, tenantId: string) {
    this.metrics.insufficientScopeErrors.inc({
      required_scope: requiredScope,
      tool,
      tenant_id: tenantId
    });
  }
}
```

## Security Considerations

### 1. Scope Tampering Prevention

```typescript
class ScopeIntegrityChecker {
  private readonly HMAC_KEY = process.env.SCOPE_HMAC_KEY!;
  
  generateScopeSignature(scopes: string[]): string {
    const sortedScopes = scopes.sort().join(',');
    const hmac = createHmac('sha256', this.HMAC_KEY);
    hmac.update(sortedScopes);
    return hmac.digest('hex');
  }
  
  verifyScopeIntegrity(scopes: string[], signature: string): boolean {
    const expectedSignature = this.generateScopeSignature(scopes);
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
```

### 2. Scope Escalation Prevention

```typescript
class ScopeEscalationPrevention {
  async validateScopeRequest(
    requestedScopes: string[],
    maxAllowedScopes: string[]
  ): Promise<void> {
    const unauthorized = requestedScopes.filter(
      scope => !maxAllowedScopes.includes(scope)
    );
    
    if (unauthorized.length > 0) {
      await this.alertSecurityTeam({
        event: 'scope_escalation_attempt',
        requestedScopes,
        unauthorizedScopes: unauthorized,
        timestamp: new Date()
      });
      
      throw new SecurityError(
        'Attempted to request unauthorized scopes'
      );
    }
  }
}
```

## References

- [Service Desk Plus OAuth 2.0 Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/oauth-2.0.html)
- [OAuth 2.0 Scope RFC](https://tools.ietf.org/html/rfc6749#section-3.3)
- [Zoho OAuth Scopes Guide](https://www.zoho.com/accounts/protocol/oauth/scopes.html)