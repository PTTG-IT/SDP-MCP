# Bearer Token Authentication for MCP Server

The Service Desk Plus MCP server now supports simplified bearer token authentication, eliminating OAuth discovery complexity while maintaining security best practices.

## How It Works

1. **Client obtains a bearer token** by sending credentials to `/auth/token`
2. **Client includes the token** in the `Authorization` header for SSE connections
3. **Server validates the token** and establishes the SSE connection
4. **Tokens expire after 1 hour** requiring a new token request

## Authentication Flow

### 1. Obtain a Bearer Token

```bash
POST http://server:3456/auth/token
Content-Type: application/json

{
  "client_id": "1000.YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}
```

Response:
```json
{
  "access_token": "f6a6eb090ecf91b38a829893893f4ec592b70d62bf4e6d867cb80c53a5e06014",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 2. Connect to SSE with Bearer Token

```bash
GET http://server:3456/sse
Authorization: Bearer f6a6eb090ecf91b38a829893893f4ec592b70d62bf4e6d867cb80c53a5e06014
```

## Client Configuration

### Option 1: Automatic Token Management (Recommended)

Configure your `.mcp.json` to handle token management automatically:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://server:3456/sse",
      "oauth": {
        "token_endpoint": "http://server:3456/auth/token",
        "client_id": "1000.YOUR_CLIENT_ID",
        "client_secret": "YOUR_CLIENT_SECRET",
        "grant_type": "client_credentials"
      }
    }
  }
}
```

### Option 2: Manual Token Management

If your client doesn't support OAuth, you can manually obtain and use tokens:

1. Get a token using curl:
```bash
TOKEN=$(curl -s -X POST http://server:3456/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "1000.YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }' | jq -r .access_token)
```

2. Use the token in your client configuration:
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://server:3456/sse",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## OAuth Discovery Support

The server implements minimal OAuth discovery endpoints for client compatibility:

- `/.well-known/oauth-authorization-server` - Returns token endpoint information
- `/.well-known/oauth-protected-resource` - Identifies the SSE resource

These endpoints allow OAuth-aware clients like Claude Code to discover the authentication method automatically.

## Security Considerations

1. **Token Expiration**: Tokens expire after 1 hour to limit exposure
2. **HTTPS Required**: Always use HTTPS in production to protect tokens in transit
3. **No Token Refresh**: When a token expires, request a new one (no refresh tokens)
4. **Rate Limiting**: Token requests are rate-limited to prevent abuse

## Backwards Compatibility

The server maintains backwards compatibility with the legacy authentication method:
- Environment variables in `.mcp.json` continue to work
- The server automatically detects which authentication method is being used

## Troubleshooting

### Token Expired
```json
{
  "error": "Invalid or expired token",
  "message": "Please obtain a new token from /auth/token"
}
```
**Solution**: Request a new token from the `/auth/token` endpoint

### Missing Credentials
```json
{
  "error": "invalid_request",
  "error_description": "Missing client_id or client_secret"
}
```
**Solution**: Include both `client_id` and `client_secret` in your token request

### Connection Refused
If you see `ECONNREFUSED`, ensure:
- The server is running on the expected host and port
- Firewall rules allow connections on port 3456
- The server is listening on all interfaces (`0.0.0.0`) for remote access

## Example: Testing with curl

1. Get a token:
```bash
TOKEN=$(curl -s -X POST http://localhost:3456/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "1000.YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }' | jq -r .access_token)

echo "Token: $TOKEN"
```

2. Connect to SSE:
```bash
curl -N http://localhost:3456/sse \
  -H "Authorization: Bearer $TOKEN"
```

This will establish an SSE connection and stream MCP protocol messages.