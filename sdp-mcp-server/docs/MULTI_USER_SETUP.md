# Multi-User Remote Access Setup Guide

This guide explains how to set up and connect to the Service Desk Plus MCP server from remote computers.

## Overview

The Service Desk Plus MCP server is designed as a **multi-user, remote-access system** that allows multiple computers to connect and use Service Desk Plus API tools through the Model Context Protocol (MCP).

### Key Features:
- ✅ **Permanent Authentication**: One-time OAuth setup per user - refresh tokens never expire
- ✅ **Multi-Client Support**: Multiple users can connect simultaneously
- ✅ **Secure Token Storage**: Each user's OAuth tokens are encrypted and stored separately
- ✅ **Automatic Token Refresh**: Access tokens are refreshed automatically when needed
- ✅ **Custom Domain Support**: Works with both standard and custom Service Desk Plus domains

## Prerequisites

### For Remote Users:
1. **Service Desk Plus OAuth Credentials** (Self-Client Application):
   - Client ID
   - Client Secret
   - These are obtained from your Service Desk Plus admin or Zoho API Console

2. **Network Access** to the MCP server on port 3456

3. **MCP-compatible Client** (e.g., Claude Desktop, VS Code with MCP extension)

## Initial Setup Process (One-Time Only)

### Step 1: Obtain OAuth Refresh Token

Since Zoho OAuth refresh tokens are **permanent and never expire**, you only need to do this once:

1. **Contact your administrator** or follow these steps if you have access:
   
2. **Create a Self-Client Application** in Zoho API Console:
   - Go to https://api-console.zoho.com/
   - Create a new Self Client
   - Note your Client ID and Client Secret

3. **Generate Authorization Code**:
   - Use the OAuth URL with these scopes:
   ```
   SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.solutions.ALL,SDPOnDemand.setup.READ,SDPOnDemand.general.ALL
   ```

4. **Exchange Code for Refresh Token**:
   - The administrator will run a script to exchange your authorization code for tokens
   - You'll receive a refresh token that **never expires**

### Step 2: Configure Your MCP Client

Create or update your `.mcp.json` file:

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

Replace `SERVER_ADDRESS` with one of:
- `studio` (if on local network)
- `studio.pttg.loc` (if DNS is configured)
- `192.168.2.10` (direct IP access)
- `10.212.0.7` (alternate network)

### Step 3: Test Connection

Your MCP client should now connect to the server. The server will:
1. Receive your credentials
2. Use your stored refresh token to get an access token
3. Provide you with all available Service Desk Plus tools

## Available Tools

Once connected, you'll have access to tools for:
- Creating, updating, and closing service requests
- Managing problems and changes
- Working with projects and assets
- Accessing knowledge base solutions
- And more based on your OAuth scopes

## Important Notes

### Token Lifecycle:
- **Refresh Token**: Permanent (never expires)
- **Access Token**: 1 hour lifetime (automatically refreshed)
- **No Re-authentication**: Once set up, you never need to authenticate again

### Security:
- All tokens are encrypted at rest
- Each user's tokens are isolated
- Audit logging tracks all API operations
- Rate limiting prevents abuse

### Troubleshooting:

1. **Connection Refused**:
   - Verify server is running
   - Check firewall allows port 3456
   - Confirm correct server address

2. **Authentication Failed**:
   - Verify Client ID and Secret are correct
   - Ensure refresh token is properly stored on server
   - Check with administrator

3. **API Errors**:
   - Verify your OAuth scopes include necessary permissions
   - Check Service Desk Plus instance is accessible

## Administrator Reference

For administrators setting up new users:

1. **Collect User Information**:
   - User's Client ID and Secret
   - Authorization code or refresh token

2. **Store Refresh Token**:
   ```bash
   # Run on server
   node scripts/add-user-token.js \
     --client-id "USER_CLIENT_ID" \
     --refresh-token "USER_REFRESH_TOKEN"
   ```

3. **Verify Setup**:
   ```bash
   # Test user's credentials
   node scripts/test-user-auth.js --client-id "USER_CLIENT_ID"
   ```

## Benefits of This Architecture

1. **One-Time Setup**: Users authenticate once and never again
2. **Centralized Management**: All tokens managed on server
3. **Automatic Refresh**: No manual token management needed
4. **Multi-User**: Supports unlimited concurrent users
5. **Audit Trail**: All operations logged for compliance

## Next Steps

After setup, you can:
- Use any MCP-compatible client to connect
- Access all Service Desk Plus features through natural language
- Create automation workflows
- Build custom integrations

For more details, see:
- [API Reference](./API_REFERENCE.md)
- [Available Tools](./MCP_TOOLS.md)
- [Security Guide](./SECURITY.md)