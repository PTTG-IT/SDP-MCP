# MCP OAuth Implementation

## Overview

This MCP server now implements full OAuth 2.0 authentication for MCP clients, separate from the Service Desk Plus API OAuth tokens. This provides a standards-compliant way for MCP clients to authenticate with the server.

## Architecture

### Two Separate OAuth Systems

1. **MCP OAuth (Client ↔ Server)**
   - Handles authentication between MCP clients and this MCP server
   - Uses dynamic client registration (RFC 7591)
   - Implements authorization code flow with PKCE
   - Stores registered clients and tokens in PostgreSQL

2. **SDP OAuth (Server ↔ API)**
   - Handles authentication between this server and Service Desk Plus API
   - Uses client credentials flow
   - Stores refresh tokens encrypted in database
   - Automatically refreshes tokens as needed

## MCP OAuth Flow

### 1. Discovery
MCP clients discover OAuth endpoints via:
```
GET /.well-known/oauth-authorization-server
```

Response includes all OAuth endpoints and supported features.

### 2. Dynamic Client Registration
Clients register themselves:
```bash
POST /register
Content-Type: application/json

{
  "client_name": "My MCP Client",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "scope": "mcp:tools"
}
```

Response:
```json
{
  "client_id": "mcp_67d588f2e7789aee3411c7193c1c5f8c",
  "client_secret": "a687a9b4b5f73bc17b626379a3ca8f7536f6752f2aa353068e8cf235417ab161",
  "client_name": "My MCP Client",
  "redirect_uris": ["http://localhost:8080/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "scope": "mcp:tools"
}
```

### 3. Authorization
Clients initiate authorization:
```
GET /authorize?
  response_type=code&
  client_id=mcp_67d588f2e7789aee3411c7193c1c5f8c&
  redirect_uri=http://localhost:8080/callback&
  state=xyz&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256
```

Server redirects to `redirect_uri` with authorization code.

### 4. Token Exchange
Exchange authorization code for tokens:
```bash
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTHORIZATION_CODE&
redirect_uri=http://localhost:8080/callback&
client_id=mcp_67d588f2e7789aee3411c7193c1c5f8c&
client_secret=CLIENT_SECRET&
code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "8xLOxBtZp8",
  "scope": "mcp:tools"
}
```

### 5. Using the Access Token
Include the token in requests to the MCP endpoint:
```bash
POST /mcp
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {...}
}
```

## Backward Compatibility

The server maintains backward compatibility with the custom header authentication:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "http",
      "url": "http://127.0.0.1:3456/mcp",
      "headers": {
        "x-sdp-client-id": "1000.XXXXX...",
        "x-sdp-client-secret": "YYYYY..."
      }
    }
  }
}
```

This method bypasses MCP OAuth and directly provides SDP credentials.

## Security Features

1. **PKCE Support**: Required for authorization code flow to prevent code interception
2. **Token Expiration**: Access tokens expire after 1 hour
3. **Refresh Tokens**: Allow obtaining new access tokens without re-authorization
4. **Secure Storage**: All tokens stored in PostgreSQL with proper indexing
5. **Client Validation**: All requests validate client credentials

## Database Schema

The implementation adds these tables:
- `mcp_oauth_clients`: Registered MCP clients
- `mcp_authorization_codes`: Temporary authorization codes
- `mcp_access_tokens`: Active access tokens
- `mcp_refresh_tokens`: Long-lived refresh tokens

## Configuration

No additional configuration needed. The MCP OAuth system initializes automatically when the server starts.

## Migration Guide

### For MCP Client Developers

1. Remove custom headers from your configuration
2. Implement OAuth 2.0 client with dynamic registration
3. Use the discovered endpoints from `/.well-known/oauth-authorization-server`
4. Include Bearer token in Authorization header

### For Existing Users

Your current configuration with custom headers continues to work. No changes required unless you want to use the more secure OAuth flow.

## Troubleshooting

### "Invalid client" Error
- Ensure client is registered via `/register` endpoint
- Check client_id and client_secret are correct

### "Invalid authorization code"
- Codes expire after 10 minutes
- Codes are single-use only
- Ensure redirect_uri matches exactly

### "Token expired"
- Use refresh token to get new access token
- Access tokens expire after 1 hour

## Benefits

1. **Standards Compliance**: Full OAuth 2.0 implementation
2. **Security**: No need to share SDP credentials with clients
3. **Flexibility**: Clients can register dynamically
4. **Separation of Concerns**: MCP auth separate from SDP auth
5. **Future Proof**: Aligns with MCP specification requirements