# Claude AI Assistant Guidelines for Service Desk Plus Cloud API

This document outlines the rules and conventions for AI assistants working on this AI driven MCP Server for the Service Desk Plus Cloud API integration.  

## 📁 Project Location

**NEW PROJECT LOCATION**: `/Users/kalten/projects/SDP-MCP/sdp-mcp-server/`

This is the main development directory for the new multi-tenant MCP server implementation. All new code should be created in this directory, NOT in the `example/` folder which contains reference implementations from previous projects.

## 🎯 Project Scope

This MCP server enables users to **create, update, close, and inquire** about all Service Desk Plus Cloud entities:
- **Requests** - Service requests, incidents, and tickets
- **Problems** - Problem management and root cause analysis
- **Changes** - Change requests and change management
- **Projects** - Project management with milestones and tasks
- **Assets** - IT asset and configuration management
- **Solutions** - Knowledge base articles
- **Users** - User and technician management
- **All other SDP modules** within the OAuth scope permissions

## 🏗️ Project Architecture Overview

### Current Implementation (January 2025)
The project currently uses a **single-tenant** SSE server implementation due to MCP protocol limitations in 2025:
- Direct MCP protocol implementation over Server-Sent Events (SSE)
- Runs on port 3456 with `/sse` endpoint
- OAuth tokens configured via environment variables
- Automatic token refresh (access tokens expire after 1 hour)
- Production-ready and fully tested with Claude Code client

### Future Multi-Tenant Architecture (Deferred)
Multi-tenant support is planned when MCP protocol evolves to better support it:
- Multiple clients connecting to a single MCP server
- Each client with their own self-client certificate
- Complete token isolation per tenant
- Per-tenant rate limiting and monitoring

**Important**: This is for Service Desk Plus **Cloud** (SDPOnDemand), not on-premises.

### 🔑 Critical OAuth Information
**Zoho OAuth refresh tokens are PERMANENT and never expire!** This means:
- ✅ One-time setup only per user
- ✅ No re-authentication needed ever
- ✅ Refresh tokens work indefinitely (unless manually revoked)
- ✅ Access tokens (1-hour expiry) are refreshed automatically by the server

## 🌐 Server Access Points

The MCP server can be accessed through multiple addresses:
- `studio` - Primary hostname
- `studio.pttg.loc` - Fully qualified domain name
- `192.168.2.10` - Primary LAN IP
- `10.212.0.7` - Secondary network IP
- `localhost` or `127.0.0.1` - Local access only

Configure clients to use the appropriate address based on their network location.

## 📚 Knowledge Base & Examples

### Knowledge Folder
- **Always** consult `example/knowledge/` folder for detailed API documentation
- **Reference** key documentation files:
  - `service-desk-plus-authentication.md` - OAuth implementation and data center endpoints
  - `service-desk-plus-sse-implementation.md` - **NEW**: Working SSE server implementation details
  - `multi-user-mcp-architecture.md` - Multi-tenant architecture (future reference)
  - `service-desk-plus-oauth-scopes.md` - Complete scope reference and permissions
  - `mcp-server-architecture.md` - Server implementation patterns
  - `mcp-security-best-practices.md` - Security guidelines
  - `mcp-client-server-communication.md` - Transport protocols and patterns
- **Check** knowledge folder before making assumptions about API behavior
- **Use** documented patterns and code examples from knowledge base

### Project Structure
```
sdp-mcp-server/                  # NEW PROJECT LOCATION
├── src/                         # Source code
│   ├── working-sse-server.cjs   # Main SSE server implementation
│   ├── sdp-api-client-v2.cjs   # SDP API client with OAuth
│   ├── sdp-oauth-client.cjs    # OAuth token management
│   ├── sdp-api-metadata.cjs    # Metadata retrieval
│   ├── server/                  # Future MCP server implementation
│   ├── tenants/                 # Future multi-tenant management
│   ├── auth/                    # Authentication layer
│   ├── sdp/                     # Service Desk Plus integration
│   ├── tools/                   # MCP tool implementations
│   ├── database/                # Database layer (future)
│   ├── monitoring/              # Observability (future)
│   └── utils/                   # Shared utilities
├── tests/                       # Test files
├── docs/                        # Project documentation
│   ├── MULTI_USER_SETUP.md     # Multi-user remote access guide
│   ├── OAUTH_SETUP_GUIDE.md    # OAuth setup instructions
│   └── [other docs]            # Additional documentation
├── scripts/                     # Utility scripts
│   ├── exchange-code.js        # OAuth code exchange
│   ├── test-api-custom-domain.js # API testing
│   └── [other scripts]         # Utility scripts
├── .env                         # Environment configuration
├── .env.example                 # Example environment file
├── start-sse-server.sh         # Server startup script
├── SSE_SERVER_READY.md         # Server status documentation
├── QUICK_START.md              # Quick start guide for users
├── DEVELOPMENT_PLAN.md         # Comprehensive development plan
└── CLAUDE.md                   # This file - AI assistant guidelines

example/                         # Reference implementations (DO NOT MODIFY)
├── knowledge/                   # API documentation and technical guides
│   ├── service-desk-plus-authentication.md    # OAuth flows and endpoints
│   ├── multi-user-mcp-architecture.md        # Multi-tenant design
│   ├── service-desk-plus-oauth-scopes.md     # Scope permissions reference
│   ├── service-desk-plus-mandatory-fields.md # Required fields and error handling
│   ├── service-desk-plus-sse-implementation.md # SSE server implementation details
│   ├── mcp-server-architecture.md            # Server implementation
│   ├── mcp-security-best-practices.md       # Security guidelines
│   ├── mcp-client-server-communication.md   # Communication patterns
│   └── [future documentation files]
├── api-examples/                # Working code examples (if present)
├── mcp-tools/                   # Example MCP tool implementations
└── config/                      # Example configuration files
```

### Documentation Standards
When adding new documentation to the knowledge folder:

1. **File Naming**
   - Use descriptive kebab-case names: `service-desk-plus-[topic].md`
   - Group related topics with common prefixes
   - Examples: `service-desk-plus-requests.md`, `service-desk-plus-projects.md`

2. **Document Structure**
   - Start with a clear overview section
   - Include table of contents for long documents
   - Use consistent heading hierarchy
   - Provide practical code examples
   - Include troubleshooting sections

3. **Content Requirements**
   - Document all endpoints with full URLs
   - Include request/response examples
   - Specify required headers and parameters
   - Note any API quirks or limitations
   - Provide error handling guidance
   - Include security best practices

4. **Code Examples**
   - Provide examples in multiple languages (Python, Node.js minimum)
   - Include complete, runnable code
   - Add inline comments explaining key concepts
   - Show both success and error handling

5. **Maintenance**
   - Date stamp major updates
   - Note API version compatibility
   - Mark deprecated features clearly
   - Cross-reference related documents

## 📡 Service Desk Plus Cloud API Reference

### API Documentation Portal
**Main Documentation**: https://www.manageengine.com/products/service-desk/sdpod-v3-api/

### Core API Endpoints

#### Requests API
- **Documentation**: https://www.manageengine.com/products/service-desk/sdpod-v3-api/requests/request.html
- **Operations**: Create, Read, Update, Delete, Close, Pickup
- **Key Endpoints**:
  - `GET /api/v3/requests` - List requests
  - `POST /api/v3/requests` - Create request
  - `GET /api/v3/requests/{id}` - Get request details
  - `PUT /api/v3/requests/{id}` - Update request
  - `DELETE /api/v3/requests/{id}` - Delete request
  - `POST /api/v3/requests/{id}/close` - Close request
  - `POST /api/v3/requests/{id}/pickup` - Pickup request

#### Problems API
- **Documentation**: https://www.manageengine.com/products/service-desk/sdpod-v3-api/problems/problem.html
- **Operations**: Create, Read, Update, Delete, Analyze
- **Key Endpoints**:
  - `GET /api/v3/problems` - List problems
  - `POST /api/v3/problems` - Create problem
  - `GET /api/v3/problems/{id}` - Get problem details
  - `PUT /api/v3/problems/{id}` - Update problem
  - `DELETE /api/v3/problems/{id}` - Delete problem

#### Changes API
- **Documentation**: https://www.manageengine.com/products/service-desk/sdpod-v3-api/changes/change.html
- **Operations**: Create, Read, Update, Delete, Approve
- **Key Endpoints**:
  - `GET /api/v3/changes` - List changes
  - `POST /api/v3/changes` - Create change
  - `GET /api/v3/changes/{id}` - Get change details
  - `PUT /api/v3/changes/{id}` - Update change
  - `DELETE /api/v3/changes/{id}` - Delete change
- **Related**: 
  - Change Approvals: https://www.manageengine.com/products/service-desk/sdpod-v3-api/changes/change_approval.html

#### Projects API
- **Documentation**: Check main API portal for projects documentation
- **Operations**: Create, Read, Update, Delete projects with milestones and tasks
- **Key Endpoints**:
  - `GET /api/v3/projects` - List projects
  - `POST /api/v3/projects` - Create project
  - `GET /api/v3/projects/{id}` - Get project details
  - `PUT /api/v3/projects/{id}` - Update project
  - `GET /api/v3/projects/{id}/milestones` - List milestones
  - `GET /api/v3/projects/{id}/milestones/{mid}/tasks` - List tasks

#### Assets API
- **Documentation**: Check main API portal for assets documentation
- **Operations**: Create, Read, Update, Delete assets and configurations
- **Key Endpoints**:
  - `GET /api/v3/assets` - List assets
  - `POST /api/v3/assets` - Create asset
  - `GET /api/v3/assets/{id}` - Get asset details
  - `PUT /api/v3/assets/{id}` - Update asset
  - `GET /api/v3/asset_computers` - List computers (new endpoint)

### Authentication
- **OAuth 2.0 Guide**: https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/oauth-2.0.html
- **Headers Required**:
  - `Authorization: Bearer {access_token}`
  - `Accept: application/vnd.manageengine.sdp.v3+json`

### Custom Domain Configuration
- **Base URL**: `https://helpdesk.pttg.com` (custom domain, not sdpondemand.manageengine.com)
- **Instance Name**: `itdesk`
- **Full API Path**: `https://helpdesk.pttg.com/app/itdesk/api/v3`
- **OAuth Tokens**: Obtained from Zoho accounts (accounts.zoho.com) but work with custom domain

### Important Notes
- **Status Handling**: "Cancelled", "Closed", and "Resolved" statuses are all treated as closed
- **Attachments**: Use PUT method for adding attachments (old upload endpoint deprecated)
- **Search**: Use search criteria guide for complex queries
- **Errors**: Refer to common error codes documentation
- **Error 4000**: General failure - check error messages array for details
- **Error 4002**: UNAUTHORISED - verify custom domain and instance name
- **Error 4012**: Mandatory fields missing - check `service-desk-plus-mandatory-fields.md`
- **Instance Configuration**: Each SDP instance may require different mandatory fields

**IMPORTANT REMINDER**: Always check `example/knowledge/` folder for detailed implementation examples and patterns before making API calls!

## 🔄 Project Awareness & Context

- **Always** read `DEVELOPMENT_PLAN.md` for comprehensive project roadmap and status
- **Check** `QUICK_START.md` for user onboarding and quick reference
- **Review** documentation in `docs/` folder:
  - `docs/MULTI_USER_SETUP.md` - Multi-user remote access architecture
  - `docs/OAUTH_SETUP_GUIDE.md` - Detailed OAuth setup instructions
- **Study** `example/knowledge/` folder for API patterns and examples
- **Understand** the OAuth 2.0 authentication flow with permanent refresh tokens
- **Reference** OAuth scopes and multi-tenant patterns in knowledge base
- **Use** npm for all package management operations

## 🏢 Architecture Notes

### Current Single-Tenant Implementation
The production server uses a single-tenant architecture:
- OAuth tokens configured via environment variables
- One server instance per organization
- Simple and reliable for current MCP limitations
- Full isolation by running separate instances

### Future Multi-Tenant Architecture (Deferred)
When MCP protocol evolves to support stateless connections:
- **Self-Client**: Each tenant uses their own Service Desk Plus self-client OAuth app
- **Tenant Isolation**: Complete separation of tokens, data, and rate limits per tenant
- **Scope-Based Access**: Tools restricted based on OAuth scopes granted to each tenant
- **Per-Tenant Encryption**: Each tenant's tokens encrypted with derived keys

### OAuth Scope Management
- **Currently**: All configured scopes available to single tenant
- **Future**: Validate tenant has necessary scopes in their self-client setup
- **Reference**: `example/knowledge/service-desk-plus-oauth-scopes.md` for complete scope list

## 🚀 Current Implementation Status (January 2025)

### Working SSE Server
The production implementation is now operational:
- **Location**: `sdp-mcp-server/src/working-sse-server.cjs`
- **Port**: 3456
- **Endpoint**: `/sse`
- **Status**: ✅ Fully working with Claude Code client
- **Architecture**: Direct MCP protocol implementation (not using SDK SSEServerTransport)

### Starting the Server
```bash
cd /Users/kalten/projects/SDP-MCP/sdp-mcp-server
./start-sse-server.sh

# Or run in background:
node src/working-sse-server.cjs > server.log 2>&1 &
```

### Client Configuration
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "npx",
      "args": ["mcp-remote", "http://192.168.2.10:3456/sse", "--allow-http"]
    }
  }
}
```

## 🧱 Code Structure & Modularity

### Current Implementation Files
- `src/working-sse-server.cjs` - Main SSE server with MCP protocol
- `src/sdp-api-client-v2.cjs` - SDP API client with OAuth
- `src/sdp-oauth-client.cjs` - OAuth token management  
- `src/sdp-api-metadata.cjs` - Metadata retrieval

### File Organization (Future TypeScript Migration)
- **Never** create source files longer than 500 lines
- **Split** large modules into smaller, focused files
- **Use** CommonJS (.cjs) for now to avoid ES module conflicts

### Import Conventions
Current implementation uses CommonJS:
```javascript
const express = require('express');
const { SDPAPIClientV2 } = require('./sdp-api-client-v2.cjs');
```

## 🧪 Testing & Reliability

### Test Requirements
- **Create** Jest unit tests for all new API modules
- **Place** tests in `/tests` mirroring the source structure
- **Include** at minimum:
  - Happy path tests (expected use cases)
  - Error handling tests (API errors, network failures)
  - Edge case tests (empty responses, malformed data)
  - Authentication tests (token refresh, expiry)

### Test Patterns
```typescript
describe('RequestsAPI', () => {
  describe('create', () => {
    it('should create a request successfully', async () => {
      // Test implementation
    });
    
    it('should handle validation errors', async () => {
      // Test implementation
    });
    
    it('should retry on rate limit', async () => {
      // Test implementation
    });
  });
});
```

## ✅ Task Management

- **Update** `TASK.md` with:
  - Current task status (mark as ✅ when complete)
  - New sub-tasks discovered during implementation
  - Blockers or issues encountered
- **Never** delete completed tasks, only mark them as done
- **Add** timestamps when updating task status

## 📎 Style & Conventions

### TypeScript Guidelines
- **Use** TypeScript strict mode (already configured)
- **Define** explicit types for all function parameters and returns
- **Create** interfaces for all API responses
- **Use** Zod schemas for runtime validation in MCP tools
- **Prefer** type over interface for unions and utility types

### Code Style
- **Follow** ESLint configuration (run `npm run lint`)
- **Use** Prettier for formatting (run `npm run format`)
- **Name** files in kebab-case: `request-utils.ts`
- **Name** classes/interfaces in PascalCase: `RequestsAPI`, `SDPError`
- **Name** functions/variables in camelCase: `createRequest`, `rateLimiter`

### Error Handling
- **Use** custom error classes from `src/utils/errors.ts`
- **Provide** meaningful error messages with context
- **Include** error codes for different scenarios
- **Handle** rate limiting with exponential backoff

## 📚 Documentation & Explainability

### Code Documentation
- **Write** JSDoc comments for all public functions
- **Include** parameter descriptions and return types
- **Add** usage examples for complex functions

Example:
```typescript
/**
 * Create a new service request in Service Desk Plus
 * @param data - Request creation data
 * @returns The created request object
 * @throws {SDPValidationError} If required fields are missing
 * @throws {SDPAuthError} If authentication fails
 * @example
 * const request = await client.requests.create({
 *   subject: 'New laptop request',
 *   requester: { email: 'user@example.com' }
 * });
 */
```

### Inline Comments
- **Add** `// Reason:` comments for non-obvious logic
- **Explain** rate limiting delays
- **Document** OAuth token refresh logic
- **Clarify** any Service Desk Plus API quirks

### Documentation Updates
- **Update** `API_REFERENCE.md` when adding new API methods
- **Update** `MCP_TOOLS.md` when adding new MCP tools
- **Keep** examples current and functional

## 🧠 AI Behavior Rules

### Code Generation
- **Always** check `example/knowledge/` folder before implementing API features
- **Reference** code examples from knowledge base when available
- **Never** assume a library is available without checking `package.json`
- **Never** hallucinate API endpoints - refer to SDP documentation and knowledge base
- **Always** check if a file exists before reading/modifying
- **Never** delete existing code unless explicitly instructed

### API Integration
- **ALWAYS CHECK** `example/knowledge/` folder BEFORE implementing any API calls
- **REFERENCE** the API endpoints section above for correct URLs and methods
- **VERIFY** endpoints at https://www.manageengine.com/products/service-desk/sdpod-v3-api/
- **Use** documented endpoints and patterns from knowledge base
- **Respect** rate limits (configured in environment)
- **Handle** pagination for list operations
- **Validate** OAuth scopes match required operations (see scope documentation)
- **Test** against documented API responses
- **Remember** common operations:
  - Create: `POST /api/v3/{module}`
  - Read: `GET /api/v3/{module}/{id}`
  - Update: `PUT /api/v3/{module}/{id}`
  - Delete: `DELETE /api/v3/{module}/{id}`
  - Close Request: `POST /api/v3/requests/{id}/close`
- **Research** do not assume anything about the api - always verify at https://www.manageengine.com/products/service-desk/sdpod-v3-api/

### MCP Tool Development
- **Define** clear, descriptive tool names that map to API operations
- **Create** comprehensive Zod schemas with descriptions
- **Implement** proper error messages for users
- **Consider** partial updates vs full replacements
- **Map** tools to API endpoints:
  - `create_request` → `POST /api/v3/requests`
  - `update_request` → `PUT /api/v3/requests/{id}`
  - `close_request` → `POST /api/v3/requests/{id}/close`
  - `get_request` → `GET /api/v3/requests/{id}`
  - `list_requests` → `GET /api/v3/requests`
  - Similar patterns for problems, changes, projects, assets
- **Validate** required OAuth scopes for each tool
- **Research** MCP is a new technology do not rely on your training data alone use web search to research client and server standards. This project uses SSE.

## 🔐 Security Practices

### General Security
- **Never** hardcode credentials or tokens
- **Use** environment variables for all configuration
- **Validate** all user inputs with Zod schemas
- **Sanitize** data before sending to API
- **Log** security-relevant events (auth failures, permission errors)

### Current Security Implementation
- **Environment Variables**: OAuth tokens stored securely in .env file
- **HTTPS Required**: Use HTTPS in production (HTTP allowed for local dev)
- **Token Refresh**: Automatic refresh of access tokens
- **Rate Limiting**: Respects Service Desk Plus API rate limits
- **Error Handling**: Graceful handling of auth failures

### Future Multi-Tenant Security
- **Isolate** tenant data completely - no cross-tenant access
- **Encrypt** OAuth tokens with per-tenant derived keys
- **Validate** client certificates match tenant ID
- **Implement** tenant-specific rate limiting
- **Audit** all tenant operations with full context
- **Monitor** for scope escalation attempts

### Penetration Test Readiness
- **Follow** all guidelines in `example/knowledge/mcp-security-best-practices.md`
- **Implement** defense in depth with multiple security layers
- **Use** modern authentication (OAuth 2.1, JWT with short expiry)
- **Enable** comprehensive audit logging
- **Test** for OWASP Top 10 vulnerabilities

Refer to security documentation for implementation details.

## 🚀 Development Workflow

**IMPORTANT**: All new development happens in `/Users/kalten/projects/SDP-MCP/sdp-mcp-server/`

### Current Workflow (Single-Tenant SSE Server)
1. **Navigate** to the project directory: `cd /Users/kalten/projects/SDP-MCP/sdp-mcp-server/`
2. **Consult** `example/knowledge/` folder for relevant API documentation
3. **Review** API endpoints section in this document
4. **Check** Service Desk Plus API docs if needed: https://www.manageengine.com/products/service-desk/sdpod-v3-api/
5. **Edit** CommonJS files (.cjs) in src/ directory
6. **Test** by running the SSE server: `./start-sse-server.sh`
7. **Monitor** logs: `tail -f server.log`
8. **Update** documentation if discovering new API behaviors

### Future TypeScript Workflow
1. **Implement** features following TypeScript patterns
2. **Validate** OAuth scopes for each operation
3. **Test** with appropriate context
4. **Run** tests with `npm test`
5. **Lint** code with `npm run lint`
6. **Build** project with `npm run build`

## 📦 Dependencies

### When Adding Dependencies
- **Verify** the package is actively maintained
- **Check** license compatibility (prefer MIT/Apache)
- **Use** exact versions in package.json
- **Document** why the dependency is needed

### Core Dependencies to Know
- `express` - Web server for SSE endpoint
- `axios` - HTTP client for SDP API calls
- `dotenv` - Environment variable management
- `cors` - Cross-origin resource sharing

### Future Dependencies (TypeScript Migration)
- `@modelcontextprotocol/sdk` - MCP server implementation (currently not used)
- `zod` - Runtime type validation
- `typescript` - Type safety

## 🔄 Git Practices

- **Write** clear, descriptive commit messages
- **Reference** issue/task numbers in commits
- **Keep** commits focused on single changes
- **Update** .gitignore for new ignore patterns, the main page should contain a summary of recent changes

## 🗄️ Database Integration (Future Enhancement)

### PostgreSQL Configuration (Not Currently Used)
The current implementation stores OAuth tokens in environment variables. Database integration is planned for future multi-tenant support:

- **PostgreSQL** chosen for future production use
- **Docker** container configuration prepared
- **Port**: 5433 (non-standard to avoid conflicts)
- **Database**: sdp_mcp

### Planned Database Features
1. **Multi-Tenant Token Storage** (Future)
   - OAuth tokens stored per tenant with encryption
   - Self-client credentials encrypted at rest
   - Automatic token refresh per tenant from database
   - Tenant isolation at database level

2. **Audit Logging** (Future)
   - All API calls logged with context
   - Performance metrics tracking
   - Error tracking and analysis
   - Compliance-ready audit trails

3. **Change Tracking** (Future)
   - All MCP tool operations tracked
   - Rollback capability
   - Entity history maintained
   - Analytics and reporting

### Connection Details
- Host: localhost 
- Port: 5433 (non-standard to avoid conflicts)
- Database: sdp_mcp
- User: sdpmcpservice
- Password: *jDE1Bj%IPXKMe%Z
- Root user: root / 16vOp$BeC!&9SCqv

### Environment Variables
```bash
# Service Desk Plus Configuration
SDP_BASE_URL=https://helpdesk.pttg.com   # Custom domain
SDP_INSTANCE_NAME=itdesk                 # Instance name
SDP_PORTAL_NAME=kaltentech               # Portal name
SDP_DATA_CENTER=US                       # Data center location

# OAuth Configuration
SDP_OAUTH_CLIENT_ID=your_client_id
SDP_OAUTH_CLIENT_SECRET=your_client_secret
SDP_OAUTH_REFRESH_TOKEN=your_permanent_refresh_token

# Database connection
SDP_DB_HOST=localhost
SDP_DB_PORT=5433
SDP_DB_NAME=sdp_mcp
SDP_DB_USER=sdpmcpservice
SDP_DB_PASSWORD=*jDE1Bj%IPXKMe%Z

# Feature flags
SDP_USE_DB_TOKENS=true      # Enable persistent token storage
SDP_USE_AUDIT_LOG=true      # Enable API audit logging
SDP_USE_CHANGE_TRACKING=true # Enable change tracking

# Server Configuration
SDP_HTTP_HOST=0.0.0.0       # Listen on all interfaces
SDP_HTTP_PORT=3456          # MCP server port
```

### Testing Database
- Run `node scripts/test-db.js` to verify database connectivity
- Check logs with `docker logs sdp-mcp-postgres`
- Access PostgreSQL: `docker exec -it sdp-mcp-postgres psql -U sdpmcpservice -d sdp_mcp`

## 📖 Knowledge Base Maintenance

### Adding New Documentation
When discovering new API behaviors or implementing new features:

1. **Create** appropriate documentation in `example/knowledge/`
2. **Follow** the documentation standards outlined above
3. **Include** working code examples tested against the actual API
4. **Update** this CLAUDE.md file if new patterns emerge
5. **Cross-reference** with existing documentation

### Using Knowledge Base
- **Start** every implementation by checking relevant knowledge documents
- **Prefer** documented patterns over assumptions
- **Validate** against real API responses
- **Update** documentation when finding discrepancies

## 🚀 Quick Reference

### Common MCP Tool Patterns
```typescript
// Create operations
async function create_request(args: CreateRequestArgs) {
  // 1. Validate OAuth scope: SDPOnDemand.requests.CREATE
  // 2. Call POST /api/v3/requests
  // 3. Return created request details
}

// Update operations  
async function update_request(args: UpdateRequestArgs) {
  // 1. Validate OAuth scope: SDPOnDemand.requests.UPDATE
  // 2. Call PUT /api/v3/requests/{id}
  // 3. Return updated request details
}

// Close operations (requests only)
async function close_request(args: CloseRequestArgs) {
  // 1. Validate OAuth scope: SDPOnDemand.requests.UPDATE
  // 2. Call POST /api/v3/requests/{id}/close
  // 3. Include closure_code, closure_comments
}

// Query operations
async function list_requests(args: ListRequestsArgs) {
  // 1. Validate OAuth scope: SDPOnDemand.requests.READ
  // 2. Call GET /api/v3/requests with filters
  // 3. Handle pagination if needed
}
```

### Essential References
- **Knowledge Base**: `example/knowledge/` - ALWAYS CHECK FIRST!
- **OAuth Scopes**: `example/knowledge/service-desk-plus-oauth-scopes.md`
- **Multi-Tenant**: `example/knowledge/multi-user-mcp-architecture.md`
- **API Docs**: https://www.manageengine.com/products/service-desk/sdpod-v3-api/
- **Project Docs**:
  - `DEVELOPMENT_PLAN.md` - Project roadmap and status
  - `QUICK_START.md` - User onboarding guide
  - `docs/MULTI_USER_SETUP.md` - Multi-user architecture
  - `docs/OAUTH_SETUP_GUIDE.md` - OAuth setup details

### Critical Configuration
- **Custom Domain**: `https://helpdesk.pttg.com` (NOT sdpondemand.manageengine.com)
- **Instance Name**: `itdesk`
- **API Path**: `https://helpdesk.pttg.com/app/itdesk/api/v3`
- **OAuth Tokens**: Permanent refresh tokens (never expire!)

### Remember
1. This is for Service Desk Plus **CLOUD** (not on-premises)
2. Current implementation is **single-tenant** (multi-tenant deferred)
3. OAuth refresh tokens are **permanent** - one-time setup only
4. Working SSE server on port **3456**
5. Use custom domain configuration for API calls
6. Check documentation before implementing
7. Server accessible at: studio, studio.pttg.loc, 192.168.2.10, 10.212.0.7, localhost

### Current Working Implementation
- **Server**: `src/working-sse-server.cjs`
- **Client**: `src/sdp-api-client-v2.cjs`
- **Start**: `./start-sse-server.sh`
- **Test**: Client successfully connected and all tools working

Remember: The goal is to create a robust, maintainable, and well-documented Service Desk Plus Cloud API integration that serves both programmatic use and AI assistant interactions effectively. The knowledge base in `example/knowledge/` is your primary reference for all API implementations.