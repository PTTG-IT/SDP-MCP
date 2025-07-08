# Quick Start Guide - Service Desk Plus MCP Server

Get connected to the Service Desk Plus MCP server in under 10 minutes!

## Prerequisites

- Service Desk Plus OAuth credentials (Client ID & Secret)
- Access to the MCP server (network connectivity on port 3456)
- MCP-compatible client (Claude Desktop, VS Code, etc.)

## For Remote Users - Quick Connection

### Step 1: Get Your Credentials
1. Create a Self-Client at [Zoho API Console](https://api-console.zoho.com/)
2. Save your Client ID and Secret
3. Generate authorization code with ALL scopes (see below)

### Step 2: Send to Administrator
Send these to your MCP administrator:
- Client ID
- Client Secret
- Authorization Code (expires in 10 minutes!)

### Step 3: Configure Your Client
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://studio:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "your_client_id",
        "SDP_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### Step 4: Connect!
Restart your MCP client and start using Service Desk Plus tools.

## Important: OAuth Token Information

**Zoho OAuth refresh tokens are PERMANENT and never expire!** This means:
- ✅ One-time setup only
- ✅ No re-authentication needed
- ✅ Tokens work forever (unless manually revoked)
- ✅ Access tokens (1-hour) are refreshed automatically

## For Administrators - Setup Process

### 1. OAuth Setup (One-Time Per User)

When a user sends you their authorization code:

```bash
# Exchange authorization code for permanent refresh token
node scripts/exchange-code.js

# The script will:
# 1. Exchange the code for tokens
# 2. Display the refresh token
# 3. Save it to .env file
```

### 2. Test API Connection

```bash
# Test with custom domain configuration
node scripts/test-api-custom-domain.js
```

You should see:
- ✅ Connection to custom domain successful
- ✅ OAuth token obtained from Zoho
- ✅ API requests working

### 3. Required OAuth Scopes

When generating authorization codes, use these scopes:
```
SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.solutions.ALL,SDPOnDemand.setup.READ,SDPOnDemand.general.ALL
```

### 4. Server Endpoints

The MCP server listens on multiple addresses:
- `studio` - Primary hostname
- `studio.pttg.loc` - FQDN
- `192.168.2.10` - LAN IP
- `10.212.0.7` - Secondary IP
- `localhost` / `127.0.0.1` - Local only

## Environment Configuration

### Critical Settings for Custom Domain

```env
# Service Desk Plus Configuration
SDP_BASE_URL=https://helpdesk.pttg.com
SDP_INSTANCE_NAME=itdesk
SDP_PORTAL_NAME=kaltentech
SDP_DATA_CENTER=US

# OAuth Configuration (from Zoho)
SDP_OAUTH_CLIENT_ID=your_client_id
SDP_OAUTH_CLIENT_SECRET=your_client_secret
SDP_OAUTH_REFRESH_TOKEN=your_permanent_refresh_token

# Server Configuration
SDP_HTTP_HOST=0.0.0.0
SDP_HTTP_PORT=3456
```

## Available MCP Tools

Once connected, these tools are available:

### Request Management
- `list_requests` - Get service requests
- `create_request` - Create new request
- `update_request` - Update existing request
- `close_request` - Close a request
- `get_request` - Get request details

### Problem Management
- `list_problems` - Get problem records
- `create_problem` - Create new problem
- `update_problem` - Update problem
- `get_problem` - Get problem details

### Change Management
- `list_changes` - Get change requests
- `create_change` - Create new change
- `update_change` - Update change
- `get_change` - Get change details

### And more for Projects, Assets, Solutions...

## Troubleshooting

### API Returns "UNAUTHORISED"
- Verify custom domain is correct
- Check instance name matches
- Ensure OAuth token has required scopes

### "Invalid refresh token"
- Token may have been revoked
- Generate new authorization code
- Exchange for new refresh token

### Connection Issues
- Verify server is running on port 3456
- Check firewall allows connection
- Test with curl: `curl http://studio:3456/health`

## Quick Test Commands

After setup, try these in your MCP client:

1. **List recent requests**:
   "Show me the last 5 service requests"

2. **Create a request**:
   "Create a service request for laptop replacement"

3. **Check permissions**:
   "What SDP tools are available?"

## Support

- **Setup Guide**: [MULTI_USER_SETUP.md](./docs/MULTI_USER_SETUP.md)
- **OAuth Details**: [OAUTH_SETUP_GUIDE.md](./docs/OAUTH_SETUP_GUIDE.md)
- **Admin Contact**: Your MCP server administrator

Remember: Once set up, you'll never need to authenticate again! 🎉