# OAuth Setup Guide for Service Desk Plus MCP Server

This guide walks through the one-time OAuth setup process for new users connecting to the Service Desk Plus MCP server.

## Understanding Zoho OAuth Refresh Tokens

**Important**: Zoho OAuth refresh tokens are **permanent and never expire**. This means:
- ✅ One-time setup only
- ✅ No need to re-authenticate ever
- ✅ Tokens work indefinitely (unless manually revoked)
- ✅ Automatic access token refresh handled by the server

## Setup Process for New Users

### Step 1: Create Self-Client Application

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Sign in with your Zoho account
3. Click "ADD CLIENT" → "Self Client"
4. Fill in the details:
   - **Client Name**: ServiceDeskPlus MCP Integration
   - **Homepage URL**: https://localhost:3000
   - **Redirect URI**: https://localhost:3000/callback
5. Click "CREATE"
6. Save your credentials:
   - **Client ID**: (looks like `1000.XXXXXXXXXXXXXXXXXXXXXXXXXX`)
   - **Client Secret**: (long alphanumeric string)

### Step 2: Generate Authorization Code

1. In the API Console, find your self-client
2. Click "Generate Code"
3. Enter the required scopes (copy this exactly):
   ```
   SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.solutions.ALL,SDPOnDemand.setup.READ,SDPOnDemand.general.ALL
   ```
4. Set **Time Duration**: 10 minutes
5. Enter **Scope Description**: Service Desk Plus MCP Full Access
6. Click "CREATE"
7. Copy the generated code immediately (it expires in 10 minutes)

### Step 3: Send Credentials to Administrator

Send the following to your MCP server administrator:
- Client ID
- Client Secret  
- Authorization Code (time-sensitive!)
- Your email/identifier

The administrator will exchange your code for a permanent refresh token and configure the server.

### Step 4: Configure Your MCP Client

Once the administrator confirms setup, configure your local MCP client:

**For Claude Desktop**: Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://SERVER_ADDRESS:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "your_client_id_here",
        "SDP_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

**For VS Code**: Add to your workspace `.mcp.json`

Replace `SERVER_ADDRESS` with the address provided by your administrator.

## For Administrators

### Converting Authorization Code to Refresh Token

Run this script on the MCP server:

```bash
cd /path/to/sdp-mcp-server
node scripts/exchange-code.js \
  --code "AUTHORIZATION_CODE" \
  --client-id "CLIENT_ID" \
  --client-secret "CLIENT_SECRET"
```

This will:
1. Exchange the code for access and refresh tokens
2. Display the refresh token
3. Optionally save it to the database

### Storing User Tokens

```bash
# Add a new user with their refresh token
node scripts/add-user.js \
  --client-id "CLIENT_ID" \
  --client-secret "CLIENT_SECRET" \
  --refresh-token "REFRESH_TOKEN" \
  --user-email "user@example.com"
```

### Testing User Authentication

```bash
# Verify user can authenticate
node scripts/test-user-auth.js --client-id "CLIENT_ID"
```

## OAuth Scope Reference

The following scopes provide full access to Service Desk Plus:

| Scope | Description |
|-------|-------------|
| `SDPOnDemand.requests.ALL` | Create, read, update, delete service requests |
| `SDPOnDemand.problems.ALL` | Manage problem records |
| `SDPOnDemand.changes.ALL` | Manage change requests |
| `SDPOnDemand.projects.ALL` | Access project management |
| `SDPOnDemand.assets.ALL` | Manage IT assets |
| `SDPOnDemand.solutions.ALL` | Access knowledge base |
| `SDPOnDemand.setup.READ` | Read configuration data |
| `SDPOnDemand.general.ALL` | General API access |

## Troubleshooting

### "Invalid authorization code"
- Code expired (only valid for 10 minutes)
- Code already used (can only be used once)
- Wrong data center selected

### "Invalid client credentials"
- Double-check Client ID and Secret
- Ensure no extra spaces or characters
- Verify self-client is active in API Console

### "Insufficient scope"
- Ensure all required scopes were included
- Some operations may need additional scopes
- Contact administrator to update scopes

## Security Best Practices

1. **Never share** your Client Secret
2. **Use HTTPS** for redirect URIs in production
3. **Revoke tokens** if compromised
4. **Monitor usage** in Zoho API Console
5. **Use unique** self-clients per integration

## Next Steps

After setup:
1. Test connection with your MCP client
2. Try basic commands to verify access
3. Report any issues to administrator
4. Start using Service Desk Plus tools!

Remember: This is a one-time setup. Your refresh token will work permanently!