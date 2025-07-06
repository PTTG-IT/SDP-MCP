# Claude Code MCP Server Setup

## Current Status
✅ MCP Server is running (PID: 37053)
- Version: V3 with full rate limiting
- Features: Rate limiting, monitoring, circuit breaker
- Status: Operational

## To Connect Claude Code to This MCP Server:

### 1. For Claude Desktop App
Create or update `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "node",
      "args": ["/Users/tenk/Claude-Vault/SDP-MCP/dist/indexV3.js"],
      "env": {
        "SDP_CLIENT_ID": "your_client_id",
        "SDP_CLIENT_SECRET": "your_client_secret",
        "SDP_INSTANCE_NAME": "your_instance",
        "SDP_AUTH_CODE": "your_auth_code",
        "SDP_USE_DB_TOKENS": "true",
        "SDP_USE_AUDIT_LOG": "true",
        "SDP_USE_CHANGE_TRACKING": "true"
      }
    }
  }
}
```

### 2. For Claude Code (VS Code Extension)
The MCP server should be detected automatically if:
1. The server is running on the standard stdio transport
2. The project has proper MCP configuration

### 3. Manual Connection
If automatic detection fails, you can:
1. Restart Claude/Claude Code
2. Check the MCP panel in Claude Code
3. Look for "service-desk-plus" in available servers

## Available MCP Tools

Once connected, you'll have access to these tools:
- `create_request` - Create service desk requests
- `get_request` - Get request details
- `update_request` - Update requests
- `search_requests` - Search requests
- `create_project` - Create projects
- `search_users` - Search users
- And 26 more tools...

## Troubleshooting

If the connection fails:
1. Check if the server is still running: `ps aux | grep indexV3`
2. Check logs: `tail -f mcp_server.log`
3. Verify environment variables are set
4. Ensure PostgreSQL is running on port 5433

## Server Features

The running V3 server includes:
- ✅ Rate limiting (1 token refresh/3 minutes)
- ✅ Circuit breaker protection
- ✅ Real-time monitoring
- ✅ Database persistence
- ✅ Audit logging