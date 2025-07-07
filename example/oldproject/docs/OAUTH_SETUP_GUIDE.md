# Service Desk Plus MCP Server - OAuth Setup Guide

This guide explains how to set up OAuth authentication for the Service Desk Plus MCP Server in Self-Client mode.

## Overview

In Self-Client mode, each user provides their own Client ID and Client Secret in their `.mcp.json` configuration. The server handles all OAuth token management, including secure storage and automatic refresh.

## Prerequisites

1. Service Desk Plus Cloud account
2. Access to Zoho Developer Console
3. MCP Server running with database configured

## Step 1: Create a Self Client Application

1. Navigate to your data center's Zoho Developer Console:
   - US: https://api-console.zoho.com/
   - EU: https://api-console.zoho.eu/
   - IN: https://api-console.zoho.in/
   - AU: https://api-console.zoho.com.au/
   - JP: https://api-console.zoho.jp/
   - CA: https://api-console.zohocloud.ca/
   - UK: https://api-console.zoho.uk/
   - SA: https://api-console.zoho.sa/
   - CN: https://api-console.zoho.com.cn/

2. Click "Add Client"

3. Choose "Server Based Applications"

4. Fill in the details:
   - **Client Name**: Your application name (e.g., "SDP MCP Server")
   - **Homepage URL**: Your server URL (e.g., `http://localhost:3456`)
   - **Authorized Redirect URIs**: Add `http://localhost:3456/oauth/callback`

5. Click "Create"

6. Save your **Client ID** and **Client Secret** - you'll need these later

## Step 2: Configure MCP Client

Add the Service Desk Plus server to your MCP client configuration (`.mcp.json`):

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://localhost:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "SDP_CLIENT_SECRET": "YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"
      }
    }
  }
}
```

Replace the values with your actual Client ID and Client Secret from Step 1.

## Step 3: Initial OAuth Authorization

### Option A: Using the check_auth_status Tool

1. Start your MCP client with the Service Desk Plus server configured

2. Run the `check_auth_status` tool:
   ```
   check_auth_status
   ```

3. If you need to authorize, you'll receive instructions with an authorization URL

### Option B: Using the HTTP Endpoint

1. Check if your client needs setup:
   ```bash
   curl -X POST http://localhost:3456/oauth/initialize \
     -H "Content-Type: application/json" \
     -d '{"clientId": "YOUR_CLIENT_ID"}'
   ```

2. If authorization is needed, you'll receive a response with the authorization URL

### Complete the Authorization

1. Visit the authorization URL provided
2. Log in with your Zoho account
3. Review and accept the requested permissions (scopes)
4. You'll be redirected to the callback URL
5. Copy the authorization code from the URL (after `code=`)

## Step 4: Submit the Authorization Code

Submit the authorization code to complete setup:

```bash
curl -X POST http://localhost:3456/oauth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "authCode": "AUTHORIZATION_CODE_FROM_URL"
  }'
```

## Step 5: Verify Setup

Run the `check_auth_status` tool to verify your authentication is working:

```
check_auth_status
```

You should see:
- `authenticated: true`
- `hasTokens: true`
- `needsReauth: false`

## OAuth Scopes

The server requests the following scopes by default:
- `SDPOnDemand.requests.ALL` - Full access to service requests
- `SDPOnDemand.projects.ALL` - Full access to projects
- `SDPOnDemand.tasks.ALL` - Full access to tasks
- `SDPOnDemand.problems.ALL` - Full access to problems
- `SDPOnDemand.changes.ALL` - Full access to changes
- `SDPOnDemand.assets.ALL` - Full access to assets
- `SDPOnDemand.users.READ` - Read access to users
- `SDPOnDemand.setup.READ` - Read access to setup data

You can customize these scopes by setting the `SDP_OAUTH_SCOPES` environment variable.

## Troubleshooting

### "No OAuth tokens found for this client"
- You need to complete the initial authorization (Steps 3-4)

### "OAuth re-authorization required"
- Your refresh token has expired or been revoked
- Complete the authorization process again (Steps 3-4)

### "Authentication circuit breaker is open"
- Too many authentication failures occurred
- Wait 5 minutes for the circuit breaker to reset
- Or re-authorize if the issue persists

### "Token refresh failed"
- Check your internet connection
- Verify your Client Secret is correct
- Ensure your Zoho account has access to Service Desk Plus

## Security Notes

1. **Never share your Client Secret** - Keep it secure and never commit it to version control
2. **Use HTTPS in production** - The example uses HTTP for localhost only
3. **Tokens are encrypted** - The server encrypts all tokens before storing in the database
4. **Automatic refresh** - The server automatically refreshes tokens before they expire

## Advanced Configuration

### Custom Redirect URI

Set a custom redirect URI with:
```bash
export SDP_OAUTH_REDIRECT_URI=https://your-domain.com/oauth/callback
```

### Custom Scopes

Limit the requested scopes with:
```bash
export SDP_OAUTH_SCOPES="SDPOnDemand.requests.READ,SDPOnDemand.requests.CREATE"
```

### Data Center Configuration

The server automatically detects your data center from the `SDP_BASE_URL`. Ensure this is set correctly for your region.

## Admin Operations

### List Authorized Clients

```bash
curl http://localhost:3456/oauth/clients
```

### Reset Circuit Breaker

If a client's circuit breaker is stuck open, an admin can reset it programmatically through the database or by re-authorizing.

## Rate Limiting

Service Desk Plus enforces rate limits on OAuth operations:
- Maximum 10 token refreshes per 10 minutes
- Maximum 5 refresh tokens per minute

The server automatically handles these limits with:
- Token caching (5-minute TTL)
- Early refresh (5 minutes before expiry)
- Circuit breaker pattern for failure handling

## Next Steps

After successful setup:
1. Start using the MCP tools to interact with Service Desk Plus
2. Monitor authentication status with `check_auth_status`
3. The server will handle all token management automatically

For more information, see the [API Reference](./API_REFERENCE.md) and [MCP Tools Documentation](./MCP_TOOLS.md).