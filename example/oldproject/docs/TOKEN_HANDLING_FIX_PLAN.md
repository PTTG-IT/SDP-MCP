# Token Handling Fix Plan

## Planning Phase - Extended Reasoning

### 1. Project Analysis

#### Current Issues Identified:
1. **Multiple Client Instances**: The MCP server creates a new SDPClient in `index.ts` while the clientFactory maintains a separate singleton instance
2. **Token Refresh Loop**: The 401 error handler calls `forceRefresh()` which can trigger multiple refresh attempts
3. **Rate Limit Confusion**: Access tokens last 1 hour (not 10 minutes) but we're hitting the refresh token rate limit
4. **Incorrect Token Validation**: The comment says "token should last for 10 minutes" but Zoho tokens last 1 hour

#### Core Problem:
Multiple SDPClient instances are not sharing the same TokenStore properly, leading to:
- Redundant token refresh attempts
- Hitting the 5 refreshes/minute rate limit
- Authentication loops when multiple requests fail simultaneously

#### Technical Constraints:
- Zoho OAuth limits: 5 refresh tokens/minute, 10 access tokens/10 minutes per refresh token
- Access tokens expire after 3600 seconds (1 hour)
- Refresh tokens never expire
- Must use Bearer prefix (not Zoho-oauthtoken) for ServiceDesk Plus Cloud

### 2. Detailed Planning

#### Project Scope and Objectives:
- Ensure all MCP tools share the same access token
- Prevent redundant token refresh attempts
- Implement proper retry logic with exponential backoff
- Fix token expiry calculation (1 hour, not 10 minutes)
- Add comprehensive logging for token operations

#### Technical Approach:
1. **Singleton Client Pattern**: Ensure only one SDPClient instance exists
2. **Token Refresh Mutex**: Prevent concurrent refresh attempts
3. **Proper Error Handling**: Avoid refresh loops on 401 errors
4. **Correct Token Timing**: Fix expiry calculations and safety margins

#### Implementation Breakdown:
1. Fix client instantiation to use singleton pattern everywhere
2. Add mutex/lock mechanism to TokenStore for refresh operations
3. Implement proper retry logic with exponential backoff
4. Fix token expiry calculation and comments
5. Add comprehensive logging for debugging
6. Update error handlers to prevent loops

#### File Structure:
Files to modify:
- `/src/api/tokenStore.ts` - Add refresh mutex, fix timing
- `/src/api/auth.ts` - Fix expiry calculation, add logging
- `/src/api/client.ts` - Improve 401 error handling
- `/src/index.ts` - Use clientFactory instead of new SDPClient
- `/src/utils/clientFactory.ts` - Ensure proper singleton

Files to create:
- `/src/utils/mutex.ts` - Simple mutex implementation for token refresh

#### Dependencies:
No new external dependencies needed

#### Testing Strategy:
1. Unit tests for TokenStore mutex behavior
2. Integration test for concurrent token refresh attempts
3. Manual testing with expired tokens
4. Stress test with multiple concurrent MCP tool calls

#### Risk Assessment:
- **Risk**: Breaking existing functionality during refactor
  - **Mitigation**: Incremental changes with testing at each step
- **Risk**: Race conditions in token refresh
  - **Mitigation**: Proper mutex implementation
- **Risk**: Different environments (test scripts vs MCP server)
  - **Mitigation**: Ensure all code paths use singleton pattern

### 3. Plan Validation

#### Completeness Check:
- ✅ Addresses root cause (multiple client instances)
- ✅ Prevents token refresh race conditions
- ✅ Fixes incorrect timing assumptions
- ✅ Maintains backward compatibility
- ✅ Follows existing patterns (singleton, error handling)

#### Alignment with Codebase:
- Uses existing TokenStore singleton pattern
- Maintains current API interfaces
- Follows TypeScript conventions
- Compatible with MCP server architecture

### 4. Implementation Roadmap

#### Phase 1: Fix Client Instantiation (Priority: HIGH)
1. Update `src/index.ts` to use `getClient()` from clientFactory
2. Verify all handlers use the same client instance
3. Add logging to confirm single instance

**Acceptance Criteria**: Only one SDPClient instance exists across all MCP tools

#### Phase 2: Implement Token Refresh Mutex (Priority: HIGH)
1. Create mutex utility class
2. Add mutex to TokenStore for refresh operations
3. Prevent concurrent refresh attempts
4. Add refresh attempt logging

**Acceptance Criteria**: No concurrent token refresh attempts occur

#### Phase 3: Fix Token Timing (Priority: MEDIUM)
1. Update token expiry calculation (3600 seconds - safety margin)
2. Fix comments about token duration
3. Adjust safety margin to 5 minutes (300 seconds)
4. Add token expiry logging

**Acceptance Criteria**: Tokens are refreshed only when needed

#### Phase 4: Improve Error Handling (Priority: MEDIUM)
1. Add retry attempt counter to prevent loops
2. Implement exponential backoff for 401 retries
3. Better error messages for rate limit issues
4. Add comprehensive error logging

**Acceptance Criteria**: No authentication loops, clear error messages

#### Phase 5: Testing and Validation (Priority: HIGH)
1. Create test script for concurrent requests
2. Test with expired tokens
3. Test with invalid refresh token
4. Verify single token usage across tools

**Acceptance Criteria**: All tests pass, no rate limit errors

## Key Decisions and Rationale

1. **Use Singleton Client**: Ensures token sharing across all tools
2. **Mutex for Refresh**: Prevents race conditions and redundant refreshes
3. **5-minute Safety Margin**: Accounts for clock skew and request time
4. **Exponential Backoff**: Prevents hammering the API on failures
5. **Comprehensive Logging**: Essential for debugging OAuth issues

## Areas Requiring Clarification

1. Should we implement token persistence to disk for server restarts?
2. What should happen if all retry attempts fail?
3. Should we add metrics/monitoring for token operations?

## Implementation Order

1. Fix client singleton issue (immediate fix)
2. Add mutex for token refresh (prevent race conditions)
3. Fix timing calculations (correct behavior)
4. Improve error handling (better UX)
5. Add comprehensive testing (validation)

**Estimated Time**: 4-6 hours for complete implementation and testing

## Success Metrics

- Zero "too many requests continuously" errors
- Single token shared across all MCP tools
- Token refreshed at most once per 55 minutes
- Clear error messages when authentication fails
- No authentication retry loops