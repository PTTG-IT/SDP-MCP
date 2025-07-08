# MCP SSE Server for Service Desk Plus

## Overview
This is a proper implementation of an MCP (Model Context Protocol) server using SSE (Server-Sent Events) transport, based on the official @modelcontextprotocol/sdk documentation.

## Key Features
- ✅ Uses official MCP SDK with SSEServerTransport
- ✅ Proper session management (required for SSE)
- ✅ Separate endpoints for SSE stream and messages
- ✅ Health check endpoint
- ✅ Graceful shutdown handling
- ✅ Mock tools for testing (can be replaced with real SDP API calls)

## Architecture
```
Client (Claude Desktop) <--SSE--> MCP Server <--API--> Service Desk Plus
```

The server provides:
- `/sse` - SSE stream endpoint for MCP protocol
- `/messages` - POST endpoint for client messages
- `/health` - Health check endpoint

## Quick Start

### 1. Start the Server
```bash
./start-mcp-server.sh
```

The server will:
- Install dependencies if needed
- Create a basic .env file if missing
- Start on port 3456 (configurable)

### 2. Configure Claude Desktop
Add to your `.mcp.json`:

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
```bash
# Check server health
curl http://studio:3456/health

# Should return:
# {"status":"ok","service":"sdp-mcp-server","transport":"sse","sessions":0}
```

## Available Tools
Currently provides mock implementations of:
- `list_requests` - List service requests
- `get_request` - Get request details
- `create_request` - Create new request

## Implementation Notes

### Why SSE?
- SSE allows server-to-client streaming
- Required for MCP protocol's bidirectional communication
- Maintains persistent connection for real-time updates

### Session Management
The server maintains sessions for each connected client:
- Each SSE connection gets a unique session ID
- Sessions are cleaned up on disconnect
- The `/messages` endpoint uses session ID to route messages

### Based on Official Examples
This implementation follows the patterns from:
- Official TypeScript SDK documentation
- MCP transport documentation
- Working examples from the MCP community

## Next Steps
1. Replace mock tool implementations with real Service Desk Plus API calls
2. Add authentication/authorization
3. Implement remaining SDP tools (problems, changes, etc.)
4. Add proper error handling and logging
5. Consider migrating to Streamable HTTP transport (newer standard)

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3456
lsof -i :3456

# Kill the process
kill -9 <PID>
```

### Connection Refused
- Check firewall settings
- Verify server is running: `ps aux | grep mcp-sse-server`
- Check logs for startup errors

### No Tools Available
- Restart Claude Desktop after updating .mcp.json
- Check server health endpoint
- Verify SSE connection in server logs