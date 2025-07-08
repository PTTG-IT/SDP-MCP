# Service Desk Plus SSE Server Implementation

This document describes the working SSE (Server-Sent Events) implementation for the Service Desk Plus MCP server.

## Overview

The SSE implementation provides a lightweight, single-tenant MCP server that exposes Service Desk Plus functionality through the Model Context Protocol. This approach was chosen after discovering that the SDK's SSEServerTransport has compatibility issues and implementing the MCP protocol directly over raw SSE provides better reliability.

## Architecture

### Key Components

1. **Express Server with SSE**
   - Runs on port 3456
   - Provides `/sse` endpoint for MCP communication
   - Implements health check at `/health`
   - Handles CORS for cross-origin requests

2. **Direct MCP Protocol Implementation**
   - Does NOT use `@modelcontextprotocol/sdk` SSEServerTransport
   - Implements JSON-RPC 2.0 protocol directly
   - Handles MCP handshake (initialize, tools/list, tools/call)
   - Manages session state per connection

3. **SDP API Client V2**
   - Handles OAuth token management with automatic refresh
   - Supports custom domain configuration
   - Implements all Service Desk Plus API operations
   - Uses proper IDs for priorities, statuses, and categories

## Implementation Details

### Server Entry Point (`working-sse-server.cjs`)

The server is implemented as a CommonJS module to avoid ES module conflicts:

```javascript
const express = require('express');
const cors = require('cors');
const { SDPAPIClientV2 } = require('./sdp-api-client-v2.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// SSE endpoint
app.get('/sse', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Create session
  const sessionId = `session-${Date.now()}-${Math.random()}`;
  
  // Handle MCP messages
  const processMessage = async (message) => {
    const { method, params, id } = message;
    let result, error;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'service-desk-plus', version: '2.0.0' }
        };
        break;
        
      case 'tools/list':
        result = { tools: getToolDefinitions() };
        break;
        
      case 'tools/call':
        result = await executeToolCall(params);
        break;
    }
    
    return { result, error, id };
  };
});
```

### MCP Protocol Flow

1. **Client Connection**
   - Client connects to `/sse` endpoint
   - Server creates new session
   - Sends keep-alive pings every 30 seconds

2. **Initialize Handshake**
   ```json
   {
     "jsonrpc": "2.0",
     "method": "initialize",
     "params": {
       "protocolVersion": "2024-11-05",
       "capabilities": {},
       "clientInfo": { "name": "claude-code", "version": "1.0.0" }
     },
     "id": 1
   }
   ```

3. **Tools Discovery**
   - Client requests available tools
   - Server returns tool definitions with schemas

4. **Tool Execution**
   - Client calls specific tool with parameters
   - Server executes SDP API call
   - Returns results in MCP format

### Available Tools

1. **list_requests** - List service desk requests with filters
2. **get_request** - Get detailed request information
3. **search_requests** - Search requests by keyword
4. **create_request** - Create new service desk request
5. **update_request** - Update existing request
6. **close_request** - Close request with resolution
7. **add_note** - Add note/comment to request
8. **get_metadata** - Get valid values for fields

## Configuration

### Environment Variables

```bash
# Service Desk Plus Configuration
SDP_BASE_URL=https://helpdesk.pttg.com   # Custom domain
SDP_INSTANCE_NAME=itdesk                 # Instance name
SDP_PORTAL_NAME=kaltentech               # Portal name
SDP_DATA_CENTER=US                       # Data center

# OAuth Configuration
SDP_OAUTH_CLIENT_ID=your_client_id
SDP_OAUTH_CLIENT_SECRET=your_client_secret
SDP_OAUTH_REFRESH_TOKEN=your_permanent_refresh_token

# Server Configuration  
SDP_HTTP_HOST=0.0.0.0                    # Listen on all interfaces
SDP_HTTP_PORT=3456                       # Server port
```

### Client Configuration

For Claude Code or other MCP clients:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "npx",
      "args": ["mcp-remote", "http://192.168.2.10:3456/sse", "--allow-http"]
    }
  }
}
```

## File Structure

```
sdp-mcp-server/
├── src/
│   ├── working-sse-server.cjs       # Main SSE server
│   ├── sdp-api-client-v2.cjs       # SDP API client
│   ├── sdp-oauth-client.cjs        # OAuth handler
│   └── sdp-api-metadata.cjs        # Metadata client
├── .env                             # Environment configuration
├── start-sse-server.sh             # Startup script
└── SSE_SERVER_READY.md             # Status documentation
```

## Key Differences from SDK Approach

1. **No SSEServerTransport**: The SDK's SSEServerTransport expects different response object format than Express provides
2. **Direct Protocol Implementation**: Implements JSON-RPC 2.0 and MCP protocol directly
3. **CommonJS Modules**: Uses .cjs extension to avoid ES module conflicts
4. **Session Management**: Maintains session state for each SSE connection
5. **Error Handling**: Comprehensive error handling with proper MCP error responses

## Starting the Server

```bash
# Navigate to project directory
cd /Users/kalten/projects/SDP-MCP/sdp-mcp-server

# Start server
./start-sse-server.sh

# Or run in background
node src/working-sse-server.cjs > server.log 2>&1 &
```

## Monitoring

- Health check: `curl http://localhost:3456/health`
- View logs: `tail -f server.log`
- Check process: `ps aux | grep working-sse-server`

## Security Considerations

1. **CORS**: Currently allows all origins for development
2. **Authentication**: OAuth tokens stored in environment variables
3. **HTTPS**: Should use HTTPS in production (currently HTTP for local dev)
4. **Token Security**: Refresh tokens are permanent - store securely

## Future Enhancements

1. **Multi-Tenant Support**: When MCP protocol better supports it
2. **WebSocket Transport**: Alternative to SSE for bidirectional communication
3. **Rate Limiting**: Per-client rate limiting
4. **Metrics**: Prometheus metrics for monitoring
5. **Database Integration**: Store tokens and audit logs

## Troubleshooting

### Common Issues

1. **Module Not Found Errors**
   - Ensure all files use .cjs extension
   - Check require paths match .cjs filenames

2. **Connection Timeouts**
   - Verify firewall allows port 3456
   - Check server is listening on correct interface

3. **OAuth Errors**
   - Verify environment variables are set
   - Check refresh token is valid
   - Ensure custom domain configuration is correct

### Debug Mode

Set `DEBUG=true` in environment to enable verbose logging:
```bash
DEBUG=true node src/working-sse-server.cjs
```

## References

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Service Desk Plus API](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)
- [SSE Standard](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)