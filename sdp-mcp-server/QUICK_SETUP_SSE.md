# Quick Setup Guide - SDP MCP SSE Server

This guide will help you quickly set up and connect to the Service Desk Plus MCP server using SSE transport.

## Prerequisites

- Node.js 20+ installed
- Your Service Desk Plus OAuth credentials ready
- Access to the server from your client machine

## Step 1: Setup Environment

1. Navigate to the server directory:
```bash
cd /Users/kalten/projects/SDP-MCP/sdp-mcp-server
```

2. Copy the environment file and edit it:
```bash
cp .env.example .env
```

3. Edit `.env` and add your credentials:
```env
# Required OAuth Configuration
SDP_BASE_URL=https://helpdesk.pttg.com
SDP_INSTANCE_NAME=itdesk
SDP_OAUTH_CLIENT_ID=your-client-id-here
SDP_OAUTH_CLIENT_SECRET=your-client-secret-here
SDP_OAUTH_REFRESH_TOKEN=your-permanent-refresh-token-here

# Server Configuration
SDP_HTTP_PORT=3456
SDP_HTTP_HOST=0.0.0.0

# Optional
SDP_DATA_CENTER=US
LOG_LEVEL=info
```

## Step 2: Install Dependencies & Build

```bash
# Install dependencies
npm install

# Build the TypeScript files
npm run build
```

## Step 3: Start the Server

```bash
# Using the start script
./start-sse-simple.sh

# OR using npm directly
npm run start:sse
```

You should see:
```
🚀 SDP MCP Server (SSE) running at http://0.0.0.0:3456
📡 SSE endpoint: http://0.0.0.0:3456/sse
🏥 Health check: http://0.0.0.0:3456/health
```

## Step 4: Test the Server

From any machine that can reach the server:
```bash
curl http://studio:3456/health
# or
curl http://192.168.2.10:3456/health
```

Should return:
```json
{
  "status": "ok",
  "service": "sdp-mcp-server",
  "version": "1.0.0",
  "environment": "development"
}
```

## Step 5: Configure Claude Desktop

On your client machine, update your Claude Desktop config:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://studio:3456/sse",
        "--allow-http"
      ]
    }
  }
}
```

You can use any of these server addresses:
- `http://studio:3456/sse`
- `http://studio.pttg.loc:3456/sse`
- `http://192.168.2.10:3456/sse`
- `http://10.212.0.7:3456/sse`

## Step 6: Restart Claude Desktop

1. Completely quit Claude Desktop
2. Start Claude Desktop again
3. Look for "service-desk-plus" in the tools menu (🔧 icon)

## Available Tools

Once connected, you'll have access to these tools:

- **list_requests** - List service desk requests
- **get_request** - Get details of a specific request
- **create_request** - Create a new request
- **update_request** - Update an existing request
- **close_request** - Close a request with resolution

And similar tools for problems, changes, projects, and assets.

## Troubleshooting

### Server won't start
- Check that port 3456 is not in use: `lsof -i :3456`
- Verify all required environment variables are set
- Check logs for specific error messages

### Can't connect from client
- Verify server is accessible: `telnet studio 3456`
- Check firewall rules
- Try using IP address instead of hostname

### OAuth errors
- Verify your refresh token is valid
- Check that client ID and secret match your self-client setup
- Ensure the data center setting is correct (US, EU, IN, etc.)

## Need Help?

Check the server logs for detailed error messages. The server will log:
- All API requests and responses
- OAuth token refresh events
- Connection events
- Any errors with full stack traces