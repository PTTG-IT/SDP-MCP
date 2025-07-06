# Service Desk Plus MCP - SSE Production Deployment Guide

## Overview

This guide covers deploying the Service Desk Plus MCP server in production using SSE-only transport. The SSE-only configuration provides a simpler, more secure, and production-ready deployment suitable for both local and remote access.

## Why SSE-Only?

1. **Simplified Architecture** - No multi-transport complexity
2. **Enhanced Security** - Built-in authentication and IP filtering
3. **Production Features** - Connection limits, rate limiting, monitoring
4. **Remote Access** - Accessible from any MCP-compatible client
5. **Better Resource Management** - Per-connection tracking and limits

## Quick Start

```bash
# 1. Clone and setup
git clone <repository>
cd SDP-MCP

# 2. Configure environment
cp .env.sse.example .env
# Edit .env with your credentials

# 3. Build and start
npm install
npm run build
./start-sse.sh
```

## Configuration

### Required Settings

```env
# Service Desk Plus OAuth
SDP_CLIENT_ID=your_client_id_here
SDP_CLIENT_SECRET=your_client_secret_here
SDP_INSTANCE_NAME=your_instance_name_here

# API Keys (generate with: openssl rand -hex 32)
SDP_API_KEYS=secure-key-1,secure-key-2

# Server binding
SDP_HTTP_PORT=3000
SDP_HTTP_HOST=127.0.0.1  # Use 0.0.0.0 for external access
```

### Security Configuration

```env
# IP Allowlist (supports CIDR)
SDP_ALLOWED_IPS=127.0.0.1,192.168.1.0/24,10.0.0.0/8

# Connection Limits
SSE_MAX_CONNECTIONS_PER_IP=10
SSE_MAX_TOTAL_CONNECTIONS=1000

# Rate Limiting
SSE_RATE_LIMIT_PER_MIN=60
```

### Production Settings

```env
# Timeouts
SSE_SESSION_TIMEOUT=1800000      # 30 minutes
SSE_KEEPALIVE_INTERVAL=30000     # 30 seconds

# Database (optional but recommended)
SDP_USE_DB_TOKENS=true
SDP_DB_HOST=localhost
SDP_DB_PORT=5433
SDP_DB_NAME=sdp_mcp
```

## Deployment Options

### Option 1: Direct Deployment

```bash
# Start with PM2 (recommended)
pm2 start dist/indexSSE.js --name sdp-mcp-sse

# Or with systemd service
sudo cp sdp-mcp-sse.service /etc/systemd/system/
sudo systemctl enable sdp-mcp-sse
sudo systemctl start sdp-mcp-sse
```

### Option 2: Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/indexSSE.js"]
```

### Option 3: Behind Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name sdp-mcp.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /sse {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        
        # SSE specific
        proxy_set_header Content-Type text/event-stream;
        proxy_read_timeout 86400;
        
        # Security headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /messages {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Rate limiting
        limit_req zone=api burst=10 nodelay;
    }
}
```

## Client Configuration

### Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3000/sse",
        "headers": {
          "X-API-Key": "your-api-key-here"
        }
      }
    }
  }
}
```

### Remote Access

For remote clients, update the URL:

```json
{
  "transport": {
    "type": "sse",
    "url": "https://sdp-mcp.yourdomain.com/sse",
    "headers": {
      "X-API-Key": "client-specific-api-key"
    }
  }
}
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "transport": "sse",
  "uptime": 3600,
  "totalConnections": 5,
  "connectionsByIP": {
    "192.168.1.100": 2,
    "10.0.0.50": 3
  }
}
```

### Session Management

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/sessions
```

### Rate Limit Status

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/rate-limit-status
```

## Security Best Practices

### 1. API Key Management

- Generate strong API keys: `openssl rand -hex 32`
- Use different keys for different clients
- Rotate keys regularly
- Store keys securely (environment variables, secrets manager)

### 2. Network Security

- Bind to localhost by default
- Use IP allowlists for production
- Deploy behind a reverse proxy with SSL
- Enable firewall rules

### 3. Rate Limiting

The server implements multiple layers of rate limiting:

- Per-connection rate limits (60 req/min default)
- Per-IP connection limits (10 connections default)
- Global connection limit (1000 default)
- Service Desk Plus API rate limits

### 4. Session Security

- Sessions timeout after 30 minutes of inactivity
- Keep-alive prevents connection drops
- Each session tracked individually
- Automatic cleanup of stale sessions

## Troubleshooting

### Connection Issues

```bash
# Check if server is running
lsof -i :3000

# Check logs
pm2 logs sdp-mcp-sse

# Test connection
curl -v -H "X-API-Key: test-key" http://localhost:3000/sse
```

### Common Problems

1. **"API key required"** - Add X-API-Key header
2. **"IP not allowed"** - Update SDP_ALLOWED_IPS
3. **"Connection limit exceeded"** - Increase limits or check for leaks
4. **"Rate limit exceeded"** - Implement client-side throttling

### Debug Mode

Enable verbose logging:

```env
LOG_LEVEL=debug
SDP_DEBUG_REQUESTS=true
```

## Performance Tuning

### Connection Pooling

```env
# Adjust based on your needs
SSE_MAX_CONNECTIONS_PER_IP=20
SSE_MAX_TOTAL_CONNECTIONS=5000
```

### Database Optimization

```sql
-- Add indexes for better performance
CREATE INDEX idx_oauth_tokens_client_id ON oauth_tokens(client_id);
CREATE INDEX idx_api_audit_log_timestamp ON api_audit_log(timestamp);
```

### Node.js Optimization

```bash
# Increase memory limit
node --max-old-space-size=4096 dist/indexSSE.js

# Enable cluster mode with PM2
pm2 start dist/indexSSE.js -i max
```

## Backup and Recovery

### Database Backup

```bash
# Backup database
pg_dump -h localhost -p 5433 -U sdpmcpservice sdp_mcp > backup.sql

# Restore database
psql -h localhost -p 5433 -U sdpmcpservice sdp_mcp < backup.sql
```

### Configuration Backup

```bash
# Backup configuration
tar -czf sdp-mcp-config.tar.gz .env *.json

# Restore configuration
tar -xzf sdp-mcp-config.tar.gz
```

## Migration from Multi-Transport

1. Stop the old server
2. Update .env configuration
3. Remove old transport settings
4. Start SSE-only server
5. Update all clients to use SSE transport

## Conclusion

The SSE-only deployment provides a production-ready, secure, and scalable solution for Service Desk Plus MCP integration. With proper configuration and monitoring, it can handle thousands of concurrent connections while maintaining security and performance.