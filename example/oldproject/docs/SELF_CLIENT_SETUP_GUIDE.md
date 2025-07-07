# Self Client Setup Guide for ServiceDesk Plus Cloud

This guide explains how to set up OAuth Self Client authentication for ServiceDesk Plus Cloud MCP server.

## Overview

With Self Client authentication, each user:
1. Creates their own OAuth app in Zoho API Console
2. Generates their own refresh token
3. Configures their `.mcp.json` with their credentials
4. Connects directly to the MCP server

## Step-by-Step Setup

### Step 1: Create a Self Client in Zoho API Console

1. Go to **Zoho API Console**: https://api-console.zoho.com/
   - For EU: https://api-console.zoho.eu/
   - For IN: https://api-console.zoho.in/
   - For AU: https://api-console.zoho.com.au/

2. Click **"Add Client"**

3. Choose **"Self Client"** and click **"Create"**

4. Click **"OK"** on the confirmation popup

### Step 2: Get Your Client Credentials

1. Click on your **Self Client** in the API Console

2. Go to the **"Client Secret"** tab

3. Copy and save:
   - **Client ID** (looks like: `1000.XXXXXXXXXXXXXXXXXXXXXXXXXX`)
   - **Client Secret** (long alphanumeric string)

### Step 3: Generate Authorization Code

1. In your Self Client, go to **"Generate Code"** tab

2. Enter the following:
   - **Scope**: `SDPOnDemand.requests.ALL,SDPOnDemand.users.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.tasks.ALL,SDPOnDemand.setup.READ`
   - **Time Duration**: 10 minutes (maximum)
   - **Scope Description**: "MCP Server Full Access"

3. Click **"Create"**

4. **IMMEDIATELY copy the authorization code** from the popup

### Step 4: Generate Your Refresh Token

**Important**: You must do this within 1 minute of generating the code!

#### On Mac/Linux:
```bash
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

#### On Windows (PowerShell):
```powershell
$body = @{
    grant_type = "authorization_code"
    code = "YOUR_AUTH_CODE"
    client_id = "YOUR_CLIENT_ID"
    client_secret = "YOUR_CLIENT_SECRET"
}

Invoke-RestMethod -Uri "https://accounts.zoho.com/oauth/v2/token" -Method Post -Body $body
```

#### Expected Response:
```json
{
  "access_token": "1000.xxxx.yyyy",
  "refresh_token": "1000.aaaa.bbbb",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Save the `refresh_token`** - you'll need it for your configuration!

### Step 5: Configure Your .mcp.json

Create or update your `.mcp.json` file:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://your-server:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "1000.YOUR_CLIENT_ID_HERE",
        "SDP_CLIENT_SECRET": "YOUR_CLIENT_SECRET_HERE",
        "SDP_REFRESH_TOKEN": "1000.YOUR_REFRESH_TOKEN_HERE",
        "SDP_BASE_URL": "https://sdpondemand.manageengine.com",
        "SDP_INSTANCE_NAME": "yourcompany"
      }
    }
  }
}
```

Replace:
- `your-server` with the MCP server address
- `YOUR_CLIENT_ID_HERE` with your Client ID from Step 2
- `YOUR_CLIENT_SECRET_HERE` with your Client Secret from Step 2
- `YOUR_REFRESH_TOKEN_HERE` with your refresh token from Step 4
- `yourcompany` with your ServiceDesk Plus instance name

### Step 6: Find Your Instance Details

Your instance name is the subdomain of your ServiceDesk Plus URL:
- If your URL is `https://acme.sdpondemand.com`, then instance name is `acme`
- If your URL is `https://mycompany.servicedeskplus.eu`, then instance name is `mycompany`

Base URL by region:
- US: `https://sdpondemand.manageengine.com`
- EU: `https://servicedeskplus.eu`
- IN: `https://servicedeskplus.in`
- AU: `https://servicedeskplus.com.au`

## File Locations

### Claude Desktop
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Claude Code
- Place `.mcp.json` in your project root directory

## Testing Your Connection

After configuring, restart Claude and look for "Service Desk Plus" in the MCP tools. You should see tools like:
- `create_request`
- `list_requests`
- `search_requests`
- etc.

## Troubleshooting

### "Invalid refresh token" error
- Your refresh token may have been revoked
- Generate a new authorization code and refresh token

### "Authentication failed" error
- Double-check your Client ID and Client Secret
- Ensure you're using the correct base URL for your region
- Verify your instance name is correct

### Connection timeout
- Check if the MCP server is running
- Verify the server URL and port
- Check firewall settings

## Security Notes

1. **Keep your credentials secure** - Never share or commit them to version control
2. **Refresh tokens don't expire** but can be revoked manually
3. **Each user should have their own Self Client** for security and auditing
4. **Use HTTPS in production** for the MCP server connection

## Optional: Without Refresh Token

If you don't want to store the refresh token in your config, you can provide just the Client ID and Secret, but you'll need to:

1. Generate a new authorization code each time
2. Or implement an OAuth flow in the MCP server

Currently, the MCP server requires a refresh token for Self Client authentication.

## Need Help?

- Check ServiceDesk Plus API docs: https://www.manageengine.com/products/service-desk/sdpod-v3-api/
- Zoho OAuth documentation: https://www.zoho.com/accounts/protocol/oauth.html
- MCP server logs for authentication errors