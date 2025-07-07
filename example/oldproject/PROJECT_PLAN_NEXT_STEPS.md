# Service Desk Plus MCP Server - Next Steps Project Plan

## Executive Summary

This plan outlines the next phase of development for the Service Desk Plus MCP Server, focusing on achieving production readiness for the multi-user remote access architecture. The primary goals are to fix critical broken functionality, complete the Self-Client authentication implementation, and establish a robust foundation for enterprise deployment.

## Project Scope and Objectives

### Primary Objectives
1. **Fix Critical Broken Tools** (38% currently working → 70% target)
2. **Complete Self-Client Authentication** for production multi-user deployment
3. **Implement Missing Core Modules** (Assets, Problems, Changes)
4. **Establish Production Infrastructure** (monitoring, security, deployment)

### Success Criteria
- All lookup tools functioning with proper authentication
- Multi-user remote access stable and secure
- Asset management module fully implemented
- Comprehensive test coverage (>80%)
- Production deployment guide complete

## Technical Approach

### Architecture Decisions
1. **Primary Transport**: SSE (Server-Sent Events) for remote access
2. **Authentication**: Self-Client OAuth with per-user credentials
3. **Database**: PostgreSQL for token storage and audit logging
4. **Testing**: Jest with mock API responses
5. **Deployment**: Docker + PM2 for production

### Key Patterns to Maintain
- Modular API client structure (`src/api/modules/`)
- MCP tool definitions with Zod schemas
- Comprehensive error handling with custom error classes
- Rate limiting with exponential backoff
- TypeScript strict mode

## Implementation Breakdown

### Phase 1: Critical Fixes (Week 1-2)

#### 1.1 Fix Lookup Tools Authentication
**Files to modify:**
- `src/mcp/handlers/lookups.ts`
- `src/api/modules/lookups.ts`
- `src/utils/config.ts`

**Tasks:**
- [ ] Add SDPOnDemand.setup.READ scope to OAuth configuration
- [ ] Update scope validation in authentication flow
- [ ] Test all 6 lookup tools (priorities, categories, statuses, etc.)
- [ ] Add caching layer for lookup results

**Acceptance Criteria:**
- All lookup tools return data successfully
- Results are cached for 1 hour
- No authentication errors

#### 1.2 Implement Field ID Resolution
**Files to create:**
- `src/utils/fieldResolver.ts`
- `src/api/modules/fieldMappings.ts`

**Tasks:**
- [ ] Create field resolver utility class
- [ ] Implement name-to-ID conversion for common fields
- [ ] Add database caching for field mappings
- [ ] Update all tools to use field resolver

**Code Structure:**
```typescript
// src/utils/fieldResolver.ts
export class FieldResolver {
  async resolvePriority(name: string): Promise<string>
  async resolveCategory(name: string): Promise<string>
  async resolveStatus(name: string): Promise<string>
  async resolveTechnician(emailOrName: string): Promise<string>
}
```

#### 1.3 Fix Date Format Handling
**Files to modify:**
- `src/utils/dateUtils.ts`
- All MCP tool handlers using dates

**Tasks:**
- [ ] Create SDPDate formatter utility
- [ ] Update all date fields to use SDPDate format
- [ ] Add validation for date inputs
- [ ] Test with various date formats

### Phase 2: Self-Client Authentication Completion (Week 2-3)

#### 2.1 Fix SSE Transport Integration
**Files to modify:**
- `src/transport/sse-server.ts`
- `src/indexSSESelfClient.ts`
- `src/services/oauthTokenService.ts`

**Tasks:**
- [ ] Resolve header conflicts with MCP SDK
- [ ] Implement proper session management
- [ ] Add connection state tracking
- [ ] Test with multiple concurrent users

#### 2.2 Enhanced Security
**Files to create:**
- `src/security/rateLimiter.ts`
- `src/security/ipWhitelist.ts`

**Tasks:**
- [ ] Implement per-user rate limiting
- [ ] Add IP whitelist support
- [ ] Create audit logging for all operations
- [ ] Add encryption for sensitive data in logs

### Phase 3: Asset Management Module (Week 3-4)

#### 3.1 API Client Implementation
**Files to create:**
- `src/api/modules/assets.ts`
- `src/api/types/assets.ts`

**Tasks:**
- [ ] Research Asset API endpoints
- [ ] Implement CRUD operations
- [ ] Add search and filter capabilities
- [ ] Create comprehensive type definitions

#### 3.2 MCP Tools for Assets
**Files to modify:**
- `src/mcp/tools.ts`
- `src/mcp/handlers.ts`

**New Tools:**
- `create_asset`
- `update_asset`
- `get_asset`
- `search_assets`
- `assign_asset`

### Phase 4: Testing Infrastructure (Week 4-5)

#### 4.1 Unit Tests
**Files to create:**
- `tests/api/modules/*.test.ts`
- `tests/mcp/*.test.ts`
- `tests/utils/*.test.ts`

**Tasks:**
- [ ] Create mock API responses
- [ ] Test all API modules
- [ ] Test MCP tool handlers
- [ ] Test error scenarios

#### 4.2 Integration Tests
**Files to create:**
- `tests/integration/auth.test.ts`
- `tests/integration/multiuser.test.ts`
- `tests/integration/sse.test.ts`

**Tasks:**
- [ ] Test full authentication flow
- [ ] Test multi-user scenarios
- [ ] Test SSE connection lifecycle
- [ ] Test rate limiting

### Phase 5: Production Readiness (Week 5-6)

#### 5.1 Monitoring and Observability
**Files to create:**
- `src/monitoring/metrics.ts`
- `src/monitoring/healthcheck.ts`

**Tasks:**
- [ ] Add Prometheus metrics
- [ ] Create health check endpoints
- [ ] Implement structured logging
- [ ] Add performance monitoring

#### 5.2 Deployment Automation
**Files to create:**
- `Dockerfile`
- `docker-compose.production.yml`
- `.github/workflows/deploy.yml`
- `scripts/deploy.sh`

**Tasks:**
- [ ] Create production Docker image
- [ ] Set up CI/CD pipeline
- [ ] Create deployment scripts
- [ ] Document deployment process

## Dependencies

### External Libraries Needed
- `prom-client`: Prometheus metrics
- `winston`: Structured logging
- `helmet`: Security headers
- `express-rate-limit`: Additional rate limiting

### API Requirements
- SDPOnDemand.setup.READ scope for lookups
- Asset management API endpoints
- Problem/Change management API availability

## Testing Strategy

### Unit Testing
- Mock all external API calls
- Test each module in isolation
- Achieve 80% code coverage

### Integration Testing
- Test full request lifecycle
- Verify multi-user isolation
- Test error recovery

### Performance Testing
- Load test with 50 concurrent users
- Verify rate limit behavior
- Monitor resource usage

### Security Testing
- Penetration testing for OAuth flow
- Verify token encryption
- Test access control

## Risk Assessment

### Technical Risks
1. **SSE Transport Stability**
   - Risk: Connection drops in production
   - Mitigation: Implement reconnection logic and heartbeat

2. **API Rate Limits**
   - Risk: Hitting Zoho API limits with multiple users
   - Mitigation: Implement intelligent caching and request queuing

3. **Database Performance**
   - Risk: Token table growth affecting performance
   - Mitigation: Implement cleanup jobs and indexing

### Business Risks
1. **API Changes**
   - Risk: Zoho changes API without notice
   - Mitigation: Version lock API calls, monitoring for failures

2. **Security Breach**
   - Risk: Token exposure or unauthorized access
   - Mitigation: Encryption, audit logging, regular security reviews

## Implementation Roadmap

### Week 1-2: Critical Fixes
- Fix lookup tools authentication
- Implement field ID resolution
- Fix date format handling
- Basic testing

### Week 2-3: Authentication Completion
- Complete SSE transport integration
- Add security enhancements
- Multi-user testing

### Week 3-4: Asset Management
- Implement asset API client
- Create asset MCP tools
- Integration testing

### Week 4-5: Testing Infrastructure
- Comprehensive unit tests
- Integration test suite
- Performance benchmarking

### Week 5-6: Production Deployment
- Monitoring setup
- Deployment automation
- Documentation completion
- Production launch

## Progress Checkpoints

### Checkpoint 1 (End of Week 2)
- All lookup tools working
- Field resolution implemented
- Date handling fixed
- 50% test coverage

### Checkpoint 2 (End of Week 4)
- Self-Client auth production-ready
- Asset management complete
- 70% test coverage
- Performance benchmarks met

### Checkpoint 3 (End of Week 6)
- All tools functioning
- 80% test coverage
- Production deployed
- Documentation complete

## Next Immediate Actions

1. **Fix OAuth Scopes** (Day 1)
   - Add SDPOnDemand.setup.READ to configuration
   - Test all lookup tools

2. **Create Field Resolver** (Day 2-3)
   - Implement basic resolver class
   - Add priority and category resolution

3. **Fix SSE Headers** (Day 4-5)
   - Resolve MCP SDK conflicts
   - Test with real client

4. **Begin Asset Module** (Week 2)
   - Research API documentation
   - Create type definitions

## Success Metrics

- **Functionality**: 70% of tools working (from current 38%)
- **Reliability**: 99.9% uptime in production
- **Performance**: <200ms average response time
- **Security**: Zero security incidents
- **Adoption**: 10+ active users within first month

This plan provides a clear path to production readiness while addressing the most critical issues first. The phased approach allows for continuous delivery of value while building toward a robust, enterprise-ready solution.