# Remote MCP Setup with mcp-remote

## Overview
`mcp-remote` is an npm package that acts as a bridge between Claude Desktop (which only supports stdio) and remote MCP servers (using SSE/HTTP).

## Setup Instructions

### 1. On the Server (studio)
First, make sure the SSE server is running:

```bash
cd /Users/kalten/projects/SDP-MCP
./start-mcp-server.sh
```

The server should be running on port 3456. Verify with:
```bash
curl http://localhost:3456/health
```

### 2. On the Remote PC (Claude Desktop)

#### Step 1: Install Node.js
Make sure Node.js is installed. Test with:
```bash
node --version
npm --version
```

#### Step 2: Configure Claude Desktop
Find your Claude Desktop config file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://studio:3456/sse"
      ],
      "env": {
        "SDP_CLIENT_ID": "1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU",
        "SDP_CLIENT_SECRET": "5752f7060c587171f81b21d58c5b8d0019587ca999"
      }
    }
  }
}
```

**Important**: Replace `studio` with the appropriate address:
- `studio` - if hostname is in hosts file or DNS
- `studio.pttg.loc` - if using FQDN
- `192.168.2.10` - if using IP address
- `10.212.0.7` - if on different network

#### Step 3: Test Connection
1. Close Claude Desktop completely
2. Open Claude Desktop
3. Look for the MCP tools icon (should appear if connection successful)
4. Try a simple command like "list service desk requests"

## Troubleshooting

### "Cannot find module mcp-remote"
When you first use `npx mcp-remote`, it will download the package. Make sure you have internet access.

### "Connection refused"
1. Check server is running: `curl http://studio:3456/health`
2. Check firewall allows port 3456
3. Try using IP address instead of hostname

### "No tools available"
1. Check Claude Desktop logs
2. Verify the server shows the SSE connection in its logs
3. Try restarting Claude Desktop

### Network Issues
If `studio` hostname doesn't resolve:
1. Add to hosts file:
   - Mac/Linux: `/etc/hosts`
   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   ```
   192.168.2.10  studio
   ```
2. Or use IP address directly in the config

## How It Works

```
Claude Desktop --stdio--> npx mcp-remote --HTTP/SSE--> MCP Server (studio:3456)
```

1. Claude Desktop starts `mcp-remote` as a subprocess
2. `mcp-remote` connects to the remote SSE server
3. It translates between stdio (used by Claude) and SSE (used by server)
4. Your tools are now available in Claude Desktop!

## Alternative URLs
If the main address doesn't work, try these in the config:
- `http://studio.pttg.loc:3456/sse`
- `http://192.168.2.10:3456/sse`
- `http://10.212.0.7:3456/sse`

## Logs
To see what's happening:
1. Server logs: Check the terminal where you ran `./start-mcp-server.sh`
2. Claude Desktop logs: 
   - Mac: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\logs\`