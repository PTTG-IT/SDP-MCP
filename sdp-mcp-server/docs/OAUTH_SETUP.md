# Service Desk Plus OAuth Setup Guide

This guide walks you through setting up OAuth authentication for the SDP MCP Server.

## Prerequisites

1. Service Desk Plus Cloud account with API access
2. Self-client application created in the Zoho Developer Console
3. Node.js 20+ installed
4. PostgreSQL and Redis running (via Docker Compose)

## Step 1: Create Self-Client Application

1. Go to your data center's Zoho Developer Console:
   - US: https://api-console.zoho.com/
   - EU: https://api-console.zoho.eu/
   - IN: https://api-console.zoho.in/
   - AU: https://api-console.zoho.com.au/
   - JP: https://api-console.zoho.jp/
   - UK: https://api-console.zoho.uk/
   - CA: https://api-console.zohocloud.ca/
   - CN: https://api-console.zoho.com.cn/

2. Navigate to **Self Client** section
3. Click **CREATE NOW**
4. Note down:
   - Client ID
   - Client Secret

## Step 2: Configure Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your OAuth configuration:
   ```env
   # Service Desk Plus OAuth Configuration
   SDP_PORTAL_NAME=your-portal-name
   SDP_DATA_CENTER=US  # Your data center
   SDP_OAUTH_CLIENT_ID=your-client-id
   SDP_OAUTH_CLIENT_SECRET=your-client-secret
   SDP_OAUTH_REDIRECT_URI=https://localhost:3000/callback
   SDP_TENANT_ID=default
   ```

3. Generate encryption key:
   ```bash
   openssl rand -hex 32
   ```
   Add to `ENCRYPTION_KEY` in `.env`

## Step 3: Generate Authorization Code

⚠️ **IMPORTANT**: Authorization codes expire in 10 minutes!

1. In Zoho Developer Console, go to your self-client
2. Click **Generate Code** tab
3. Enter the required scopes:
   ```
   SDPOnDemand.requests.READ
   SDPOnDemand.requests.CREATE
   SDPOnDemand.requests.UPDATE
   SDPOnDemand.requests.DELETE
   SDPOnDemand.problems.READ
   SDPOnDemand.problems.CREATE
   SDPOnDemand.problems.UPDATE
   SDPOnDemand.problems.DELETE
   SDPOnDemand.changes.READ
   SDPOnDemand.changes.CREATE
   SDPOnDemand.changes.UPDATE
   SDPOnDemand.changes.DELETE
   SDPOnDemand.changes.APPROVE
   SDPOnDemand.projects.READ
   SDPOnDemand.projects.CREATE
   SDPOnDemand.projects.UPDATE
   SDPOnDemand.projects.DELETE
   SDPOnDemand.assets.READ
   SDPOnDemand.assets.CREATE
   SDPOnDemand.assets.UPDATE
   SDPOnDemand.assets.DELETE
   ```

4. Set **Time Duration**: 10 minutes
5. Add **Description**: "MCP Server Initial Setup"
6. Click **CREATE**
7. Copy the generated code immediately

## Step 4: Exchange Code for Tokens

Run the setup script with your authorization code:

```bash
npm run setup:oauth <authorization-code>
```

Example:
```bash
npm run setup:oauth 1000.abcd1234efgh5678ijkl9012mnop3456
```

This will:
- Exchange the code for access and refresh tokens
- Save encrypted tokens to the database
- Create a backup in `.tokens.json`

## Step 5: Verify Connection

Test that everything is working:

```bash
npm run test:oauth
```

You should see:
- ✅ API Connection Successful
- Sample request data
- Token expiry information

## Step 6: Start the MCP Server

```bash
# Build the project
npm run build

# Run database migrations
npm run db:migrate

# Start the server
npm start
```

## Troubleshooting

### "Invalid Code" Error
- The authorization code has expired (10-minute limit)
- Generate a new code and try again immediately

### "Authentication Failed" (401)
- Token has expired
- Run `setup:oauth` with a new authorization code

### Connection Timeout
- Check your data center setting in `.env`
- Verify network connectivity to Service Desk Plus

### Missing Scopes Error
- Ensure you included all required scopes when generating the code
- Some operations may require additional scopes

## Token Management

The MCP server automatically:
- Refreshes tokens before they expire
- Stores tokens encrypted in the database
- Maintains per-tenant token isolation
- Logs all token refresh operations

## Security Best Practices

1. **Never commit** `.env` or `.tokens.json` to version control
2. **Rotate** encryption keys periodically
3. **Use** strong passwords for database and Redis
4. **Monitor** token refresh failures in logs
5. **Implement** IP whitelisting for production

## Next Steps

After successful OAuth setup:

1. Configure your MCP client to connect to `http://localhost:3000/mcp`
2. Test MCP tools using the documentation tool:
   ```
   get_tool_documentation
   ```
3. Monitor server health:
   ```
   check_system_health
   ```

## Support

For issues with:
- OAuth setup: Check Service Desk Plus API documentation
- MCP server: Review logs in `logs/sdp-mcp.log`
- Token refresh: Check audit logs in the database