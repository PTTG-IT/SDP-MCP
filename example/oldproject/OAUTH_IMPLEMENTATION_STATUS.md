# OAuth Implementation Status

## Current Situation

Claude Code's MCP implementation has specific requirements for OAuth that are challenging to satisfy:

1. **Discovery Required**: Claude Code checks for OAuth discovery endpoints
2. **Registration Required**: It expects dynamic client registration support
3. **Authorization Flow**: It wants full authorization code flow, not just client credentials

## What We Implemented

1. ✅ OAuth discovery endpoints (/.well-known/oauth-authorization-server)
2. ✅ Dynamic client registration endpoint (/register)
3. ✅ Bearer token endpoint (/auth/token)
4. ✅ Authorization endpoint stub (/auth/authorize)
5. ✅ Bearer token authentication for SSE

## The Problem

Claude Code is not following through with the OAuth flow after discovery. It:
- Makes discovery requests
- Sees the endpoints
- But doesn't register a client or request tokens
- Falls back to trying direct SSE connection without auth

## Possible Issues

1. **OAuth Config Not Supported**: The `oauth` section in .mcp.json might not be recognized by Claude Code
2. **Flow Mismatch**: Claude Code might expect a different OAuth flow than we're providing
3. **Missing Fields**: There might be required fields in discovery we're not providing

## Recommendations

1. **Use Environment Variables**: The original `env` configuration in .mcp.json works reliably
2. **Wait for Updates**: Claude Code's OAuth support appears incomplete
3. **Alternative Clients**: Consider using other MCP clients that support simpler auth

## Test Commands

Test the OAuth flow manually:
```bash
# 1. Check discovery
curl http://studio:3456/.well-known/oauth-authorization-server

# 2. Register client
curl -X POST http://studio:3456/register \
  -H "Content-Type: application/json" \
  -d '{"client_name": "Test"}'

# 3. Get token
curl -X POST http://studio:3456/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_REAL_CLIENT_ID",
    "client_secret": "YOUR_REAL_SECRET"
  }'

# 4. Connect with token
curl -N http://studio:3456/sse \
  -H "Authorization: Bearer TOKEN_HERE"
```