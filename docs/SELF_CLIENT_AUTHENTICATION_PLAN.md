# Service Desk Plus MCP Server - Self Client Authentication Implementation Plan

## 1. Project Analysis and Current State

### Current Architecture
- **Existing Implementation**: The project already has a self-client authentication implementation in `src/indexSSESelfClient.ts`
- **Token Management**: Uses `OAuthTokenService` for database-backed token storage with encryption
- **Rate Limiting**: Comprehensive rate limiting system aware of Zoho's 10 tokens/10 minutes restriction
- **Database**: PostgreSQL for persistent token storage with AES-256-GCM encryption
- **Transport**: SSE (Server-Sent Events) for MCP communication

### Key Issues Identified
1. Current implementation expects server to have its own credentials rather than using client-provided ones
2. Token refresh failures are causing continuous circuit breaker trips (seen in server logs)
3. No clear path for initial OAuth setup for new clients
4. Missing user-friendly error messages and recovery guidance

## 2. Detailed Implementation Plan

### 2.1 Core Authentication Flow

**Objective**: Enable remote users to authenticate using only Client ID and Secret in their `.mcp.json`

**Technical Approach**:
1. **Client Credentials Extraction**: Already implemented in `extractClientCredentials()` - extracts from headers
2. **Per-Session Client Management**: Uses `sessionClients` Map to maintain separate clients per session
3. **Token Lifecycle**: 
   - Initial setup: User must perform one-time OAuth authorization
   - Ongoing usage: Server manages token refresh automatically
   - Token storage: Encrypted in PostgreSQL, keyed by client ID hash

### 2.2 Initial OAuth Setup Flow

**New Endpoint Required**: `/oauth/initialize`
- Purpose: Guide users through initial authorization code generation
- Returns: Instructions URL and status

**Implementation Steps**:
1. Create new endpoint that checks if client has stored tokens
2. If no tokens exist, return Zoho OAuth URL with proper parameters
3. User visits URL, generates authorization code
4. User submits code via `/oauth/setup` endpoint (already exists)
5. Server exchanges code for tokens and stores encrypted

### 2.3 Token Management Enhancements

**Improvements Needed**:
1. **Graceful Degradation**: When no refresh token exists, provide clear instructions
2. **Token Validation**: Check token validity before each API call
3. **Automatic Refresh**: Refresh tokens 5 minutes before expiry
4. **Circuit Breaker Recovery**: Reset circuit breaker when user provides new tokens

### 2.4 Error Handling and User Experience

**Error States to Handle**:
1. **No Tokens Found**: Return setup instructions via MCP response
2. **Expired Refresh Token**: Guide user to re-authorize
3. **Rate Limit Exceeded**: Queue requests or return retry-after
4. **Invalid Credentials**: Clear error message with resolution steps

## 3. Implementation Breakdown

### Phase 1: Core Authentication (Week 1)
1. **Update `getSessionClient()` in `indexSSESelfClient.ts`**:
   - Add better error handling for missing tokens
   - Include setup instructions in error responses

2. **Create OAuth initialization helper**:
   - Generate proper Zoho OAuth URLs
   - Include required scopes
   - Handle data center variations

3. **Enhance error responses**:
   - Add `needsSetup` flag to MCP tool responses
   - Include setup URL when authorization needed

### Phase 2: Token Persistence (Week 1)
1. **Enhance `OAuthTokenService`**:
   - Add method to check if client needs setup
   - Implement token rotation tracking
   - Add cleanup for expired tokens

2. **Database schema updates**:
   - Add `needs_reauth` flag to oauth_tokens table
   - Track authorization failures
   - Store last successful API call timestamp

### Phase 3: User Experience (Week 2)
1. **Create setup documentation**:
   - Step-by-step OAuth setup guide
   - Troubleshooting common issues
   - Data center specific instructions

2. **Implement setup notification system**:
   - Return setup status in health endpoint
   - Add MCP tool for checking auth status
   - Provide clear next steps

3. **Add recovery mechanisms**:
   - Manual token refresh endpoint
   - Circuit breaker reset capability
   - Token validation tool

### Phase 4: Monitoring and Reliability (Week 2)
1. **Enhanced logging**:
   - Track all OAuth operations
   - Monitor token refresh patterns
   - Alert on repeated failures

2. **Automated recovery**:
   - Detect and handle token rotation
   - Implement exponential backoff
   - Queue failed requests for retry

## 4. File Structure Changes

### New Files
- `src/services/oauthSetupService.ts` - OAuth setup flow management
- `src/mcp/tools/authStatus.ts` - MCP tool for auth status
- `docs/OAUTH_SETUP_GUIDE.md` - User setup documentation
- `scripts/check-oauth-status.js` - CLI tool for debugging

### Modified Files
- `src/indexSSESelfClient.ts` - Enhanced error handling
- `src/services/oauthTokenService.ts` - Add setup checking
- `src/db/migrations/003_oauth_enhancements.sql` - Schema updates
- `src/mcp/handlers.ts` - Add auth status to responses

## 5. Configuration and Environment

### Required Environment Variables
```bash
# Existing
SDP_BASE_URL=https://helpdesk.company.com
SDP_INSTANCE_NAME=instance_name
SDP_ENCRYPTION_KEY=32_byte_key_here

# New (optional)
SDP_OAUTH_REDIRECT_URI=http://localhost:3456/oauth/callback
SDP_OAUTH_SCOPES=SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL
SDP_SETUP_MODE=true  # Enable setup endpoints
```

### Client Configuration (.mcp.json)
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://server:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "1000.XXXXX...",
        "SDP_CLIENT_SECRET": "YYYYY..."
      }
    }
  }
}
```

## 6. Security Considerations

1. **Credential Protection**:
   - Never log client secrets
   - Encrypt all stored tokens
   - Use secure random for session IDs

2. **Rate Limiting**:
   - Respect Zoho's limits
   - Implement per-client rate limiting
   - Track and report limit violations

3. **Access Control**:
   - Validate client credentials on each request
   - Implement session timeouts
   - Clean up inactive sessions

## 7. Testing Strategy

### Unit Tests
- OAuth token service methods
- Client credential extraction
- Token refresh logic
- Error handling paths

### Integration Tests
- Full OAuth flow simulation
- Token refresh scenarios
- Rate limit enforcement
- Circuit breaker behavior

### End-to-End Tests
- New client setup flow
- Token expiry and refresh
- Error recovery scenarios
- Multi-client isolation

## 8. Migration Strategy

For existing deployments:
1. Deploy new version with setup mode enabled
2. Existing clients continue working
3. New clients follow setup flow
4. Gradual migration of old clients

## 9. Success Metrics

- Zero manual token management for users after initial setup
- 99.9% uptime for authenticated sessions
- < 1% token refresh failure rate
- Clear error messages leading to self-resolution
- Automatic recovery from transient failures

## 10. Risk Mitigation

### Risks and Mitigations
1. **Risk**: Zoho changes OAuth flow
   - **Mitigation**: Abstract OAuth logic, monitor Zoho docs

2. **Risk**: Database encryption key loss
   - **Mitigation**: Key backup strategy, recovery procedures

3. **Risk**: Rate limit exhaustion
   - **Mitigation**: Request queuing, backoff strategies

4. **Risk**: Token theft
   - **Mitigation**: Session binding, activity monitoring

## Implementation Timeline

**Week 1**: Core authentication and token persistence
**Week 2**: User experience and monitoring
**Week 3**: Testing and documentation
**Week 4**: Deployment and migration support

This plan provides a complete path to implementing self-client authentication where users only need to provide Client ID and Secret, with the server handling all token management including secure storage of refresh tokens in the database.