# SSE Server Setup for Service Desk Plus MCP

## The Problem
The existing `oldproject` uses **stdio** transport which requires the MCP server to run as a subprocess of Claude Desktop. This doesn't work for remote access scenarios where multiple clients need to connect to a central server.

## The Solution
We've created an SSE (Server-Sent Events) HTTP server that:
1. Wraps the existing oldproject functionality
2. Provides HTTP endpoints for remote access
3. Maintains compatibility with all existing tools

## Quick Start

### 1. Start the SSE Server (on your server machine)

```bash
cd /Users/kalten/projects/SDP-MCP/example
./start-sse-server.sh
```

The server will start on port 3456 and be accessible from:
- `http://studio:3456/sse`
- `http://studio.pttg.loc:3456/sse`
- `http://192.168.2.10:3456/sse`
- `http://10.212.0.7:3456/sse`

### 2. Configure Claude Desktop (on remote PC)

Create or update your `.mcp.json` file:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://studio:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "your-oauth-client-id",
        "SDP_CLIENT_SECRET": "your-oauth-client-secret"
      }
    }
  }
}
```

### 3. Test the Connection

1. Check server health:
   ```bash
   curl http://studio:3456/health
   ```

2. Restart Claude Desktop
3. The Service Desk Plus tools should now be available

## How It Works

1. **index-sse.js** - A JavaScript wrapper that:
   - Creates an Express HTTP server
   - Implements SSE transport for MCP
   - Loads tools from the oldproject (if built)
   - Falls back to dummy tools if not built

2. **SSE Transport** - Provides:
   - HTTP endpoint at `/sse` for MCP connections
   - Keep-alive messages to maintain connection
   - Proper SSE headers for streaming

3. **Tool Integration** - Uses:
   - Existing tools from `oldproject/src/mcp/tools.js`
   - Existing handlers from `oldproject/src/mcp/handlers.js`
   - Falls back gracefully if not compiled

## Building for Full Functionality

To use all Service Desk Plus tools:

```bash
cd oldproject
npm install
npm run build
cd ..
./start-sse-server.sh
```

## Troubleshooting

### "Cannot connect to server"
- Check firewall allows port 3456
- Verify server is running: `ps aux | grep index-sse`
- Test with curl: `curl http://studio:3456/health`

### "Tools not found"
- Build the oldproject first
- Check logs for module loading errors

### "Authentication failed"
- Verify OAuth credentials in .mcp.json
- Check tokens in .env file
- Regenerate OAuth tokens if needed

## Architecture Notes

- **stdio (old)**: MCP server runs as subprocess, limited to local use
- **SSE (new)**: MCP server runs as HTTP service, allows remote access
- Both use the same underlying tools and API client
- SSE adds HTTP layer for network accessibility

## Next Steps

1. Build the oldproject for full tool access
2. Set up OAuth tokens for each client
3. Configure firewall/network for remote access
4. Monitor logs at startup for any issues