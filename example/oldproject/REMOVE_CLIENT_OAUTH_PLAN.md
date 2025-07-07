# Plan: Remove OAuth Between MCP Client and Server

## Executive Summary

Remove all OAuth-related code between MCP clients and the server, while maintaining OAuth authentication between the server and Service Desk Plus. The goal is to simplify client connections using direct SSE without any OAuth discovery or authentication flows.

## Current State Analysis

### What's Happening Now
1. Claude Code attempts OAuth discovery when connecting via SSE
2. Server returns 404 for OAuth discovery endpoints
3. Claude Code fails to connect due to "Dynamic client registration failed"
4. The server already uses simple credential authentication (not OAuth)

### What Needs to Change
1. Remove all OAuth discovery endpoint handlers
2. Implement a simple SSE connection without authentication requirements
3. Pass credentials as query parameters or headers instead of environment variables
4. Update all documentation to reflect the simplified approach

## Technical Approach

### Architecture Decision
- **Transport**: Pure SSE without any OAuth layer
- **Authentication**: Simple API key or credentials in headers/query params
- **Security**: HTTPS + IP whitelisting for production
- **Multi-user**: Each user identified by their credentials in the request

## Implementation Plan

### Phase 1: Remove OAuth Discovery Code (Day 1)

#### 1.1 Clean Up Server Code
**Files to modify:**
- `src/indexSSESelfClient.ts`
- `src/transport/sse-server.ts`

**Tasks:**
- [ ] Remove all OAuth discovery endpoints (/.well-known/*, /register)
- [ ] Remove OAuth initialization endpoints
- [ ] Remove any OAuth-related middleware
- [ ] Simplify authentication to just validate credentials

#### 1.2 Modify SSE Connection Flow
**Changes needed:**
- [ ] Accept credentials as query parameters: `/sse?client_id=XXX&client_secret=YYY`
- [ ] Or accept credentials in headers: `X-SDP-Client-ID`, `X-SDP-Client-Secret`
- [ ] Remove session-based authentication
- [ ] Make connection stateless (credentials validated per request)

### Phase 2: Simplify Client Configuration (Day 1-2)

#### 2.1 Update MCP Configuration Format
**New .mcp.json structure:**
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://SERVER:3456/sse?client_id=XXX&client_secret=YYY"
    }
  }
}
```

Or with headers:
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://SERVER:3456/sse",
      "headers": {
        "X-SDP-Client-ID": "XXX",
        "X-SDP-Client-Secret": "YYY"
      }
    }
  }
}
```

#### 2.2 Update Credential Extraction
**Files to modify:**
- `src/indexSSESelfClient.ts` - extractClientCredentials function

**Tasks:**
- [ ] Extract credentials from query parameters
- [ ] Extract credentials from headers
- [ ] Remove dependency on environment variables from client
- [ ] Validate credentials format

### Phase 3: Implement Pure SSE Server (Day 2)

#### 3.1 Create Minimal SSE Endpoint
**Implementation approach:**
```typescript
app.get('/sse', (req, res) => {
  // Extract credentials from query or headers
  const credentials = extractCredentials(req);
  
  if (!validateCredentials(credentials)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  
  // Create transport and connect
  const transport = new SSEServerTransport('/', res);
  server.connect(transport, { clientId: credentials.clientId });
  
  // Handle cleanup
  req.on('close', () => cleanup());
});
```

#### 3.2 Remove Authentication Middleware
**Tasks:**
- [ ] Remove `authenticate` middleware
- [ ] Inline credential validation in SSE endpoint
- [ ] Remove session management
- [ ] Simplify connection tracking

### Phase 4: Update Transport Layer (Day 2-3)

#### 4.1 Modify SSE Transport
**Files to modify:**
- `src/transport/sse-server.ts`
- `src/transport/sse-server-multiuser.ts`

**Tasks:**
- [ ] Remove OAuth-related code
- [ ] Simplify message handling
- [ ] Ensure compatibility with MCP protocol
- [ ] Test with mock client

#### 4.2 Test Connection Flow
**Test scenarios:**
- [ ] Connect with valid credentials
- [ ] Connect with invalid credentials
- [ ] Multiple concurrent connections
- [ ] Connection recovery after disconnect

### Phase 5: Update Documentation (Day 3)

#### 5.1 Update User Documentation
**Files to update:**
- `README.md`
- `docs/MULTI_USER_SETUP.md`
- `docs/SSE_SETUP_GUIDE.md`
- `CLAUDE.md`

**Changes:**
- [ ] Remove all OAuth references for client-server
- [ ] Document new connection format
- [ ] Add security recommendations
- [ ] Update troubleshooting guide

#### 5.2 Update Code Documentation
**Tasks:**
- [ ] Update JSDoc comments
- [ ] Remove OAuth-related comments
- [ ] Document new credential flow
- [ ] Update architecture diagrams

### Phase 6: Security Hardening (Day 3-4)

#### 6.1 Implement Security Measures
**Features to add:**
- [ ] Rate limiting per client ID
- [ ] IP whitelisting (optional)
- [ ] HTTPS enforcement for production
- [ ] Credential validation and sanitization

#### 6.2 Add Monitoring
**Tasks:**
- [ ] Log all connection attempts
- [ ] Track failed authentications
- [ ] Monitor active connections
- [ ] Add metrics for debugging

## Migration Strategy

### For Existing Users
1. Document the breaking change
2. Provide migration script to update .mcp.json
3. Support both methods temporarily (1 week)
4. Remove old code after migration period

### Rollback Plan
1. Keep backup of current code
2. Test thoroughly in staging
3. Gradual rollout to users
4. Quick revert capability

## Testing Strategy

### Unit Tests
- Credential extraction from query/headers
- Validation logic
- SSE message handling

### Integration Tests
- Full connection flow
- Multi-user scenarios
- Error handling
- Reconnection logic

### Manual Testing
- Test with Claude Code
- Test with curl/SSE clients
- Load testing
- Security testing

## Risk Assessment

### Technical Risks
1. **MCP Protocol Compatibility**
   - Risk: Breaking MCP protocol expectations
   - Mitigation: Thoroughly test with MCP SDK

2. **Security Vulnerabilities**
   - Risk: Exposing credentials in URLs
   - Mitigation: Recommend HTTPS, document risks

3. **Breaking Existing Clients**
   - Risk: Current users can't connect
   - Mitigation: Clear migration guide, support period

### Mitigation Strategies
- Extensive testing before release
- Beta testing with select users
- Clear documentation
- Support both methods temporarily

## Success Criteria

1. **Functionality**
   - Claude Code connects without OAuth errors
   - All MCP tools work correctly
   - Multi-user support maintained

2. **Performance**
   - Connection time < 1 second
   - No memory leaks
   - Handles 50+ concurrent users

3. **Security**
   - No credential leaks
   - Rate limiting works
   - Audit trail complete

4. **User Experience**
   - Simpler configuration
   - Clear error messages
   - Easy troubleshooting

## Timeline

- **Day 1**: Remove OAuth code, implement basic SSE
- **Day 2**: Complete SSE implementation, test
- **Day 3**: Update documentation, security hardening
- **Day 4**: Final testing, prepare release
- **Week 2**: Monitor adoption, fix issues

## Next Steps

1. Review and approve plan
2. Create feature branch
3. Begin Phase 1 implementation
4. Set up testing environment
5. Coordinate with users for beta testing

This plan completely removes OAuth between MCP client and server while maintaining security and multi-user support through simpler credential passing mechanisms.