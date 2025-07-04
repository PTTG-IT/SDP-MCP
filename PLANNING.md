# Service Desk Plus Cloud API - Architecture & Planning

## Project Overview

This project provides a comprehensive integration solution for ManageEngine Service Desk Plus Cloud, featuring both a programmatic API client and an MCP (Model Context Protocol) server for AI assistants.

## Architecture

### System Architecture

```
┌─────────────────────────┐     ┌──────────────────────┐
│   AI Assistant (Claude) │────▶│    MCP Server        │
└─────────────────────────┘     └──────────────────────┘
                                          │
                                          ▼
┌─────────────────────────┐     ┌──────────────────────┐
│   Node.js Application   │────▶│   SDP API Client     │
└─────────────────────────┘     └──────────────────────┘
                                          │
                                          ▼
                                ┌──────────────────────┐
                                │  OAuth 2.0 Auth      │
                                └──────────────────────┘
                                          │
                                          ▼
                                ┌──────────────────────┐
                                │  Service Desk Plus   │
                                │    Cloud API         │
                                └──────────────────────┘
```

### Code Architecture

```
service-desk-plus-cloud-api/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── api/
│   │   ├── client.ts           # Main API client with auth & rate limiting
│   │   ├── auth.ts             # OAuth 2.0 implementation
│   │   ├── types.ts            # Shared TypeScript types
│   │   └── modules/            # API endpoint implementations
│   │       ├── requests.ts     # Request management
│   │       ├── assets.ts       # Asset management
│   │       ├── problems.ts     # Problem tracking
│   │       ├── changes.ts      # Change management
│   │       ├── users.ts        # User operations
│   │       └── projects.ts     # Project management
│   ├── mcp/
│   │   ├── tools.ts            # MCP tool definitions & schemas
│   │   ├── handlers.ts         # Tool implementation logic
│   │   └── schemas.ts          # Additional Zod schemas
│   └── utils/
│       ├── errors.ts           # Custom error classes
│       ├── rateLimit.ts        # Rate limiting implementation
│       └── config.ts           # Configuration management
└── tests/                      # Test files mirroring src structure
```

## Technical Stack

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 18+ (ES Modules)
- **MCP SDK**: @modelcontextprotocol/sdk
- **HTTP Client**: Axios with interceptors
- **Validation**: Zod for runtime type checking
- **Testing**: Jest with ts-jest
- **Linting**: ESLint with TypeScript plugin
- **Formatting**: Prettier

## Design Patterns & Principles

### 1. Repository Pattern
Each API entity (requests, assets, etc.) has its own repository module that encapsulates all operations for that entity.

### 2. Dependency Injection
The API client is injected into MCP handlers, allowing for easy testing and modularity.

### 3. Error Handling Strategy
- Custom error classes for different scenarios
- Centralized error handling in axios interceptors
- User-friendly error messages in MCP tools

### 4. Rate Limiting
- Token bucket algorithm implementation
- Automatic request queuing
- Exponential backoff for retries

### 5. Authentication Flow
```
1. Initial authentication with client credentials
2. Automatic token refresh before expiry
3. Retry failed requests after token refresh
4. Secure token storage in memory (not persisted)
```

## API Coverage

### Currently Implemented
- ✅ Requests (Create, Read, Update, Delete, Search, Notes, Close)
- ✅ Assets (CRUD operations, Search)
- ✅ Users (Read, Search)
- ✅ Problems (Basic CRUD)
- ✅ Changes (Basic CRUD)
- ✅ Projects (Basic CRUD)

### Planned Features
- 📋 Work Logs & Time Tracking
- 📋 Request Templates
- 📋 Bulk Operations
- 📋 Approvals Workflow
- 📋 SLA Management
- 📋 Knowledge Base Integration
- 📋 Custom Fields Management
- 📋 Webhooks Support

## Constraints & Limitations

### API Constraints
1. **Rate Limiting**: 60 requests per minute (configurable)
2. **Pagination**: Maximum 100 items per page
3. **Authentication**: OAuth 2.0 required, no API key support
4. **Scopes**: Different operations require specific OAuth scopes

### Technical Constraints
1. **File Size**: Source files limited to 500 lines for maintainability
2. **Memory**: Token storage is in-memory only
3. **Async Operations**: All API operations are asynchronous
4. **Error Recovery**: Limited to 5 retry attempts

### MCP Constraints
1. **Tool Naming**: Must be lowercase with underscores
2. **Response Format**: Text-based responses for Claude
3. **Input Validation**: All inputs validated with Zod schemas
4. **Stateless**: Each tool invocation is independent

## Security Considerations

1. **Credentials**: OAuth credentials stored in environment variables
2. **Token Security**: Tokens never logged or exposed
3. **Input Validation**: All user inputs sanitized
4. **HTTPS Only**: All API communication over HTTPS
5. **Scope Limitation**: Request minimum required OAuth scopes

## Performance Considerations

1. **Connection Pooling**: Axios maintains connection pool
2. **Request Queuing**: Rate limiter queues requests
3. **Caching**: No caching implemented (planned feature)
4. **Pagination**: Large datasets fetched in pages
5. **Timeout**: 30-second timeout for API requests

## Development Workflow

1. **Feature Request**: Create INITIAL.md with requirements
2. **Planning**: Generate PRP using context engineering
3. **Implementation**: Execute PRP with validation
4. **Testing**: Unit tests + integration tests
5. **Documentation**: Update API and MCP docs
6. **Review**: Code review and testing
7. **Release**: Build and publish

## Quality Standards

### Code Quality
- TypeScript strict mode enabled
- ESLint rules enforced
- 80%+ test coverage target
- No any types without justification

### Documentation
- JSDoc for all public methods
- README kept up to date
- Examples for common use cases
- Troubleshooting guide maintained

### Testing
- Unit tests for all API methods
- Integration tests for MCP tools
- Error scenario coverage
- Mock API responses for testing

## Future Enhancements

### Version 2.0 Planning
1. **Caching Layer**: Redis-based caching for frequently accessed data
2. **Batch Operations**: Process multiple items in single API call
3. **Webhook Support**: Real-time event notifications
4. **File Attachments**: Enhanced file upload/download
5. **Advanced Search**: Complex query builder

### Version 3.0 Vision
1. **GraphQL Support**: Alternative to REST API
2. **Real-time Updates**: WebSocket integration
3. **Offline Support**: Queue operations when offline
4. **Multi-tenant**: Support multiple SDP instances
5. **Analytics**: Built-in usage analytics

## Deployment Considerations

### MCP Server Deployment
- Runs as stdio server for Claude Desktop
- No network ports required
- Configuration via environment variables

### Library Deployment
- Published to npm registry
- Supports both CommonJS and ES modules
- TypeScript definitions included

### Docker Support
- Dockerfile for containerized deployment
- Environment variable configuration
- Health check endpoints

## Monitoring & Maintenance

### Logging
- Structured logging with levels
- API request/response logging (without sensitive data)
- Error tracking with context

### Metrics
- API call counts
- Response times
- Error rates
- Rate limit usage

### Maintenance
- Regular dependency updates
- API compatibility checks
- Security vulnerability scanning
- Performance profiling

This planning document serves as the architectural north star for the project. All implementation decisions should align with these principles and constraints.