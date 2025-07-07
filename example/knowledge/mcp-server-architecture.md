# MCP Server Architecture for Service Desk Plus Cloud Integration

*Last Updated: July 2025*

## Overview

This document outlines the architecture for a secure Model Context Protocol (MCP) server that integrates with Service Desk Plus Cloud API. The server acts as a bridge between MCP clients (like Claude Desktop) and the Service Desk Plus Cloud API, providing secure authentication and tool access.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────────┐
│   MCP Client    │  MCP    │   MCP Server    │  HTTPS  │  SDP Cloud API  │
│ (Claude Desktop)│◄──────► │  (This Project) │◄──────► │   (Zoho Cloud)   │
└─────────────────┘         └─────────────────┘         └──────────────────┘
        │                            │                            │
        │ .mcp.json                  │ OAuth 2.0                 │
        │ (client config)            │ Token Management          │
        └────────────────────────────┴────────────────────────────┘
```

## Key Components

### 1. MCP Server Core
- Implements MCP specification (June 2025 version)
- Uses JSON-RPC 2.0 for communication
- Provides tools, resources, and prompts for SDP operations

### 2. Authentication Layer
- OAuth 2.0 authentication with Service Desk Plus Cloud
- Secure token storage and management
- Per-client credential isolation

### 3. Transport Layer
- Primary: SSE (Server-Sent Events) for HTTP-based communication
- Alternative: WebSocket support for real-time bidirectional communication
- HTTPS enforcement for all external communications

### 4. Security Layer
- Client authentication using credentials from .mcp.json
- Token encryption at rest
- Rate limiting and abuse prevention
- Audit logging for all operations

## Client Configuration (.mcp.json)

Clients connect to the MCP server using configuration specified in their .mcp.json file:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "node",
      "args": ["path/to/mcp-client.js"],
      "env": {
        "MCP_SERVER_URL": "https://your-mcp-server.com",
        "MCP_CLIENT_ID": "unique-client-id",
        "MCP_CLIENT_SECRET": "secure-client-secret"
      }
    }
  }
}
```

## Server Implementation Stack

### Recommended Technology Stack (2025 Best Practices)

#### Language: TypeScript/Node.js
- **Rationale**: 
  - Official MCP SDK available (@modelcontextprotocol/sdk)
  - Strong typing for security
  - Active ecosystem for cloud integrations
  - Excellent async/await support for API operations

#### Alternative: Python
- **Rationale**:
  - Strong security libraries
  - FastAPI for modern async web framework
  - Type hints for safety
  - Good for data processing tasks

#### Alternative: Go
- **Rationale**:
  - Excellent performance
  - Built-in security features
  - Strong concurrency model
  - Single binary deployment

### Framework Requirements
- Modern async/await patterns (no callbacks)
- Built-in security middleware
- OAuth 2.0 library support
- WebSocket/SSE capabilities

## Security Architecture

### 1. Authentication Flow

```
1. Client → MCP Server: Initial connection with client credentials
2. MCP Server: Validates client credentials
3. MCP Server: Retrieves stored OAuth tokens for SDP
4. MCP Server → SDP API: Makes authenticated requests
5. SDP API → MCP Server: Returns data
6. MCP Server → Client: Returns formatted MCP response
```

### 2. Token Management

#### Storage
- Encrypted at rest using AES-256-GCM
- Per-client token isolation
- Automatic token refresh before expiration
- Secure key derivation (PBKDF2 or Argon2)

#### Database Schema
```sql
CREATE TABLE client_tokens (
    client_id UUID PRIMARY KEY,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE,
    encryption_salt BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Security Controls

#### Input Validation
- All inputs validated using schema validation (Zod/Joi)
- SQL injection prevention through parameterized queries
- Command injection prevention
- Path traversal protection

#### Rate Limiting
- Per-client rate limits
- Exponential backoff for failed requests
- DDoS protection at ingress

#### Audit Logging
```typescript
interface AuditLog {
  timestamp: Date;
  clientId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
  ipAddress?: string;
}
```

### 4. MCP-Specific Security

#### Tool Safety
- Explicit tool whitelisting
- Parameter validation for each tool
- Execution sandboxing where applicable
- No arbitrary code execution

#### Resource Access Control
- Scope-based permissions
- Client-specific resource filtering
- Data minimization principles

## Implementation Guidelines

### 1. Server Initialization

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

class ServiceDeskPlusMCPServer {
  private server: Server;
  private sdpClient: ServiceDeskPlusClient;
  
  constructor() {
    this.server = new Server(
      {
        name: 'service-desk-plus-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );
  }
  
  async initialize() {
    // Set up authentication
    await this.authenticateClient();
    
    // Register tools
    this.registerTools();
    
    // Start server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### 2. Tool Registration

```typescript
private registerTools() {
  // Create Request Tool
  this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'create_request',
        description: 'Create a new service request in Service Desk Plus',
        inputSchema: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Request subject' },
            description: { type: 'string', description: 'Request description' },
            requester_email: { type: 'string', format: 'email' },
            priority: { 
              type: 'string', 
              enum: ['low', 'medium', 'high', 'urgent'] 
            },
          },
          required: ['subject', 'description', 'requester_email'],
        },
      },
      // Additional tools...
    ],
  }));
}
```

### 3. OAuth Token Handling

```typescript
class TokenManager {
  private encryptionKey: Buffer;
  
  async storeTokens(clientId: string, tokens: OAuthTokens): Promise<void> {
    const encrypted = await this.encryptTokens(tokens);
    
    await db.query(
      `INSERT INTO client_tokens 
       (client_id, encrypted_access_token, encrypted_refresh_token, token_expiry)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id) 
       DO UPDATE SET 
         encrypted_access_token = $2,
         encrypted_refresh_token = $3,
         token_expiry = $4,
         updated_at = NOW()`,
      [clientId, encrypted.accessToken, encrypted.refreshToken, tokens.expiryTime]
    );
  }
  
  async getTokens(clientId: string): Promise<OAuthTokens | null> {
    const result = await db.query(
      'SELECT * FROM client_tokens WHERE client_id = $1',
      [clientId]
    );
    
    if (!result.rows[0]) return null;
    
    return this.decryptTokens(result.rows[0]);
  }
  
  async refreshIfNeeded(clientId: string): Promise<OAuthTokens> {
    const tokens = await this.getTokens(clientId);
    
    if (!tokens || this.isExpiringSoon(tokens)) {
      return await this.refreshTokens(clientId, tokens.refreshToken);
    }
    
    return tokens;
  }
}
```

## Deployment Architecture

### 1. Container-Based Deployment

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

### 2. Environment Configuration

```bash
# Server Configuration
MCP_SERVER_PORT=8080
MCP_SERVER_HOST=0.0.0.0

# Security
MCP_ENCRYPTION_KEY=<32-byte-hex-key>
MCP_JWT_SECRET=<strong-jwt-secret>

# Service Desk Plus
SDP_API_BASE_URL=https://sdpondemand.manageengine.com
SDP_OAUTH_CLIENT_ID=<oauth-client-id>
SDP_OAUTH_CLIENT_SECRET=<oauth-client-secret>

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/mcp_sdp

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Infrastructure Requirements

- **Load Balancer**: SSL termination, health checks
- **Application Servers**: Horizontal scaling capability
- **Database**: PostgreSQL with encryption at rest
- **Cache**: Redis for session management and rate limiting
- **Monitoring**: Prometheus metrics, structured logging

## Security Checklist for Penetration Testing

### Authentication & Authorization
- [ ] Client credentials validated on every request
- [ ] OAuth tokens encrypted at rest
- [ ] Token refresh implemented securely
- [ ] No hardcoded credentials
- [ ] Proper session management

### Input Validation
- [ ] All inputs validated against schemas
- [ ] SQL injection prevention
- [ ] Command injection prevention
- [ ] Path traversal protection
- [ ] XXE prevention in XML parsing

### Transport Security
- [ ] TLS 1.3 minimum
- [ ] Certificate pinning for critical connections
- [ ] HSTS headers
- [ ] Secure WebSocket implementation

### Application Security
- [ ] No sensitive data in logs
- [ ] Error messages don't leak information
- [ ] Rate limiting implemented
- [ ] CORS properly configured
- [ ] Security headers implemented

### Operational Security
- [ ] Audit logging for all operations
- [ ] Monitoring and alerting
- [ ] Incident response plan
- [ ] Regular security updates
- [ ] Dependency scanning

## MCP Tool Examples

### 1. Create Request Tool

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'create_request') {
    const args = request.params.arguments as CreateRequestArgs;
    
    // Validate input
    const validated = createRequestSchema.parse(args);
    
    // Get fresh tokens
    const tokens = await tokenManager.refreshIfNeeded(clientId);
    
    // Make API call
    const response = await sdpClient.createRequest(validated, tokens.accessToken);
    
    // Audit log
    await auditLogger.log({
      clientId,
      action: 'create_request',
      resource: `request:${response.id}`,
      result: 'success',
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Created request #${response.id}: ${response.subject}`,
        },
      ],
    };
  }
});
```

### 2. Search Requests Tool

```typescript
{
  name: 'search_requests',
  description: 'Search for service requests',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      status: { 
        type: 'string', 
        enum: ['open', 'closed', 'on_hold', 'in_progress'] 
      },
      limit: { 
        type: 'number', 
        minimum: 1, 
        maximum: 100, 
        default: 20 
      },
    },
    required: ['query'],
  },
}
```

## Monitoring and Observability

### 1. Metrics to Track

- Request rate per client
- OAuth token refresh rate
- API response times
- Error rates by type
- Tool usage statistics

### 2. Logging Strategy

```typescript
interface LogContext {
  correlationId: string;
  clientId: string;
  toolName?: string;
  duration?: number;
  error?: Error;
}

class StructuredLogger {
  info(message: string, context: LogContext): void {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...context,
    }));
  }
}
```

## Future Considerations

### 1. Multi-Tenant Support
- Isolated environments per organization
- Separate encryption keys per tenant
- Resource quotas and limits

### 2. Advanced Features
- Webhook support for real-time updates
- Batch operations for efficiency
- Caching layer for frequently accessed data
- GraphQL API option

### 3. Compliance
- GDPR data handling
- SOC 2 compliance
- Data residency options
- Right to be forgotten implementation

## References

- [MCP Specification (June 2025)](https://modelcontextprotocol.io/specification/2025-06-18)
- [Service Desk Plus Cloud API v3](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)
- [OWASP Security Guidelines](https://owasp.org/)