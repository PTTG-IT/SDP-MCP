# Claude Desktop SSE Transport Setup

## Overview

This guide explains how to configure Claude Desktop to connect to the Service Desk Plus MCP server using SSE (Server-Sent Events) transport for remote connections.

## Prerequisites

1. Service Desk Plus MCP Server V4 built and ready
2. Multi-transport mode enabled in the server
3. Valid API key configured

## Setup Steps

### 1. Start the Server in Multi-Transport Mode

```bash
# Option 1: Use the convenience script
./start-multi-transport.sh

# Option 2: Set environment variable and run
export SDP_TRANSPORT_MODE=multi
npm run start:v4

# Option 3: Update .env file
# Set SDP_TRANSPORT_MODE=multi in .env
npm run start:v4
```

### 2. Verify Server is Running

```bash
# Check health endpoint
curl http://localhost:3456/health

# Should return:
# {"status":"ok","transport":"sse","sessions":0,"uptime":...}
```

### 3. Claude Configuration

The configuration has been added to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      // Local stdio connection (existing)
    },
    "service-desk-plus-remote": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3456/sse",
        "headers": {
          "X-API-Key": "test-key-123456789"
        }
      }
    }
  }
}
```

### 4. Restart Claude Desktop

After updating the configuration, restart Claude Desktop to pick up the new SSE transport configuration.

## Configuration Options

### API Keys

Update the API key in the configuration to match one configured in your `.env` file:

```env
SDP_API_KEYS=your-secure-api-key-here
```

Then update Claude config:
```json
"headers": {
  "X-API-Key": "your-secure-api-key-here"
}
```

### Remote Access

To allow remote connections from other machines:

1. Update `.env`:
```env
SDP_HTTP_HOST=0.0.0.0  # Listen on all interfaces
SDP_ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8  # Specify allowed networks
```

2. Update Claude config with the server's IP:
```json
"url": "http://192.168.1.100:3456/sse"
```

## Troubleshooting

### Connection Refused

1. Verify server is running: `lsof -i :3456`
2. Check firewall settings
3. Ensure correct API key is used

### Authentication Failed

1. Verify API key matches one in `SDP_API_KEYS`
2. Check IP is allowed in `SDP_ALLOWED_IPS`
3. Look at server logs for specific error

### Tools Not Available

1. Ensure server started successfully
2. Check for any startup errors
3. Verify database connection if using token persistence

## Security Notes

- Always use strong API keys in production
- Restrict `SDP_HTTP_HOST` to specific interfaces
- Use `SDP_ALLOWED_IPS` to limit access
- Consider using HTTPS with a reverse proxy for production

## Testing the Connection

Once configured, you should see two MCP connections in Claude:

1. `service-desk-plus` - Local stdio connection
2. `service-desk-plus-remote` - SSE remote connection

Both provide access to the same tools but use different transport mechanisms.

## Advanced Configuration

### Using Different Ports

If port 3456 is in use:

1. Update `.env`:
```env
SDP_HTTP_PORT=8080
```

2. Update Claude config:
```json
"url": "http://localhost:8080/sse"
```

### Multiple API Keys

Configure multiple API keys for different clients:

```env
SDP_API_KEYS=claude-key-123,webapp-key-456,cli-key-789
```

### CORS Configuration

For browser-based clients:

```env
SDP_ENABLE_CORS=true
SDP_CORS_ORIGIN=https://yourapp.com,http://localhost:3000
```