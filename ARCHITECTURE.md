# Architecture Overview

This document describes the architecture of the Service Desk Plus Cloud API MCP Server.

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  AI Assistant   │────▶│   MCP Server    │────▶│  SDP Cloud API  │
│  (Claude, etc)  │     │                 │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   MCP Tools     │     │   API Client    │     │  Zoho OAuth     │
│   (Requests,    │     │   (TypeScript)  │     │   Server         │
│    Assets...)   │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Component Overview

### 1. MCP Server (`src/index.ts`)

The Model Context Protocol (MCP) server that exposes Service Desk Plus functionality to AI assistants.

**Responsibilities:**
- Initialize and configure the MCP server
- Register available tools
- Handle tool execution requests
- Manage API client lifecycle

**Key Features:**
- Stateless design
- Automatic error handling
- Input validation with Zod

### 2. API Client (`src/api/client.ts`)

The core TypeScript client for interacting with Service Desk Plus Cloud API.

**Responsibilities:**
- HTTP request handling
- Request/response transformation
- Error handling and retry logic
- Rate limiting

**Design Patterns:**
- Modular architecture (separate modules for each API domain)
- Dependency injection (axios instance)
- Factory pattern for creating API modules

### 3. Authentication (`src/api/auth.ts`)

OAuth 2.0 authentication manager using Zoho's central authentication server.

**Responsibilities:**
- OAuth token acquisition
- Automatic token refresh
- Secure credential management

**Key Features:**
- Client credentials flow
- Token expiry handling with safety margin
- Automatic retry on auth failures

### 4. API Modules (`src/api/modules/`)

Domain-specific API implementations:

- **RequestsAPI**: Service request management
- **UsersAPI**: User information retrieval
- **AssetsAPI**: Asset management (stub)
- **ProblemsAPI**: Problem management (stub)
- **ChangesAPI**: Change management (stub)
- **ProjectsAPI**: Project management (stub)

**Design Principles:**
- Single Responsibility: Each module handles one domain
- Consistent Interface: All modules follow similar patterns
- Type Safety: Full TypeScript types for all operations

### 5. MCP Tools (`src/mcp/`)

Tool definitions and handlers for AI assistant integration.

**Components:**
- `tools.ts`: Tool metadata and schemas
- `handlers.ts`: Tool implementation logic

**Available Tools:**
- Request Management: create, update, close, search, list
- User Management: get user, search users
- Asset Management: (planned)
- Problem/Change Management: (planned)

### 6. Utilities (`src/utils/`)

Supporting utilities:

- **config.ts**: Environment configuration management
- **errors.ts**: Custom error classes and formatting
- **rateLimit.ts**: Rate limiting implementation

## Data Flow

### 1. Tool Execution Flow

```
AI Assistant → MCP Tool Request → Validation (Zod) → Handler → API Client → SDP API
                                                         ↓
AI Assistant ← Formatted Response ← Handler ← API Response ← SDP API
```

### 2. Authentication Flow

```
API Request → Check Token → Valid? → Make Request
                 ↓           ↓
              Expired?    Invalid?
                 ↓           ↓
            Refresh Token  Return Error
                 ↓
            Update Headers
```

### 3. Error Handling Flow

```
API Error → Error Classification → Custom Error Type → Error Formatting → User Response
              ↓                      ↓                    ↓
           Rate Limit?            Auth Error?         Sanitize Details
              ↓                      ↓                    ↓
          Retry Logic            Refresh Token       Remove Secrets
```

## Security Architecture

### Credential Management
- Environment variables for all secrets
- No hardcoded credentials
- Automatic sanitization of error details

### API Security
- HTTPS enforcement
- OAuth 2.0 authentication
- Rate limiting protection
- Input validation on all endpoints

### Development Security
- Pre-commit hooks to prevent credential commits
- .gitignore configuration
- Security documentation

## Scalability Considerations

### Current Design
- Stateless MCP server
- In-memory token storage
- Client-side rate limiting

### Future Enhancements
- Token caching (Redis/external store)
- Connection pooling
- Batch operations support
- Webhook support

## Error Handling Strategy

### Error Types
1. **SDPError**: Base error class
2. **SDPAuthError**: Authentication failures
3. **SDPRateLimitError**: Rate limit exceeded
4. **SDPValidationError**: Input validation errors
5. **SDPNotFoundError**: Resource not found
6. **SDPPermissionError**: Permission denied

### Error Recovery
- Automatic retry with exponential backoff
- Token refresh on auth failures
- Graceful degradation
- User-friendly error messages

## Configuration

### Environment Variables
```
SDP_CLIENT_ID       # OAuth client ID
SDP_CLIENT_SECRET   # OAuth client secret
SDP_BASE_URL        # SDP instance URL
SDP_INSTANCE_NAME   # SDP instance name
SDP_API_VERSION     # API version (default: v3)
SDP_RATE_LIMIT_PER_MINUTE  # Rate limit (default: 60)
```

### Configuration Loading
- Environment variables take precedence
- Validation on startup
- Clear error messages for missing config

## Testing Strategy

### Unit Tests
- API client methods
- Authentication logic
- Error handling
- Utility functions

### Integration Tests
- API endpoint testing with mocks
- MCP tool execution
- Error scenarios

### Test Structure
```
tests/
├── api/          # API client tests
├── mcp/          # MCP tool tests
├── utils/        # Utility tests
└── fixtures/     # Test data
```

## Development Workflow

### Adding New Features
1. Define types in `types.ts`
2. Implement API module
3. Add MCP tool definition
4. Create handler implementation
5. Write tests
6. Update documentation

### Code Organization
- Clear separation of concerns
- Consistent naming conventions
- Comprehensive JSDoc comments
- TypeScript strict mode

## Performance Considerations

### Current Optimizations
- Rate limiting to prevent API throttling
- Efficient error handling
- Minimal dependencies

### Future Optimizations
- Response caching
- Parallel request handling
- Streaming for large datasets
- Connection reuse

## Deployment

### MCP Server Deployment
- Runs as local process
- Configured via MCP client (Claude Desktop, etc.)
- No external dependencies required

### Production Considerations
- Environment-specific configuration
- Logging configuration
- Monitoring integration
- Security hardening

## Maintenance

### Dependency Management
- Regular security updates
- Compatibility testing
- License compliance

### API Version Management
- Configurable API version
- Backward compatibility considerations
- Migration guides for breaking changes