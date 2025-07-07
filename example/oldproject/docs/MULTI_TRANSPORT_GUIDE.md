# Service Desk Plus MCP Server - Multi-Transport Guide

## Overview

The Service Desk Plus MCP Server V4 supports both local and remote connections simultaneously through multiple transport protocols:

- **Stdio Transport**: For local connections (Claude Desktop, CLI tools)
- **SSE/HTTP Transport**: For remote connections (web apps, remote clients)

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Transport Mode
SDP_TRANSPORT_MODE=multi  # Options: stdio, sse, multi

# HTTP/SSE Configuration (for remote access)
SDP_HTTP_PORT=3456
SDP_HTTP_HOST=127.0.0.1  # Use 0.0.0.0 for external access
SDP_API_KEYS=your-api-key-1,your-api-key-2
SDP_ALLOWED_IPS=*  # Use specific IPs for production
SDP_ENABLE_CORS=true
SDP_CORS_ORIGIN=*  # Specify allowed origins for production
```

### Transport Modes

1. **stdio** - Local connections only (default V3 behavior)
2. **sse** - Remote connections only (no stdio)
3. **multi** - Both local and remote connections

## Running the Server

```bash
# Build the project
npm run build

# Start V4 server with multi-transport
npm run start:v4
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3456/health
```

### SSE Connection (for MCP clients)
```bash
# Connect with API key
curl -H "X-API-Key: your-api-key" \
     -H "Accept: text/event-stream" \
     http://localhost:3456/sse
```

### Session Information
```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3456/sessions
```

### Rate Limit Status
```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3456/rate-limit-status
```

## Security

### API Keys
- Generate strong, random API keys (32+ characters)
- Store API keys in environment variables
- Never commit API keys to version control

### Network Security
- Use `SDP_HTTP_HOST=127.0.0.1` for local-only access
- Configure `SDP_ALLOWED_IPS` with specific IP ranges
- Use HTTPS with a reverse proxy for production

### Example Nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name sdp-mcp.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Client Examples

### JavaScript/TypeScript Client
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(
  new URL('http://localhost:3456/sse'),
  {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  }
);

const client = new Client({
  name: 'my-app',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools);

// Call a tool
const result = await client.callTool('create_request', {
  subject: 'Test request',
  description: 'Created via remote connection'
});
```

### Python Client
```python
# Example using httpx for SSE
import httpx
import json

headers = {'X-API-Key': 'your-api-key'}

# Connect to SSE endpoint
with httpx.stream('GET', 'http://localhost:3456/sse', headers=headers) as response:
    for line in response.iter_lines():
        if line.startswith('data: '):
            data = json.loads(line[6:])
            print('Received:', data)
```

## Monitoring

The V4 server provides detailed monitoring of connections:

- Transport statistics logged every 30 seconds
- Rate limit status logged every minute
- Connection/disconnection events logged in real-time

## Troubleshooting

### Port Already in Use
If you see "EADDRINUSE" error, another service is using the port. Change `SDP_HTTP_PORT` to a different value.

### Authentication Failures
- Ensure API key is included in `SDP_API_KEYS`
- Check IP is allowed in `SDP_ALLOWED_IPS`
- Verify headers are correctly set

### CORS Issues
- Set `SDP_ENABLE_CORS=true`
- Configure `SDP_CORS_ORIGIN` with your client's origin
- For development, use `SDP_CORS_ORIGIN=*`

### Connection Drops
- Sessions timeout after 30 minutes of inactivity
- Implement reconnection logic in clients
- Monitor `/health` endpoint for server status

## Migration from V3

1. Update `.env` with transport configuration
2. Switch from `start:v3` to `start:v4`
3. Local Claude connections continue working unchanged
4. Add remote clients using SSE transport

## Performance Considerations

- Each SSE connection maintains an open socket
- Default session timeout: 30 minutes
- Rate limiting applies across all transports
- Database connection pooling shared between transports

## Production Checklist

- [ ] Use strong, unique API keys
- [ ] Configure specific IP allowlist
- [ ] Set up HTTPS with reverse proxy
- [ ] Configure specific CORS origins
- [ ] Enable monitoring and logging
- [ ] Set up health check monitoring
- [ ] Configure session timeout appropriately
- [ ] Test failover and reconnection