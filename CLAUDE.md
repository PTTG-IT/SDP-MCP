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

This is a **multi-tenant** client-to-server MCP project where:
- Multiple clients connect to a single MCP server
- Each client has their own self-client certificate for Service Desk Plus Cloud API
- The server manages OAuth tokens per tenant with complete isolation
- When a remote user calls MCP tools, the server uses that specific tenant's stored token
- Token refresh is handled automatically (not with every action - tokens last 1 hour)

**Important**: This is for Service Desk Plus **Cloud** (SDPOnDemand), not on-premises.

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
  - `multi-user-mcp-architecture.md` - Multi-tenant architecture with self-client certificates
  - `service-desk-plus-oauth-scopes.md` - Complete scope reference and permissions
  - `mcp-server-architecture.md` - Server implementation patterns
  - `mcp-security-best-practices.md` - Security guidelines for penetration testing
  - `mcp-client-server-communication.md` - Transport protocols and patterns
- **Check** knowledge folder before making assumptions about API behavior
- **Use** documented patterns and code examples from knowledge base

### Project Structure
```
sdp-mcp-server/                  # NEW PROJECT LOCATION
├── src/                         # Source code
│   ├── server/                  # MCP server implementation
│   ├── tenants/                 # Multi-tenant management
│   ├── auth/                    # Authentication layer
│   ├── sdp/                     # Service Desk Plus integration
│   ├── tools/                   # MCP tool implementations
│   ├── database/                # Database layer
│   ├── monitoring/              # Observability
│   └── utils/                   # Shared utilities
├── tests/                       # Test files
├── docs/                        # Project documentation
└── scripts/                     # Utility scripts

example/                         # Reference implementations (DO NOT MODIFY)
├── knowledge/                   # API documentation and technical guides
│   ├── service-desk-plus-authentication.md    # OAuth flows and endpoints
│   ├── multi-user-mcp-architecture.md        # Multi-tenant design
│   ├── service-desk-plus-oauth-scopes.md     # Scope permissions reference
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

### Important Notes
- **Status Handling**: "Cancelled", "Closed", and "Resolved" statuses are all treated as closed
- **Attachments**: Use PUT method for adding attachments (old upload endpoint deprecated)
- **Search**: Use search criteria guide for complex queries
- **Errors**: Refer to common error codes documentation

**IMPORTANT REMINDER**: Always check `example/knowledge/` folder for detailed implementation examples and patterns before making API calls!

## 🔄 Project Awareness & Context

- **Always** read `PLANNING.md` at the start of each conversation to understand project architecture
- **Check** `TASK.md` before starting any new work to see ongoing tasks
- **Review** existing patterns in `src/api/modules/` and `src/mcp/` before implementing new features
- **Understand** the OAuth 2.0 authentication flow implemented in `src/api/auth.ts`
- **Study** `example/knowledge/multi-user-mcp-architecture.md` for multi-tenant patterns
- **Reference** `example/knowledge/service-desk-plus-oauth-scopes.md` for scope permissions
- **Use** npm for all package management operations

## 🏢 Multi-Tenant Architecture

### Key Concepts
- **Self-Client**: Each tenant uses their own Service Desk Plus self-client OAuth app
- **Tenant Isolation**: Complete separation of tokens, data, and rate limits per tenant
- **Scope-Based Access**: Tools are restricted based on OAuth scopes granted to each tenant
- **Per-Tenant Encryption**: Each tenant's tokens encrypted with derived keys

### Implementation Requirements
- **Never** share state between tenants
- **Always** validate tenant context before any operation
- **Implement** per-tenant rate limiting and circuit breakers
- **Use** tenant-specific encryption keys derived from master key
- **Audit** all operations with tenant context

### OAuth Scope Management
- **Check** required scopes before executing any tool
- **Map** MCP tools to Service Desk Plus OAuth scopes
- **Validate** tenant has necessary scopes in their self-client setup
- **Handle** insufficient scope errors gracefully with clear messages

Refer to `example/knowledge/service-desk-plus-oauth-scopes.md` for complete scope reference.

## 🧱 Code Structure & Modularity

### File Organization
- **Never** create source files longer than 500 lines
- **Split** large modules into smaller, focused files
- **Follow** the established pattern:
  - API modules in `src/api/modules/`
  - MCP tools in `src/mcp/`
  - Utility functions in `src/utils/`
  - Types in `src/types/` or module-specific `types.ts`

### Import Conventions
- **Use** ES module imports with `.js` extensions (even for TypeScript files)
- **Prefer** relative imports for project files
- **Group** imports: external packages, then internal modules, then types

Example:
```typescript
import axios from 'axios';
import { z } from 'zod';

import { SDPClient } from '../api/client.js';
import { SDPError } from '../utils/errors.js';

import type { Request, User } from '../api/types.js';
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

### Multi-Tenant Security
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

1. **Navigate** to the project directory: `cd /Users/kalten/projects/SDP-MCP/sdp-mcp-server/`
2. **Consult** `example/knowledge/` folder for relevant API documentation
3. **Review** API endpoints section in this document
4. **Check** Service Desk Plus API docs if needed: https://www.manageengine.com/products/service-desk/sdpod-v3-api/
5. **Implement** features following multi-tenant patterns
6. **Validate** OAuth scopes for each operation
6. **Test** with appropriate tenant context
7. **Run** tests with `npm test`
8. **Lint** code with `npm run lint`
9. **Build** project with `npm run build`
10. **Update** documentation if discovering new API behaviors
11. **Audit** all tenant operations

## 📦 Dependencies

### When Adding Dependencies
- **Verify** the package is actively maintained
- **Check** license compatibility (prefer MIT/Apache)
- **Use** exact versions in package.json
- **Document** why the dependency is needed

### Core Dependencies to Know
- `@modelcontextprotocol/sdk` - MCP server implementation
- `axios` - HTTP client with interceptors
- `zod` - Runtime type validation
- `dotenv` - Environment variable management

## 🔄 Git Practices

- **Write** clear, descriptive commit messages
- **Reference** issue/task numbers in commits
- **Keep** commits focused on single changes
- **Update** .gitignore for new ignore patterns, the main page should contain a summary of recent changes

## 🗄️ Database Integration (PostgreSQL)

### Docker Configuration
- **Always** check running containers with `docker ps -a` before assigning ports
- **Use** non-standard ports to avoid conflicts (e.g., 5433 instead of 5432)
- **PostgreSQL** is the chosen database for production use
- **Location**: Database runs in Docker container named `sdp-mcp-postgres`
- **Start**: Run `docker-compose up -d` to start the database

### Database Features
1. **Multi-Tenant Token Storage**
   - OAuth tokens stored per tenant with encryption
   - Self-client credentials encrypted at rest
   - Automatic token refresh per tenant from database
   - Tenant isolation at database level

2. **Tenant-Specific Audit Logging**
   - All API calls logged with tenant context
   - Per-tenant performance metrics
   - Tenant-specific error tracking
   - Compliance-ready audit trails

3. **Change Tracking by Tenant**
   - All MCP tool operations tracked per tenant
   - Tenant-isolated rollback capability
   - Entity history maintained per tenant
   - Cross-tenant access prevention

4. **Per-Tenant Analytics**
   - Tool usage statistics by tenant
   - Tenant-specific success/failure rates
   - Quota usage monitoring
   - Scope usage tracking

### Connection Details
- Host: localhost 
- Port: 5433 (non-standard to avoid conflicts)
- Database: sdp_mcp
- User: sdpmcpservice
- Password: *jDE1Bj%IPXKMe%Z
- Root user: root / 16vOp$BeC!&9SCqv

### Environment Variables
```bash
# Database connection
SDP_DB_HOST=localhost
SDP_DB_PORT=5433
SDP_DB_NAME=sdp_mcp
SDP_DB_USER=sdpmcpservice
SDP_DB_PASSWORD=your_secure_password_here

# Feature flags
SDP_USE_DB_TOKENS=true      # Enable persistent token storage
SDP_USE_AUDIT_LOG=true      # Enable API audit logging
SDP_USE_CHANGE_TRACKING=true # Enable change tracking
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

### Remember
1. This is for Service Desk Plus **CLOUD** (not on-premises)
2. Each tenant has their own self-client OAuth certificate
3. Always validate OAuth scopes before operations
4. Check documentation before implementing
5. Server accessible at: studio, studio.pttg.loc, 192.168.2.10, 10.212.0.7, localhost

Remember: The goal is to create a robust, maintainable, and well-documented Service Desk Plus Cloud API integration that serves both programmatic use and AI assistant interactions effectively. The knowledge base in `example/knowledge/` is your primary reference for all API implementations.