# Multi-User MCP Server Architecture with Self-Client Certificates

*Last Updated: July 2025*

## Overview

This document details the architecture for a multi-tenant MCP server where each client has their own self-client certificate for Service Desk Plus Cloud API access. This approach provides strong isolation between tenants while maintaining a single MCP server infrastructure.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────────────┐         ┌──────────────────┐
│  MCP Client 1   │         │                         │         │                  │
│ (User A's Claude)│◄────────►                         │         │  SDP Cloud API  │
├─────────────────┤         │   Multi-Tenant MCP      │         │  (User A's Org)  │
│  .mcp.json      │         │        Server           │◄────────►──────────────────┤
│  - client_id_a  │         │                         │         │                  │
└─────────────────┘         │  ┌─────────────────┐   │         │  SDP Cloud API  │
                           │  │ Tenant Isolation │   │         │  (User B's Org)  │
┌─────────────────┐         │  │    Manager      │   │◄────────►──────────────────┤
│  MCP Client 2   │         │  └─────────────────┘   │         │                  │
│ (User B's Claude)│◄────────►                         │         │  SDP Cloud API  │
├─────────────────┤         │  ┌─────────────────┐   │         │  (User C's Org)  │
│  .mcp.json      │         │  │  OAuth Token    │   │◄────────►──────────────────┘
│  - client_id_b  │         │  │    Vault        │   │
└─────────────────┘         │  └─────────────────┘   │
                           └─────────────────────────┘
```

## Multi-Tenant Design Principles

### 1. Complete Tenant Isolation
- Each client operates in a completely isolated context
- No shared state between tenants
- Separate OAuth tokens per tenant
- Independent rate limiting per tenant
- Isolated error handling and circuit breakers

### 2. Self-Client Certificate Model
- Each tenant registers their own self-client application in Zoho/Service Desk Plus
- Tenants manage their own OAuth credentials
- MCP server never stores raw credentials, only encrypted tokens
- Automatic token refresh per tenant

### 3. Secure Credential Management
- Client certificates stored encrypted at rest
- Per-tenant encryption keys derived from master key
- Hardware Security Module (HSM) support for key management
- Regular key rotation without service interruption

## Self-Client OAuth Configuration

### What is a Self-Client?

Self-Client applications in Service Desk Plus/Zoho are designed for backend automation without user interaction. They're perfect for MCP servers because:

1. **No User Consent Required**: Operates with pre-authorized permissions
2. **Long-Lived Tokens**: Refresh tokens don't expire
3. **Programmatic Access**: Designed for server-to-server communication
4. **Specific Scopes**: Can be limited to exact permissions needed

### Setting Up Self-Client for Each Tenant

#### Step 1: Create Self-Client Application

Each tenant must create their own self-client application:

```bash
# 1. Navigate to appropriate Zoho API Console based on region:
# - US: https://api-console.zoho.com/
# - EU: https://api-console.zoho.eu/
# - IN: https://api-console.zoho.in/
# - AU: https://api-console.zoho.com.au/
# - JP: https://api-console.zoho.jp/

# 2. Create Self Client:
# - Select "Self Client" option
# - Click "CREATE NOW"
# - Note the Client ID and Client Secret
```

#### Step 2: Generate Authorization Code

```javascript
// Generate authorization code with required scopes
const scopes = [
  'SDPOnDemand.requests.ALL',      // Full access to requests
  'SDPOnDemand.problems.READ',     // Read-only access to problems
  'SDPOnDemand.changes.CREATE',    // Create changes
  'SDPOnDemand.projects.ALL',      // Full access to projects
  'SDPOnDemand.assets.READ',       // Read assets
  'SDPOnDemand.setup.READ'         // Read configuration
].join(',');

// In Zoho Console, generate code with:
// - Scopes: As defined above
// - Time Duration: 10 minutes (for initial setup)
// - Description: "MCP Server Integration"
```

#### Step 3: Exchange Code for Refresh Token

```bash
# Execute this command to get refresh token
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"

# Response:
# {
#   "access_token": "1000.xxxxxx",
#   "refresh_token": "1000.xxxxxx",  # Save this - doesn't expire
#   "token_type": "Bearer",
#   "expires_in": 3600
# }
```

## MCP Server Implementation

### 1. Tenant Registration

```typescript
interface TenantConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  dataCenter: 'US' | 'EU' | 'IN' | 'AU' | 'JP' | 'CN' | 'CA' | 'UK' | 'SA';
  allowedScopes: string[];
  metadata: {
    organizationName: string;
    contactEmail: string;
    registeredAt: Date;
  };
}

class TenantManager {
  private tenants = new Map<string, EncryptedTenantConfig>();
  
  async registerTenant(config: TenantConfig): Promise<void> {
    // Validate tenant doesn't already exist
    if (this.tenants.has(config.tenantId)) {
      throw new Error('Tenant already registered');
    }
    
    // Validate OAuth credentials by attempting token exchange
    await this.validateOAuthCredentials(config);
    
    // Encrypt sensitive data
    const encrypted = await this.encryptTenantConfig(config);
    
    // Store in database
    await this.db.query(
      `INSERT INTO tenants 
       (tenant_id, encrypted_config, data_center, allowed_scopes, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        config.tenantId,
        encrypted.config,
        config.dataCenter,
        JSON.stringify(config.allowedScopes),
        JSON.stringify(config.metadata)
      ]
    );
    
    // Cache for performance
    this.tenants.set(config.tenantId, encrypted);
    
    // Audit log
    await this.auditLogger.log({
      event: 'tenant_registered',
      tenantId: config.tenantId,
      timestamp: new Date(),
    });
  }
  
  private async validateOAuthCredentials(config: TenantConfig): Promise<void> {
    const tokenEndpoint = this.getTokenEndpoint(config.dataCenter);
    
    try {
      const response = await axios.post(tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });
      
      if (!response.data.access_token) {
        throw new Error('Invalid OAuth credentials');
      }
    } catch (error) {
      throw new Error(`OAuth validation failed: ${error.message}`);
    }
  }
}
```

### 2. Per-Tenant Token Management

```typescript
class MultiTenantTokenManager {
  private tokenCache = new Map<string, CachedToken>();
  private refreshLocks = new Map<string, Promise<OAuthToken>>();
  
  async getAccessToken(tenantId: string): Promise<string> {
    // Check cache first
    const cached = this.tokenCache.get(tenantId);
    if (cached && !this.isExpiringSoon(cached)) {
      return cached.accessToken;
    }
    
    // Check if refresh is already in progress
    const existingRefresh = this.refreshLocks.get(tenantId);
    if (existingRefresh) {
      const token = await existingRefresh;
      return token.accessToken;
    }
    
    // Perform token refresh
    const refreshPromise = this.refreshToken(tenantId);
    this.refreshLocks.set(tenantId, refreshPromise);
    
    try {
      const token = await refreshPromise;
      return token.accessToken;
    } finally {
      this.refreshLocks.delete(tenantId);
    }
  }
  
  private async refreshToken(tenantId: string): Promise<OAuthToken> {
    const tenant = await this.getTenantConfig(tenantId);
    const tokenEndpoint = this.getTokenEndpoint(tenant.dataCenter);
    
    try {
      const response = await axios.post(tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: tenant.refreshToken,
        client_id: tenant.clientId,
        client_secret: tenant.clientSecret,
      });
      
      const token: OAuthToken = {
        accessToken: response.data.access_token,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        tokenType: response.data.token_type,
      };
      
      // Cache the new token
      this.tokenCache.set(tenantId, {
        ...token,
        cachedAt: new Date(),
      });
      
      // Store encrypted token in database
      await this.storeToken(tenantId, token);
      
      // Emit metrics
      this.metrics.increment('oauth_token_refreshed', { tenant_id: tenantId });
      
      return token;
    } catch (error) {
      this.logger.error('Token refresh failed', {
        tenantId,
        error: error.message,
      });
      
      // Emit alert for ops team
      await this.alertManager.sendAlert({
        severity: 'high',
        title: 'OAuth Token Refresh Failed',
        description: `Failed to refresh token for tenant ${tenantId}`,
        tenantId,
      });
      
      throw error;
    }
  }
  
  private isExpiringSoon(token: CachedToken): boolean {
    const bufferMinutes = 5;
    const expiryTime = token.expiresAt.getTime() - (bufferMinutes * 60 * 1000);
    return Date.now() >= expiryTime;
  }
}
```

### 3. Tenant-Aware MCP Request Handler

```typescript
class MultiTenantMCPHandler {
  constructor(
    private tokenManager: MultiTenantTokenManager,
    private tenantManager: TenantManager,
    private sdpClientFactory: SDPClientFactory
  ) {}
  
  async handleToolCall(
    request: MCPToolRequest,
    context: MCPRequestContext
  ): Promise<MCPToolResponse> {
    const { tenantId } = context;
    
    // Validate tenant exists and is active
    const tenant = await this.tenantManager.getTenant(tenantId);
    if (!tenant || !tenant.isActive) {
      throw new ForbiddenError('Tenant not found or inactive');
    }
    
    // Check if tenant has permission for this tool
    if (!this.hasToolPermission(tenant, request.tool)) {
      throw new ForbiddenError(`Tenant lacks permission for tool: ${request.tool}`);
    }
    
    // Get fresh access token
    const accessToken = await this.tokenManager.getAccessToken(tenantId);
    
    // Create tenant-specific SDP client
    const sdpClient = this.sdpClientFactory.createClient({
      tenantId,
      accessToken,
      dataCenter: tenant.dataCenter,
    });
    
    // Execute tool with tenant context
    try {
      const result = await this.executeToolForTenant(
        request,
        sdpClient,
        tenant
      );
      
      // Audit successful execution
      await this.auditLogger.log({
        event: 'tool_executed',
        tenantId,
        tool: request.tool,
        success: true,
        timestamp: new Date(),
      });
      
      return result;
    } catch (error) {
      // Audit failed execution
      await this.auditLogger.log({
        event: 'tool_execution_failed',
        tenantId,
        tool: request.tool,
        error: error.message,
        timestamp: new Date(),
      });
      
      throw error;
    }
  }
  
  private hasToolPermission(tenant: TenantConfig, tool: string): boolean {
    // Map tools to required scopes
    const toolScopeMap: Record<string, string[]> = {
      'create_request': ['SDPOnDemand.requests.CREATE', 'SDPOnDemand.requests.ALL'],
      'update_request': ['SDPOnDemand.requests.UPDATE', 'SDPOnDemand.requests.ALL'],
      'get_request': ['SDPOnDemand.requests.READ', 'SDPOnDemand.requests.ALL'],
      'create_project': ['SDPOnDemand.projects.CREATE', 'SDPOnDemand.projects.ALL'],
      // ... more mappings
    };
    
    const requiredScopes = toolScopeMap[tool] || [];
    return requiredScopes.some(scope => tenant.allowedScopes.includes(scope));
  }
}
```

## OAuth Scope Management

### Available SDPOnDemand Scopes

Service Desk Plus Cloud uses a hierarchical scope system:

```typescript
enum SDPScope {
  // Requests Module
  REQUESTS_ALL = 'SDPOnDemand.requests.ALL',
  REQUESTS_READ = 'SDPOnDemand.requests.READ',
  REQUESTS_CREATE = 'SDPOnDemand.requests.CREATE',
  REQUESTS_UPDATE = 'SDPOnDemand.requests.UPDATE',
  REQUESTS_DELETE = 'SDPOnDemand.requests.DELETE',
  
  // Problems Module
  PROBLEMS_ALL = 'SDPOnDemand.problems.ALL',
  PROBLEMS_READ = 'SDPOnDemand.problems.READ',
  PROBLEMS_CREATE = 'SDPOnDemand.problems.CREATE',
  PROBLEMS_UPDATE = 'SDPOnDemand.problems.UPDATE',
  PROBLEMS_DELETE = 'SDPOnDemand.problems.DELETE',
  
  // Changes Module
  CHANGES_ALL = 'SDPOnDemand.changes.ALL',
  CHANGES_READ = 'SDPOnDemand.changes.READ',
  CHANGES_CREATE = 'SDPOnDemand.changes.CREATE',
  CHANGES_UPDATE = 'SDPOnDemand.changes.UPDATE',
  CHANGES_DELETE = 'SDPOnDemand.changes.DELETE',
  
  // Projects Module
  PROJECTS_ALL = 'SDPOnDemand.projects.ALL',
  PROJECTS_READ = 'SDPOnDemand.projects.READ',
  PROJECTS_CREATE = 'SDPOnDemand.projects.CREATE',
  PROJECTS_UPDATE = 'SDPOnDemand.projects.UPDATE',
  PROJECTS_DELETE = 'SDPOnDemand.projects.DELETE',
  
  // Assets Module
  ASSETS_ALL = 'SDPOnDemand.assets.ALL',
  ASSETS_READ = 'SDPOnDemand.assets.READ',
  ASSETS_CREATE = 'SDPOnDemand.assets.CREATE',
  ASSETS_UPDATE = 'SDPOnDemand.assets.UPDATE',
  ASSETS_DELETE = 'SDPOnDemand.assets.DELETE',
  
  // CMDB Module
  CMDB_ALL = 'SDPOnDemand.cmdb.ALL',
  CMDB_READ = 'SDPOnDemand.cmdb.READ',
  CMDB_CREATE = 'SDPOnDemand.cmdb.CREATE',
  CMDB_UPDATE = 'SDPOnDemand.cmdb.UPDATE',
  CMDB_DELETE = 'SDPOnDemand.cmdb.DELETE',
  
  // Solutions Module
  SOLUTIONS_ALL = 'SDPOnDemand.solutions.ALL',
  SOLUTIONS_READ = 'SDPOnDemand.solutions.READ',
  SOLUTIONS_CREATE = 'SDPOnDemand.solutions.CREATE',
  SOLUTIONS_UPDATE = 'SDPOnDemand.solutions.UPDATE',
  SOLUTIONS_DELETE = 'SDPOnDemand.solutions.DELETE',
  
  // Setup/Configuration Module
  SETUP_ALL = 'SDPOnDemand.setup.ALL',
  SETUP_READ = 'SDPOnDemand.setup.READ',
  SETUP_CREATE = 'SDPOnDemand.setup.CREATE',
  SETUP_UPDATE = 'SDPOnDemand.setup.UPDATE',
  SETUP_DELETE = 'SDPOnDemand.setup.DELETE',
  
  // User Management
  USERS_ALL = 'SDPOnDemand.users.ALL',
  USERS_READ = 'SDPOnDemand.users.READ',
  USERS_CREATE = 'SDPOnDemand.users.CREATE',
  USERS_UPDATE = 'SDPOnDemand.users.UPDATE',
  USERS_DELETE = 'SDPOnDemand.users.DELETE',
}
```

### Scope Validation

```typescript
class ScopeValidator {
  validateScopes(requestedScopes: string[], tenantScopes: string[]): void {
    const invalidScopes = requestedScopes.filter(
      scope => !tenantScopes.includes(scope)
    );
    
    if (invalidScopes.length > 0) {
      throw new ForbiddenError(
        `Tenant lacks required scopes: ${invalidScopes.join(', ')}`
      );
    }
  }
  
  getRequiredScopesForTool(toolName: string): string[] {
    const toolScopeMapping: Record<string, string[]> = {
      // Request tools
      'create_request': ['SDPOnDemand.requests.CREATE'],
      'update_request': ['SDPOnDemand.requests.UPDATE'],
      'get_request': ['SDPOnDemand.requests.READ'],
      'delete_request': ['SDPOnDemand.requests.DELETE'],
      'list_requests': ['SDPOnDemand.requests.READ'],
      
      // Project tools
      'create_project': ['SDPOnDemand.projects.CREATE'],
      'update_project': ['SDPOnDemand.projects.UPDATE'],
      'get_project': ['SDPOnDemand.projects.READ'],
      'add_project_task': ['SDPOnDemand.projects.UPDATE'],
      
      // Asset tools
      'get_asset': ['SDPOnDemand.assets.READ'],
      'update_asset': ['SDPOnDemand.assets.UPDATE'],
      
      // Change tools
      'create_change': ['SDPOnDemand.changes.CREATE'],
      'approve_change': ['SDPOnDemand.changes.UPDATE'],
      
      // Setup tools
      'get_categories': ['SDPOnDemand.setup.READ'],
      'get_priorities': ['SDPOnDemand.setup.READ'],
      'get_statuses': ['SDPOnDemand.setup.READ'],
    };
    
    return toolScopeMapping[toolName] || [];
  }
}
```

## Security Architecture for Multi-Tenant

### 1. Tenant Isolation

```typescript
class TenantIsolationManager {
  private tenantContexts = new Map<string, TenantContext>();
  
  async createTenantContext(tenantId: string): Promise<TenantContext> {
    return {
      tenantId,
      rateLimiter: this.createTenantRateLimiter(tenantId),
      circuitBreaker: this.createTenantCircuitBreaker(tenantId),
      metricsCollector: this.createTenantMetrics(tenantId),
      errorHandler: this.createTenantErrorHandler(tenantId),
      cache: this.createTenantCache(tenantId),
    };
  }
  
  private createTenantRateLimiter(tenantId: string): RateLimiter {
    return new RateLimiterRedis({
      storeClient: this.redis,
      keyPrefix: `rl:tenant:${tenantId}`,
      points: 100, // Per tenant limit
      duration: 60, // Per minute
      blockDuration: 300, // 5 minute block
    });
  }
  
  private createTenantCircuitBreaker(tenantId: string): CircuitBreaker {
    return new CircuitBreaker({
      name: `tenant:${tenantId}`,
      threshold: 5,
      timeout: 60000,
      resetTimeout: 30000,
      onOpen: () => {
        this.logger.warn(`Circuit breaker opened for tenant ${tenantId}`);
        this.notifyTenant(tenantId, 'service_degraded');
      },
    });
  }
}
```

### 2. Encryption Per Tenant

```typescript
class TenantEncryption {
  private masterKey: Buffer;
  
  constructor(masterKeyHex: string) {
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
  }
  
  async encryptForTenant(
    tenantId: string, 
    data: string
  ): Promise<EncryptedData> {
    // Derive tenant-specific key
    const tenantKey = await this.deriveTenantKey(tenantId);
    
    // Generate random IV
    const iv = randomBytes(16);
    
    // Create cipher with tenant key
    const cipher = createCipheriv('aes-256-gcm', tenantKey, iv);
    
    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      version: 1,
    };
  }
  
  private async deriveTenantKey(tenantId: string): Promise<Buffer> {
    // Use HKDF to derive tenant-specific key
    const salt = Buffer.from('mcp-tenant-key-v1');
    const info = Buffer.from(`tenant:${tenantId}`);
    
    return new Promise((resolve, reject) => {
      hkdf(this.masterKey, 32, { salt, info }, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }
}
```

### 3. Audit Logging Per Tenant

```typescript
interface TenantAuditLog {
  id: string;
  tenantId: string;
  timestamp: Date;
  eventType: string;
  userId?: string;
  action: string;
  resource?: string;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
  ipAddress?: string;
  duration?: number;
}

class TenantAuditLogger {
  async logTenantAction(log: Omit<TenantAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const fullLog: TenantAuditLog = {
      id: generateUUID(),
      timestamp: new Date(),
      ...log,
    };
    
    // Store in tenant-specific partition
    await this.db.query(
      `INSERT INTO tenant_audit_logs 
       (id, tenant_id, timestamp, event_type, user_id, action, 
        resource, result, metadata, ip_address, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        fullLog.id,
        fullLog.tenantId,
        fullLog.timestamp,
        fullLog.eventType,
        fullLog.userId,
        fullLog.action,
        fullLog.resource,
        fullLog.result,
        JSON.stringify(fullLog.metadata),
        fullLog.ipAddress,
        fullLog.duration,
      ]
    );
    
    // Send to tenant-specific log stream if configured
    if (this.hasTenantLogStream(fullLog.tenantId)) {
      await this.sendToTenantLogStream(fullLog);
    }
  }
}
```

## Client Configuration

### MCP Client .mcp.json Format

Each client needs a configuration file pointing to the multi-tenant MCP server:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "node",
      "args": ["/path/to/mcp-client-connector.js"],
      "env": {
        "MCP_SERVER_URL": "https://mcp.yourdomain.com",
        "MCP_TENANT_ID": "tenant-unique-id",
        "MCP_CLIENT_CERTIFICATE": "/path/to/client-cert.pem",
        "MCP_CLIENT_KEY": "/path/to/client-key.pem",
        "MCP_API_KEY": "tenant-specific-api-key"
      }
    }
  }
}
```

### Client Connector Implementation

```typescript
// mcp-client-connector.js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

class MultiTenantMCPClient {
  private client: Client;
  
  async connect() {
    const transport = new SSEClientTransport(
      new URL(`${process.env.MCP_SERVER_URL}/mcp/connect`),
      {
        headers: {
          'X-Tenant-ID': process.env.MCP_TENANT_ID,
          'Authorization': `Bearer ${process.env.MCP_API_KEY}`,
          'X-Client-Certificate': await this.loadClientCertificate(),
        },
      }
    );
    
    this.client = new Client(
      {
        name: 'service-desk-plus-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    await this.client.connect(transport);
    
    // List available tools for this tenant
    const tools = await this.client.listTools();
    console.log('Available tools for tenant:', tools);
  }
  
  private async loadClientCertificate(): Promise<string> {
    // Load and validate client certificate
    const cert = await fs.readFile(process.env.MCP_CLIENT_CERTIFICATE, 'utf8');
    return cert;
  }
}

// Start the client
const client = new MultiTenantMCPClient();
client.connect().catch(console.error);
```

## Deployment Considerations

### 1. Database Schema

```sql
-- Tenants table
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY,
    encrypted_config JSONB NOT NULL,
    data_center VARCHAR(10) NOT NULL,
    allowed_scopes TEXT[] NOT NULL,
    metadata JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tenant tokens table (partitioned by tenant)
CREATE TABLE tenant_tokens (
    tenant_id UUID NOT NULL,
    token_id UUID NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (tenant_id, token_id)
) PARTITION BY LIST (tenant_id);

-- Tenant audit logs (partitioned by date and tenant)
CREATE TABLE tenant_audit_logs (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource VARCHAR(255),
    result VARCHAR(20) NOT NULL,
    metadata JSONB,
    ip_address INET,
    duration INTEGER,
    PRIMARY KEY (tenant_id, timestamp, id)
) PARTITION BY RANGE (timestamp);

-- Create indexes
CREATE INDEX idx_tenants_active ON tenants (tenant_id) WHERE is_active = true;
CREATE INDEX idx_tenant_tokens_expires ON tenant_tokens (tenant_id, expires_at);
CREATE INDEX idx_tenant_audit_logs_event ON tenant_audit_logs (tenant_id, event_type, timestamp);
```

### 2. Monitoring Per Tenant

```typescript
class TenantMonitoring {
  private metrics = {
    apiCalls: new Counter({
      name: 'mcp_tenant_api_calls_total',
      help: 'Total API calls per tenant',
      labelNames: ['tenant_id', 'tool', 'status'],
    }),
    
    tokenRefreshes: new Counter({
      name: 'mcp_tenant_token_refreshes_total',
      help: 'Token refreshes per tenant',
      labelNames: ['tenant_id', 'status'],
    }),
    
    activeConnections: new Gauge({
      name: 'mcp_tenant_active_connections',
      help: 'Active connections per tenant',
      labelNames: ['tenant_id'],
    }),
    
    quotaUsage: new Gauge({
      name: 'mcp_tenant_quota_usage',
      help: 'Resource quota usage per tenant',
      labelNames: ['tenant_id', 'resource'],
    }),
  };
  
  recordApiCall(tenantId: string, tool: string, status: string) {
    this.metrics.apiCalls.inc({ tenant_id: tenantId, tool, status });
  }
  
  updateQuotaUsage(tenantId: string, resource: string, usage: number) {
    this.metrics.quotaUsage.set({ tenant_id: tenantId, resource }, usage);
  }
}
```

### 3. Tenant Onboarding Process

```typescript
class TenantOnboarding {
  async onboardNewTenant(request: TenantOnboardingRequest): Promise<TenantOnboardingResult> {
    // 1. Validate request
    const validated = await this.validateOnboardingRequest(request);
    
    // 2. Create tenant record
    const tenantId = generateUUID();
    
    // 3. Guide through OAuth setup
    const oauthInstructions = this.generateOAuthInstructions(validated);
    
    // 4. Wait for OAuth credentials
    const credentials = await this.waitForCredentials(tenantId);
    
    // 5. Validate OAuth setup
    await this.validateOAuthSetup(credentials);
    
    // 6. Configure tenant
    await this.configureTenant({
      tenantId,
      ...validated,
      ...credentials,
    });
    
    // 7. Generate client configuration
    const clientConfig = await this.generateClientConfig(tenantId);
    
    // 8. Send welcome email
    await this.sendWelcomeEmail(validated.contactEmail, clientConfig);
    
    return {
      tenantId,
      clientConfig,
      status: 'active',
    };
  }
  
  private generateOAuthInstructions(tenant: ValidatedTenant): OAuthInstructions {
    const dcInfo = DATA_CENTERS[tenant.dataCenter];
    
    return {
      steps: [
        {
          title: 'Navigate to Zoho API Console',
          description: `Go to ${dcInfo.apiConsoleUrl}`,
        },
        {
          title: 'Create Self Client',
          description: 'Select "Self Client" and click "CREATE NOW"',
        },
        {
          title: 'Generate Authorization Code',
          description: `Use these scopes: ${tenant.requestedScopes.join(', ')}`,
        },
        {
          title: 'Exchange for Refresh Token',
          description: 'Use the provided curl command with your credentials',
        },
      ],
      curlCommand: this.generateCurlCommand(dcInfo),
    };
  }
}
```

## Best Practices

### 1. Tenant Quota Management

```typescript
interface TenantQuota {
  maxRequestsPerMinute: number;
  maxConnectionsPerTenant: number;
  maxStorageGB: number;
  maxMonthlyApiCalls: number;
}

class TenantQuotaManager {
  async checkQuota(tenantId: string, resource: string): Promise<boolean> {
    const quota = await this.getTenantQuota(tenantId);
    const usage = await this.getCurrentUsage(tenantId, resource);
    
    if (usage >= quota[resource]) {
      await this.notifyQuotaExceeded(tenantId, resource);
      return false;
    }
    
    return true;
  }
}
```

### 2. Tenant Health Monitoring

```typescript
class TenantHealthMonitor {
  async checkTenantHealth(tenantId: string): Promise<TenantHealth> {
    const checks = await Promise.allSettled([
      this.checkTokenValidity(tenantId),
      this.checkApiConnectivity(tenantId),
      this.checkQuotaUsage(tenantId),
      this.checkErrorRate(tenantId),
    ]);
    
    return {
      tenantId,
      healthy: checks.every(c => c.status === 'fulfilled' && c.value),
      checks: this.formatHealthChecks(checks),
      timestamp: new Date(),
    };
  }
}
```

## Security Considerations

### 1. Certificate Validation

```typescript
class CertificateValidator {
  async validateClientCertificate(
    certificate: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      // Parse certificate
      const cert = new X509Certificate(certificate);
      
      // Check expiry
      if (cert.validTo < new Date()) {
        throw new Error('Certificate expired');
      }
      
      // Verify certificate chain
      const verified = await this.verifyCertificateChain(cert);
      if (!verified) {
        throw new Error('Certificate chain validation failed');
      }
      
      // Check certificate matches tenant
      const cn = cert.subject.split('CN=')[1]?.split(',')[0];
      if (cn !== tenantId) {
        throw new Error('Certificate CN does not match tenant ID');
      }
      
      return true;
    } catch (error) {
      this.logger.error('Certificate validation failed', {
        tenantId,
        error: error.message,
      });
      return false;
    }
  }
}
```

### 2. Tenant Data Isolation

```typescript
class TenantDataIsolation {
  async queryTenantData(tenantId: string, query: string, params: any[]): Promise<any> {
    // Always include tenant ID in queries
    const isolatedQuery = `
      WITH tenant_context AS (
        SELECT $1::uuid as tenant_id
      )
      ${query}
      WHERE tenant_id = (SELECT tenant_id FROM tenant_context)
    `;
    
    return this.db.query(isolatedQuery, [tenantId, ...params]);
  }
}
```

## Migration Guide

### For Existing Single-Tenant Deployments

1. **Prepare Infrastructure**
   ```bash
   # Update database schema
   psql -f migrations/add_multi_tenant_support.sql
   
   # Deploy new multi-tenant server
   docker-compose -f docker-compose.multi-tenant.yml up -d
   ```

2. **Migrate Existing Client**
   ```typescript
   // Convert existing OAuth to self-client
   const migration = new TenantMigration();
   await migration.convertToSelfClient({
     currentRefreshToken: process.env.REFRESH_TOKEN,
     tenantName: 'legacy-tenant',
   });
   ```

3. **Update Client Configuration**
   ```json
   {
     "mcpServers": {
       "service-desk-plus": {
         "env": {
           "MCP_TENANT_ID": "legacy-tenant-id",
           // ... other config
         }
       }
     }
   }
   ```

## References

- [Service Desk Plus OAuth Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/oauth-2.0.html)
- [Zoho Self Client Guide](https://www.zoho.com/accounts/protocol/oauth/self-client.html)
- [MCP Specification - Multi-Tenant Extensions](https://modelcontextprotocol.io/extensions/multi-tenant)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)