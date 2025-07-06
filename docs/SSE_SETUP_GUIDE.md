# Service Desk Plus MCP - SSE-Only Setup Guide

This guide covers the setup and configuration of the Service Desk Plus MCP server using Server-Sent Events (SSE) transport exclusively.

## Overview

The SSE-only implementation provides a production-ready HTTP/SSE server for the Service Desk Plus Model Context Protocol (MCP) integration. This setup is ideal for:

- Server deployments where the MCP server runs continuously
- Remote access scenarios
- Production environments requiring API key authentication
- Multi-user environments with session management

## Prerequisites

1. **Node.js 18+** installed
2. **Service Desk Plus Cloud** account with API access
3. **Self Client OAuth credentials** from Service Desk Plus
4. **PostgreSQL** (optional but recommended for token persistence)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd service-desk-plus-mcp
npm install
npm run build
```

### 2. Configure Environment

Copy the SSE example configuration:

```bash
cp .env.sse.example .env
```

Edit `.env` with your credentials:

```env
# Required: Service Desk Plus API Configuration
SDP_CLIENT_ID=your_client_id_here
SDP_CLIENT_SECRET=your_client_secret_here
SDP_INSTANCE_NAME=your-instance
SDP_BASE_URL=https://your-portal-domain.com
SDP_REFRESH_TOKEN=your_refresh_token_here

# Required: Default Technician (for operations like closing tickets)
SDP_DEFAULT_TECHNICIAN_EMAIL=your-technician@example.com

# Required: API Keys (generate secure keys)
SDP_API_KEYS=your-secure-api-key-32-chars-minimum

# Optional: Customize server settings
SDP_HTTP_PORT=3456
SDP_HTTP_HOST=127.0.0.1
```

### 3. Start the Server

```bash
npm run start:sse
```

You should see:
```
✨ Service Desk Plus MCP Server (SSE) Ready
📍 Endpoint: http://127.0.0.1:3456/sse
🔑 API Keys: 1 configured
```

### 4. Configure Claude Desktop

Update `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3456/sse",
        "headers": {
          "X-API-Key": "your-secure-api-key-32-chars-minimum"
        }
      }
    }
  }
}
```

Restart Claude Desktop to apply changes.

## Configuration Details

### API Keys

Generate secure API keys (minimum 32 characters):

```bash
# Generate a secure API key
openssl rand -hex 32
```

Configure multiple API keys by comma-separating them:
```env
SDP_API_KEYS=key1,key2,key3
```

### Default Technician Email

The `SDP_DEFAULT_TECHNICIAN_EMAIL` is used when:
- Closing tickets without specifying a technician
- Assigning tickets without specifying a technician
- Any operation requiring technician context

Example usage in Claude:
- "Close ticket 12345 as resolved" - Uses default technician
- "Assign ticket 12345 to me" - Uses default technician

### Security Configuration

#### IP Allowlist
```env
# Allow all IPs (development)
SDP_ALLOWED_IPS=*

# Restrict to specific IPs (production)
SDP_ALLOWED_IPS=192.168.1.100,10.0.0.0/8

# Multiple CIDR ranges
SDP_ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8,172.16.0.1
```

#### CORS Settings
```env
# Development
SDP_ENABLE_CORS=true
SDP_CORS_ORIGIN=*

# Production (specific origins)
SDP_CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

#### Rate Limiting
```env
# Per API key rate limit (requests per minute)
SDP_RATE_LIMIT_PER_KEY=60

# Maximum concurrent connections
SDP_MAX_CONNECTIONS=100

# Session timeout (milliseconds)
SDP_SESSION_TIMEOUT=1800000  # 30 minutes
```

## Database Setup (Recommended)

For production deployments, enable PostgreSQL for:
- Persistent OAuth token storage
- API audit logging
- Change tracking for rollback capability

### 1. Start PostgreSQL with Docker

```bash
docker-compose up -d
```

### 2. Enable Database Features

```env
# Database connection
SDP_DB_HOST=localhost
SDP_DB_PORT=5433
SDP_DB_NAME=sdp_mcp
SDP_DB_USER=sdpmcpservice
SDP_DB_PASSWORD=your_secure_password_here

# Enable features
SDP_USE_DB_TOKENS=true
SDP_USE_AUDIT_LOG=true
SDP_USE_CHANGE_TRACKING=true
```

### 3. Verify Database Connection

```bash
node scripts/test-db.js
```

## Monitoring & Health Checks

### Health Endpoint
```bash
curl http://localhost:3456/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-05T22:00:00.000Z",
  "uptime": 3600,
  "connections": {
    "active": 2,
    "max": 100
  },
  "memory": {...},
  "rateLimitSystem": "active"
}
```

### Metrics Endpoint
Enable metrics in configuration:
```env
SDP_ENABLE_METRICS=true
```

Access metrics (requires API key):
```bash
curl -H "X-API-Key: your-api-key" http://localhost:3456/metrics
```

### Session Information
```bash
curl -H "X-API-Key: your-api-key" http://localhost:3456/sessions
```

## Production Deployment

### 1. Use HTTPS with Reverse Proxy

Example Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name sdp-mcp.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Process Management

Use PM2 for production:

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/indexSSE.js --name sdp-mcp-sse

# Save PM2 configuration
pm2 save
pm2 startup
```

### 3. Environment Variables

Use a `.env.production` file:
```bash
npm run start:sse -- --env-file=.env.production
```

### 4. Logging

Enable structured logging:
```bash
# Redirect logs
npm run start:sse > /var/log/sdp-mcp/app.log 2>&1

# Or with PM2
pm2 start dist/indexSSE.js --name sdp-mcp-sse --log /var/log/sdp-mcp/app.log
```

## Testing

### Test SSE Connection
```bash
node test-sse-complete.js
```

### Test with curl
```bash
# Connect to SSE endpoint
curl -N -H "X-API-Key: your-api-key" http://localhost:3456/sse

# In another terminal, check sessions
curl -H "X-API-Key: your-api-key" http://localhost:3456/sessions
```

## Troubleshooting

### Common Issues

1. **"No refresh token available"**
   - Ensure `SDP_REFRESH_TOKEN` is set in `.env`
   - Check that the token hasn't expired

2. **"API key required"**
   - Ensure Claude configuration includes the X-API-Key header
   - Verify API key matches one in `SDP_API_KEYS`

3. **"Session not found"**
   - The SSE connection may have timed out
   - Check `SDP_SESSION_TIMEOUT` setting
   - Restart Claude Desktop to create new connection

4. **Rate limit errors**
   - Token refresh is limited to 1 every 3 minutes
   - Check circuit breaker status in logs
   - Wait for cooldown period

### Debug Mode

Enable detailed logging:
```env
NODE_ENV=development
SDP_ENABLE_MONITORING=true
```

Check logs for:
- Token refresh attempts
- Rate limit status
- Circuit breaker state
- API request/response details

## API Rate Limits

The system enforces several rate limits:

1. **OAuth Token Refresh**: Maximum 1 refresh every 3 minutes
2. **OAuth Token Requests**: Maximum 10 per 10-minute window
3. **API Requests**: 60 per minute (configurable)
4. **Per API Key**: Configurable via `SDP_RATE_LIMIT_PER_KEY`

## Security Best Practices

1. **Generate strong API keys** (32+ characters)
2. **Use specific IP allowlists** in production
3. **Enable HTTPS** with reverse proxy
4. **Set appropriate CORS origins**
5. **Use database for audit logging**
6. **Monitor rate limit violations**
7. **Rotate API keys regularly**
8. **Keep default technician email secure**

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test database connectivity if enabled
4. Ensure Service Desk Plus API credentials are valid
5. Check rate limit status using monitoring endpoints