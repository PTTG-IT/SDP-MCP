# Service Desk Plus Cloud MCP Server Development Plan

*Created: July 2025*  
*Last Updated: December 2024*  
*Project Location: `/Users/kalten/projects/SDP-MCP/sdp-mcp-server/`*

## 📊 Current Progress

### Overall Progress: 65% Complete

- **Phase 1: Foundation** ✅ 100% Complete
  - Project Setup ✅
  - Database Layer ✅
  - Core Security ✅
  
- **Phase 2: Multi-Tenant Infrastructure** ✅ 100% Complete
  - Tenant Management ✅
  - OAuth Integration ✅
  - Rate Limiting & Circuit Breakers ✅
  - Granular Error Handling with UTC/CST timestamps ✅
  - Caching System with 3-hour TTL ✅
  
- **Phase 3: Service Desk Plus Integration** ✅ 100% Complete
  - SDP Client Implementation ✅
  - SDP Module Implementations ✅
  - Type Definitions and Schemas ✅
  
- **Phase 4: MCP Server Implementation** ⏳ 67% Complete
  - MCP Server Core ✅
  - MCP Tool Implementation ✅
  - Tool-to-API Mapping ⏳
- **Phase 5: Monitoring & Operations** ⏳ 0% Complete
- **Phase 6: Testing & Security Hardening** ⏳ 0% Complete
- **Phase 7: Deployment & Documentation** ⏳ 0% Complete

## Executive Summary

This document outlines a comprehensive development plan for building a multi-tenant Model Context Protocol (MCP) server that integrates with Service Desk Plus Cloud API. The server will enable AI assistants to perform CRUD operations on all Service Desk Plus entities while maintaining complete tenant isolation and enterprise-grade security.

## 1. Project Analysis

### 1.1 Core Problem Statement

Organizations using Service Desk Plus Cloud need a secure way to enable AI assistants (like Claude) to interact with their service desk data. Each organization (tenant) must have isolated access using their own OAuth credentials, with the MCP server acting as a secure bridge between AI clients and the Service Desk Plus Cloud API.

### 1.2 Key Requirements

#### Functional Requirements
- **Multi-tenant support**: Complete isolation between tenants
- **OAuth 2.0 Authentication**: Self-client certificates per tenant
- **Comprehensive API Coverage**: Support all SDP modules (requests, problems, changes, projects, assets, etc.)
- **MCP Tool Implementation**: Tools for create, read, update, delete, and close operations
- **Scope-based Access Control**: Validate OAuth scopes before operations
- **Token Management**: Automatic refresh with encrypted storage

#### Non-Functional Requirements
- **Security**: Penetration test ready, no legacy practices
- **Performance**: Handle concurrent tenant operations
- **Reliability**: Circuit breakers, rate limiting per tenant
- **Observability**: Comprehensive audit logging
- **Accessibility**: Multiple server endpoints (studio, studio.pttg.loc, 192.168.2.10, etc.)

### 1.3 Technical Constraints

1. **Service Desk Plus Cloud Only** - No on-premises support
2. **MCP Protocol Compliance** - Must follow MCP specification (June 2025)
3. **OAuth Self-Client Model** - Each tenant manages their own OAuth app
4. **Transport Protocol** - Primary: SSE (Server-Sent Events)
5. **Database** - PostgreSQL for persistent storage

### 1.4 Existing Codebase Analysis

The example/oldproject directory contains a previous implementation with valuable patterns:
- OAuth token management (`src/api/auth.ts`)
- Rate limiting implementation (`src/api/rateLimitCoordinator.ts`)
- MCP tool definitions (`src/mcp/tools.ts`)
- SSE transport (`src/transport/sse-server.ts`)
- Database integration (`src/db/`)

**Key Learnings from Previous Implementation:**
- Token refresh coordination is critical
- Per-tenant rate limiting prevents abuse
- Circuit breakers improve reliability
- Audit logging is essential for compliance

## 2. Technical Architecture

### 2.1 System Architecture

```
┌─────────────────────┐     SSE/HTTP    ┌─────────────────────┐      HTTPS     ┌──────────────────┐
│   MCP Clients       │◄───────────────►│  Multi-Tenant MCP   │◄─────────────►│ SDP Cloud API    │
│ (Claude Desktop)    │                 │      Server         │               │ (Per Tenant)     │
└─────────────────────┘                 └─────────────────────┘               └──────────────────┘
         │                                        │                                      │
         │ .mcp.json                              │ PostgreSQL                           │
         │ (client config)                        │ (encrypted tokens)                   │
         └────────────────────────────────────────┴──────────────────────────────────────┘
```

### 2.2 Technology Stack

#### Core Technologies
- **Language**: TypeScript (Node.js 20+)
- **Framework**: Express.js for HTTP/SSE endpoints
- **MCP SDK**: @modelcontextprotocol/sdk
- **Database**: PostgreSQL 15+ with encryption
- **HTTP Client**: Axios with interceptors
- **Validation**: Zod for schema validation
- **Security**: bcrypt, crypto (AES-256-GCM)

#### Development Tools
- **Testing**: Jest for unit tests, Supertest for integration
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier
- **Build**: TypeScript compiler (tsc)
- **Process Management**: PM2 or systemd

### 2.3 Module Architecture

```
src/
├── server/                 # MCP server implementation
│   ├── index.ts           # Server entry point
│   ├── transport/         # SSE/WebSocket handlers
│   └── handlers/          # MCP request handlers
├── tenants/               # Multi-tenant management
│   ├── manager.ts         # Tenant registration/validation
│   ├── isolation.ts       # Tenant context isolation
│   └── models/           # Tenant data models
├── auth/                  # Authentication layer
│   ├── oauth.ts          # OAuth token management
│   ├── scopes.ts         # Scope validation
│   └── encryption.ts     # Token encryption
├── sdp/                   # Service Desk Plus integration
│   ├── client.ts         # SDP API client
│   ├── modules/          # Module-specific implementations
│   └── types/            # TypeScript types for SDP
├── tools/                 # MCP tool implementations
│   ├── requests/         # Request management tools
│   ├── problems/         # Problem management tools
│   ├── changes/          # Change management tools
│   └── [other modules]   # Other SDP modules
├── database/             # Database layer
│   ├── migrations/       # SQL migrations
│   ├── repositories/     # Data access layer
│   └── models/          # Database models
├── monitoring/           # Observability
│   ├── metrics.ts       # Prometheus metrics
│   ├── logging.ts       # Structured logging
│   └── tracing.ts       # Distributed tracing
└── utils/               # Shared utilities
    ├── errors.ts        # Custom error classes
    ├── validation.ts    # Input validation
    └── retry.ts         # Retry logic
```

### 2.4 Data Models

#### Tenant Model
```typescript
interface Tenant {
  id: string;                    // UUID
  name: string;                  // Organization name
  dataCenter: DataCenter;        // US, EU, IN, etc.
  oauthConfig: {
    clientId: string;            // Encrypted
    clientSecret: string;        // Encrypted
    refreshToken: string;        // Encrypted
  };
  allowedScopes: string[];       // OAuth scopes
  rateLimits: RateLimitConfig;
  status: 'active' | 'suspended';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Token Storage Model
```typescript
interface StoredToken {
  tenantId: string;
  accessToken: string;      // Encrypted
  expiresAt: Date;
  refreshToken: string;     // Encrypted
  scopes: string[];
  lastRefreshed: Date;
  encryptionVersion: number;
}
```

## 3. Implementation Plan

### Phase 1: Foundation (Week 1-2) ✅ COMPLETED

#### Task 1.1: Project Setup ✅
- ✅ Initialize TypeScript project with strict configuration
- ✅ Setup ESLint, Prettier, Jest
- ✅ Configure Docker Compose for PostgreSQL
- ✅ Create initial folder structure
- ✅ Setup environment configuration

**Files created:**
- ✅ `package.json`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc`
- ✅ `docker-compose.yml`
- ✅ `.env.example`
- ✅ `src/index.ts` (entry point)

#### Task 1.2: Database Layer ✅
- ✅ Design database schema
- ✅ Create migration scripts
- ✅ Implement connection pooling
- ✅ Setup encryption for sensitive data
- ✅ Create repository pattern for data access

**Files created:**
- ✅ `src/database/migrations/*.sql` (8 migration files)
- ✅ `src/database/connection.ts`
- ✅ `src/database/repositories/TenantRepository.ts`
- ✅ `src/database/repositories/TokenRepository.ts`

#### Task 1.3: Core Security Implementation ✅
- ✅ Implement encryption utilities (AES-256-GCM)
- ✅ Create key derivation for per-tenant encryption
- ✅ Setup secure configuration management
- ✅ Implement audit logging framework

**Files created:**
- ✅ `src/auth/encryption.ts`
- ✅ `src/auth/keyManager.ts`
- ✅ `src/monitoring/auditLogger.ts`
- ✅ `src/utils/config.ts`
- ✅ `src/monitoring/logging.ts`
- ✅ `src/utils/redis.ts`

### Phase 2: Multi-Tenant Infrastructure (Week 2-3) ⏳ IN PROGRESS

#### Task 2.1: Tenant Management ✅
- ✅ Implement tenant registration system
- ✅ Create tenant validation and verification
- ✅ Implement tenant isolation middleware
- ✅ Setup per-tenant context management

**Files created:**
- ✅ `src/tenants/manager.ts`
- ✅ `src/tenants/validator.ts`
- ✅ `src/tenants/middleware.ts`
- ✅ `src/tenants/context.ts`
- ✅ `src/tenants/models/tenant.ts`

#### Task 2.2: OAuth Integration ✅
- ✅ Implement OAuth token management
- ✅ Create automatic token refresh logic
- ✅ Implement scope validation system
- ✅ Setup token storage with encryption

**Files created:**
- ✅ `src/auth/oauth.ts`
- ✅ `src/auth/tokenManager.ts`
- ✅ `src/auth/scopeValidator.ts`
- ✅ `src/auth/refreshScheduler.ts`

#### Task 2.3: Rate Limiting & Circuit Breakers ✅
- ✅ Implement per-tenant rate limiting
- ✅ Create circuit breaker per tenant
- ✅ Setup Redis for distributed rate limiting
- ✅ Implement backoff strategies

**Files created:**
- ✅ `src/middleware/rateLimiter.ts`
- ✅ `src/utils/circuitBreaker.ts`
- ✅ `src/utils/backoff.ts`
- ✅ `src/monitoring/rateLimitMonitor.ts`
- ✅ `tests/rateLimiting.test.ts`

#### Task 2.4: Enhanced Error Handling & Caching ✅
- ✅ Implement granular error types with database logging
- ✅ Add UTC and CST timestamp support for all logs
- ✅ Create caching system with 3-hour TTL
- ✅ Research and implement optimal MCP tool granularity

**Files created:**
- ✅ `src/utils/errors.ts` (enhanced with granular error types)
- ✅ `src/utils/cache.ts` (3-hour TTL caching system)

### Phase 3: Service Desk Plus Integration (Week 3-4)

#### Task 3.1: SDP Client Implementation ✅
- ✅ Create base HTTP client with interceptors
- ✅ Implement authentication headers
- ✅ Add request/response logging
- ✅ Handle API errors and retries

**Files created:**
- ✅ `src/sdp/client.ts`
- ✅ `src/sdp/interceptors.ts`
- ✅ `src/sdp/errorHandler.ts`
- ✅ `tests/sdp/client.test.ts`

#### Task 3.2: SDP Module Implementations ✅
- ✅ Implement Requests module
- ✅ Implement Problems module
- ✅ Implement Changes module
- ✅ Implement Projects module
- ✅ Implement Assets module

**Files created:**
- ✅ `src/sdp/modules/requests.ts`
- ✅ `src/sdp/modules/problems.ts`
- ✅ `src/sdp/modules/changes.ts`
- ✅ `src/sdp/modules/projects.ts`
- ✅ `src/sdp/modules/assets.ts`
- ✅ `src/sdp/modules/index.ts`

#### Task 3.3: Type Definitions ✅
- ✅ Create TypeScript interfaces for all SDP entities
- ✅ Add Zod schemas for validation
- ✅ Create response type mappings

**Files created:**
- ✅ `src/sdp/schemas/common.ts`
- ✅ `src/sdp/schemas/requests.ts`
- ✅ `src/sdp/schemas/problems.ts`
- ✅ `src/sdp/schemas/changes.ts`
- ✅ `src/sdp/schemas/projects.ts`
- ✅ `src/sdp/schemas/assets.ts`
- ✅ `src/sdp/schemas/index.ts`
- ✅ `src/sdp/types/index.ts`

### Phase 4: MCP Server Implementation (Week 4-5)

#### Task 4.1: MCP Server Core ✅
- ✅ Setup MCP server with SSE transport
- ✅ Implement connection handling
- ✅ Add authentication middleware
- ✅ Create request routing

**Files created:**
- ✅ `src/server/index.ts`
- ✅ `src/server/transport/sse.ts`
- ✅ `src/server/middleware/auth.ts`
- ✅ `src/server/middleware/scopes.ts`
- ✅ `src/server/middleware/usage.ts`
- ✅ `src/server/middleware/errorHandler.ts`
- ✅ `src/server/toolRegistry.ts`
- ✅ `src/server/connectionManager.ts`
- ✅ `src/server/types.ts`

#### Task 4.2: MCP Tool Implementation ✅
- ✅ Create tool definitions for each operation
- ✅ Implement tool handlers with tenant context
- ✅ Add input validation with Zod
- ✅ Implement error handling
- ✅ Add batch operations support
- ✅ Implement advanced error handling
- ✅ Create documentation tools
- ✅ Add health monitoring tools

**Files created:**
- ✅ `src/server/tools/requests.ts`
- ✅ `src/server/tools/problems.ts`
- ✅ `src/server/tools/changes.ts`
- ✅ `src/server/tools/projects.ts`
- ✅ `src/server/tools/assets.ts`
- ✅ `src/server/tools/index.ts`
- ✅ `src/server/tools/batch.ts`
- ✅ `src/server/tools/errorHandling.ts`
- ✅ `src/server/tools/documentation.ts`
- ✅ `src/server/tools/health.ts`

#### Task 4.3: Tool-to-API Mapping
- Map MCP tools to SDP API endpoints
- Implement request transformation
- Add response formatting
- Handle pagination

**Files to create:**
- `src/server/handlers/toolHandler.ts`
- `src/utils/transformer.ts`
- `src/utils/paginator.ts`

### Phase 5: Monitoring & Operations (Week 5-6)

#### Task 5.1: Observability
- Setup Prometheus metrics
- Implement structured logging
- Add distributed tracing
- Create health check endpoints

**Files to create:**
- `src/monitoring/metrics.ts`
- `src/monitoring/logger.ts`
- `src/monitoring/tracer.ts`
- `src/server/health.ts`

#### Task 5.2: Admin Interface
- Create tenant management API
- Add token status monitoring
- Implement usage analytics
- Setup alerting rules

**Files to create:**
- `src/admin/api.ts`
- `src/admin/dashboard.ts`
- `src/monitoring/alerts.ts`

### Phase 6: Testing & Security Hardening (Week 6-7)

#### Task 6.1: Comprehensive Testing
- Write unit tests for all modules
- Create integration tests
- Add end-to-end tests
- Implement load testing

**Files to create:**
- `tests/unit/**/*.test.ts`
- `tests/integration/**/*.test.ts`
- `tests/e2e/**/*.test.ts`
- `tests/load/scenarios.js`

#### Task 6.2: Security Hardening
- Implement security headers
- Add input sanitization
- Setup CORS properly
- Implement request signing

**Files to create:**
- `src/middleware/security.ts`
- `src/utils/sanitizer.ts`
- `src/middleware/cors.ts`

#### Task 6.3: Penetration Test Preparation
- Review OWASP Top 10
- Implement security logging
- Add intrusion detection
- Create security documentation

**Files to create:**
- `docs/SECURITY.md`
- `src/security/detector.ts`
- `tests/security/**/*.test.ts`

### Phase 7: Deployment & Documentation (Week 7-8)

#### Task 7.1: Deployment Setup
- Create Docker images
- Setup Kubernetes manifests
- Configure CI/CD pipeline
- Create deployment scripts

**Files to create:**
- `Dockerfile`
- `k8s/*.yaml`
- `.github/workflows/ci.yml`
- `scripts/deploy.sh`

#### Task 7.2: Documentation
- Write API documentation
- Create tenant onboarding guide
- Document operations procedures
- Add troubleshooting guides

**Files to create:**
- `docs/API.md`
- `docs/TENANT_SETUP.md`
- `docs/OPERATIONS.md`
- `docs/TROUBLESHOOTING.md`

## 4. Dependencies

### Production Dependencies
```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "express": "^4.19.0",
  "axios": "^1.7.0",
  "zod": "^3.23.0",
  "pg": "^8.12.0",
  "redis": "^4.6.0",
  "winston": "^3.13.0",
  "prom-client": "^15.1.0",
  "bcrypt": "^5.1.0",
  "jsonwebtoken": "^9.0.0",
  "dotenv": "^16.4.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "compression": "^1.7.4",
  "express-rate-limit": "^7.2.0",
  "ioredis": "^5.3.0"
}
```

### Development Dependencies
```json
{
  "typescript": "^5.4.0",
  "@types/node": "^20.12.0",
  "@types/express": "^4.17.0",
  "jest": "^29.7.0",
  "@types/jest": "^29.5.0",
  "ts-jest": "^29.1.0",
  "supertest": "^6.3.0",
  "eslint": "^8.57.0",
  "@typescript-eslint/eslint-plugin": "^7.0.0",
  "prettier": "^3.2.0",
  "nodemon": "^3.1.0",
  "ts-node": "^10.9.0"
}
```

## 5. Testing Strategy

### 5.1 Unit Testing
- Test all business logic in isolation
- Mock external dependencies
- Achieve >80% code coverage
- Focus on edge cases and error paths

### 5.2 Integration Testing
- Test database operations
- Verify OAuth token flow
- Test rate limiting behavior
- Validate tenant isolation

### 5.3 End-to-End Testing
- Test complete MCP tool flows
- Verify multi-tenant scenarios
- Test error handling
- Validate security controls

### 5.4 Performance Testing
- Load test with multiple tenants
- Measure response times
- Test rate limit effectiveness
- Verify resource usage

### 5.5 Security Testing
- Run automated security scans
- Test for OWASP vulnerabilities
- Verify encryption implementation
- Test authentication bypasses

## 6. Risk Assessment

### High-Risk Areas

1. **Token Management Complexity**
   - Risk: Token refresh race conditions
   - Mitigation: Implement distributed locking
   - Validation: Stress test concurrent refreshes

2. **Tenant Data Isolation**
   - Risk: Cross-tenant data leakage
   - Mitigation: Strict context validation
   - Validation: Penetration testing

3. **Rate Limit Bypass**
   - Risk: DDoS through multiple endpoints
   - Mitigation: Global rate limiting layer
   - Validation: Load testing

4. **OAuth Scope Escalation**
   - Risk: Unauthorized access to operations
   - Mitigation: Strict scope validation
   - Validation: Security audit

### Medium-Risk Areas

1. **API Changes**
   - Risk: Service Desk Plus API changes
   - Mitigation: Version detection, graceful degradation
   - Validation: API compatibility tests

2. **Performance Degradation**
   - Risk: Slow response times with scale
   - Mitigation: Caching, connection pooling
   - Validation: Performance benchmarks

## 7. Success Criteria

### Functional Success
- ✓ All MCP tools working for all SDP modules
- ✓ Multi-tenant isolation verified
- ✓ OAuth token management stable
- ✓ Rate limiting effective
- ✓ Audit logging comprehensive

### Non-Functional Success
- ✓ Response time <500ms for 95% of requests
- ✓ 99.9% uptime
- ✓ Zero security vulnerabilities (OWASP)
- ✓ Horizontal scalability demonstrated
- ✓ Complete tenant isolation verified

### Operational Success
- ✓ Automated deployment pipeline
- ✓ Comprehensive monitorin
- ✓ Clear documentation
- ✓ Disaster recovery tested
- ✓ Tenant onboarding <30 minutes

## 8. Implementation Checkpoints

### Checkpoint 1 (End of Week 2) ✅ ACHIEVED
- ✅ Database layer complete
- ✅ Security implementation done
- ✅ Basic tenant management working
- ✅ OAuth integration complete

### Checkpoint 2 (End of Week 4) ✅ ACHIEVED
- ✅ OAuth integration complete
- ✅ Rate limiting and circuit breakers complete
- ✅ Enhanced error handling and caching complete
- ✅ SDP client working
- ✅ All 5 core modules implemented (Requests, Problems, Changes, Projects, Assets)

### Checkpoint 3 (End of Week 6)
- All MCP tools implemented
- Monitoring in place
- Testing >80% coverage

### Checkpoint 4 (End of Week 8)
- Security hardening complete
- Documentation finished
- Production ready

## 9. Next Steps

### Completed Tasks (Phase 4.1) ✅
1. **MCP Server Core Implementation**:
   - ✅ MCP server with SSE transport initialized
   - ✅ Connection handling and authentication implemented
   - ✅ Tenant context middleware added
   - ✅ Request routing system created

2. **Tool Registration System**:
   - ✅ Dynamic tool registration implemented
   - ✅ Tool-to-module mapping complete
   - ✅ OAuth scope-based permission checking
   - ✅ Tool metadata and descriptions added

3. **Connection Management**:
   - ✅ Client connection tracking implemented
   - ✅ Session management per tenant
   - ✅ Heartbeat and keepalive mechanisms
   - ✅ Graceful disconnection handling

### Current Tasks (Phase 4.2) - MCP Tool Implementation ⏳
1. **Tool Refinements**:
   - Add more specialized tools for complex operations
   - Implement batch operations where applicable
   - Add tool-specific error handling

### Upcoming Tasks (Phase 4.3)
1. **Tool-to-API Mapping** refinements
2. **Advanced response formatting**
3. **Pagination and filtering improvements**

## 10. Key Accomplishments to Date

### Infrastructure Established
1. **Complete Project Structure**: All directories and configuration files in place
2. **Database Schema**: 8 comprehensive tables with migrations ready
3. **Security Foundation**: AES-256-GCM encryption, per-tenant key derivation
4. **Audit System**: Comprehensive logging with UTC/CST timestamps for compliance

### Multi-Tenant Architecture
1. **Tenant Isolation**: AsyncLocalStorage-based context isolation
2. **Tenant Management**: Registration, validation, and lifecycle management
3. **OAuth Integration**: Automatic token refresh with distributed locking
4. **Scope Validation**: Granular permission system with tool mapping
5. **Rate Limiting**: Per-tenant rate limits with monitoring and alerts
6. **Circuit Breakers**: Three-state circuit breakers with automatic recovery

### Technical Highlights
1. **Type Safety**: Strict TypeScript configuration throughout
2. **Repository Pattern**: Clean data access layer
3. **Redis Integration**: Caching (3-hour TTL) and distributed locks
4. **Error Handling**: Granular error classes with automatic database logging
5. **Monitoring**: Rate limit monitor with warning/critical alerts
6. **Backoff Strategies**: Exponential backoff with jitter for resilience

## 11. Architecture Decision Records

### ADR-001: TypeScript over JavaScript
**Decision**: Use TypeScript for type safety and better IDE support
**Rationale**: Critical for maintaining code quality in multi-tenant system

### ADR-002: PostgreSQL over MongoDB
**Decision**: Use PostgreSQL for ACID compliance
**Rationale**: Financial data integrity and complex queries required

### ADR-003: SSE over WebSocket
**Decision**: Primary transport as SSE
**Rationale**: Simpler implementation, firewall friendly, sufficient for use case

### ADR-004: Self-Client OAuth Model
**Decision**: Each tenant manages own OAuth app
**Rationale**: Better security isolation, compliance with enterprise policies

### ADR-005: Per-Tenant Encryption Keys
**Decision**: Derive encryption keys per tenant from master key
**Rationale**: Enhanced security isolation, easier key rotation per tenant

### ADR-006: Granular Error Handling with Dual Timezones
**Decision**: Implement granular error types with UTC and CST timestamps
**Rationale**: Compliance requirements for detailed audit trails with regional timezone support

### ADR-007: 3-Hour Cache TTL for Read Operations
**Decision**: Implement Redis caching with 3-hour TTL for all read operations
**Rationale**: Balance between performance optimization and data freshness for SDP operations

### ADR-008: Balanced MCP Tool Granularity
**Decision**: Group related operations into logical tools (e.g., request_management, problem_management)
**Rationale**: Based on research, balanced approach provides better UX while maintaining flexibility

---

This plan provides a comprehensive roadmap for building a secure, scalable, multi-tenant MCP server for Service Desk Plus Cloud integration. The phased approach allows for iterative development while maintaining focus on security and reliability throughout the project.