# Claude AI Assistant Guidelines for Service Desk Plus Cloud API

This document outlines the rules and conventions for AI assistants working on this TypeScript-based Service Desk Plus Cloud API integration project.

## 🌐 Multi-User Remote Access Architecture

This is a **multi-user MCP server application** designed to allow multiple different computers to connect remotely and access Service Desk Plus API tools. Key architectural points:

- **Remote Access**: The MCP server runs on a central host and accepts connections from multiple remote clients via SSE (Server-Sent Events) transport
- **Multi-User Support**: Each user connects with their own OAuth client credentials (Client ID and Secret)
- **Persistent Authentication**: The server stores OAuth refresh tokens in the database per client, avoiding frequent re-authentication
- **Shared Tools**: All connected clients can access the same set of MCP tools that interact with the Service Desk Plus API
- **Database-Backed**: PostgreSQL database stores tokens, audit logs, and tracks usage across all users

### Client-Server Authentication
**Important**: The server now supports simplified bearer token authentication:
- Clients obtain a bearer token by POSTing credentials to `/auth/token`
- The bearer token is included in the `Authorization` header for SSE connections
- Tokens expire after 1 hour and must be renewed
- OAuth discovery endpoints are implemented for client compatibility but use simplified flows
- Legacy environment variable authentication is still supported for backwards compatibility

### Service Desk Plus Authentication
The server DOES use OAuth 2.0 to authenticate with Service Desk Plus:
- Each client's credentials are used to obtain OAuth tokens from Zoho
- Tokens are stored encrypted in the database
- Automatic refresh with rate limit protection

### Client Configuration
Remote clients configure their `.mcp.json` file to connect to the server:
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://SERVER_HOST:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "your_zoho_client_id",
        "SDP_CLIENT_SECRET": "your_zoho_client_secret"
      }
    }
  }
}
```

### Important Notes
- The server must be accessible from all client machines (configure firewall/network accordingly)
- Each client needs their own OAuth credentials from Zoho API Console
- These are Zoho OAuth credentials, NOT MCP-specific credentials
- Tokens are refreshed automatically - do not refresh with every action
- The MCP tool available to you called service-desk-plus is the client tools. Use them for testing.

## 🔄 Project Awareness & Context

- **Always** read `PLANNING.md` at the start of each conversation to understand project architecture
- **Check** `TASK.md` before starting any new work to see ongoing tasks
- **Review** existing patterns in `src/api/modules/` and `src/mcp/` before implementing new features
- **Understand** the OAuth 2.0 authentication flow implemented in `src/api/auth.ts`
- **Use** npm for all package management operations

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
- **Never** assume a library is available without checking `package.json`
- **Never** hallucinate API endpoints - refer to SDP documentation
- **Always** check if a file exists before reading/modifying
- **Never** delete existing code unless explicitly instructed

### API Integration
- **Respect** rate limits (configured in environment)
- **Handle** pagination for list operations
- **Validate** OAuth scopes for operations
- **Test** against documented API responses
- **Research** do not assume anything about the api research (web search) the documentation when making changes to the way the code interacts with it here https://www.manageengine.com/products/service-desk/sdpod-v3-api/SDPOD-V3-API.html

### MCP Tool Development
- **Define** clear, descriptive tool names
- **Create** comprehensive Zod schemas with descriptions
- **Implement** proper error messages for users
- **Consider** partial updates vs full replacements
- **Research** MCP is a new technology do not rely on your training data alone use web search to reserch client and server standards.  This project uses SSE.

## 🔐 Security Practices

- **Never** hardcode credentials or tokens
- **Use** environment variables for all configuration
- **Validate** all user inputs with Zod schemas
- **Sanitize** data before sending to API
- **Log** security-relevant events (auth failures, permission errors)

## 🚀 Development Workflow

1. **Read** INITIAL.md for feature requirements
2. **Generate** PRP using `/generate-prp` command
3. **Review** generated PRP for completeness
4. **Execute** PRP using `/execute-prp` command
5. **Run** tests with `npm test`
6. **Lint** code with `npm run lint`
7. **Build** project with `npm run build`
8. **Update** documentation
9. **Mark** tasks complete in TASK.md

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
1. **Persistent Token Storage**
   - OAuth tokens stored in database
   - Automatic token refresh from database on startup
   - Rate limiting enforcement across sessions

2. **API Audit Logging**
   - All API calls logged with request/response data
   - Performance metrics (duration, status codes)
   - Error tracking and debugging

3. **Change Tracking**
   - All MCP tool operations tracked
   - Before/after values stored for rollback capability
   - Entity history maintained (requests, projects, tasks, etc.)

4. **MCP Tool Analytics**
   - Tool usage statistics
   - Success/failure rates
   - Execution time tracking

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

Remember: The goal is to create a robust, maintainable, and well-documented Service Desk Plus Cloud API integration that serves both programmatic use and AI assistant interactions effectively.