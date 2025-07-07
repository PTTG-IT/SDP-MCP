# Multi-User Remote Access Setup for Service Desk Plus MCP Server

This guide explains how to set up the Service Desk Plus MCP server to support multiple remote users connecting from different computers.

## 🌐 Architecture Overview

The Service Desk Plus MCP server is designed as a **centralized multi-user application**:

- **Single Server Instance**: One MCP server runs on a central host
- **Multiple Remote Clients**: Users connect from different computers over the network
- **SSE Transport**: Uses Server-Sent Events for real-time connections
- **Simple Authentication**: No OAuth between client and server - just pass credentials via environment variables
- **Per-User Zoho Credentials**: Each user provides their own Zoho OAuth credentials
- **Shared Database**: PostgreSQL stores tokens and tracks usage for all users

### Authentication Flow

1. **Client → Server**: Simple credential passing via `.mcp.json` environment variables (no OAuth)
2. **Server → Service Desk Plus**: Full OAuth 2.0 with automatic token management

## 🚀 Server Setup (One-Time Setup)

### 1. Install and Configure the Server

```bash
# Clone the repository
git clone <repository-url>
cd service-desk-plus-cloud-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your Service Desk Plus instance details:

```env
# Service Desk Plus Configuration (same for all users)
SDP_BASE_URL=https://helpdesk.company.com
SDP_INSTANCE_NAME=companyinstance

# Database Configuration
SDP_DB_HOST=localhost
SDP_DB_PORT=5433
SDP_DB_NAME=sdp_mcp
SDP_DB_USER=sdpmcpservice
SDP_DB_PASSWORD=secure_password_here

# Server Configuration
SDP_HTTP_PORT=3456  # Port for SSE connections
SDP_HTTP_HOST=0.0.0.0  # Listen on all interfaces for remote access
```

### 3. Start the Database

```bash
# Start PostgreSQL container
docker-compose up -d

# Verify database is running
docker ps | grep sdp-mcp-postgres
```

### 4. Start the MCP Server

```bash
# Build the project
npm run build

# Start the self-client server
npm run start:self-client
```

The server will display:
```
✨ Service Desk Plus MCP Server Ready (Self Client Auth)
═══════════════════════════════════════════════════════════════
📍 Endpoint: http://0.0.0.0:3456/sse
🏢 Instance: companyinstance
🔐 Auth: Self Client (OAuth)
📊 Database: Connected
```

### 5. Configure Firewall (Important!)

Allow incoming connections on port 3456:

```bash
# Ubuntu/Debian
sudo ufw allow 3456/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3456/tcp
sudo firewall-cmd --reload
```

## 👥 Remote Client Setup (For Each User)

Each remote user needs to:

### 1. Get OAuth Credentials from Zoho

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Create a **Self Client** application
3. Generate Client ID and Client Secret
4. Note: Each user needs their own credentials

### 2. Configure Claude Code

Create or edit `.mcp.json` in your home directory:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://SERVER_IP:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "1000.YOUR_CLIENT_ID_HERE",
        "SDP_CLIENT_SECRET": "YOUR_CLIENT_SECRET_HERE"
      }
    }
  }
}
```

Replace:
- `SERVER_IP` with the IP address or hostname of the MCP server
- `YOUR_CLIENT_ID_HERE` with your Zoho Client ID
- `YOUR_CLIENT_SECRET_HERE` with your Zoho Client Secret

**Note**: Claude Code may attempt OAuth discovery requests (`.well-known/oauth-*` endpoints) which will return 404 errors. This is expected behavior - the server uses direct credential authentication instead of OAuth discovery.

### 3. First-Time Setup

On first connection, you'll need to authorize the OAuth app:

1. The server will provide instructions in the logs
2. Generate an authorization code with the required scopes
3. The server will store your refresh token securely

## 🔐 Security Considerations

### Network Security
- Use HTTPS with a reverse proxy for production
- Implement IP whitelisting if possible
- Consider VPN for sensitive environments

### Authentication Security
- Each user's tokens are encrypted in the database
- Tokens are isolated per Client ID
- Automatic token refresh with rate limit protection

### Example Nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name mcp.company.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /sse {
        proxy_pass http://localhost:3456/sse;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        
        # SSE specific headers
        proxy_set_header X-Accel-Buffering no;
        proxy_read_timeout 86400;
    }
}
```

## 📊 Monitoring and Management

### View Connected Users

```bash
# Check server logs
tail -f server-current.log

# View database connections
docker exec -it sdp-mcp-postgres psql -U sdpmcpservice -d sdp_mcp -c "SELECT client_id, last_refreshed_at FROM oauth_tokens;"
```

### Monitor Server Health

```bash
# Check if server is running
ps aux | grep indexSSESelfClient

# View server resource usage
htop  # or top

# Check database status
docker ps | grep postgres
```

## 🔧 Troubleshooting

### Connection Issues

1. **Client can't connect**: 
   - Verify firewall rules
   - Check server is listening on 0.0.0.0
   - Test with `curl http://SERVER_IP:3456/sse`

2. **Authentication failures**:
   - Verify Client ID and Secret are correct
   - Check server logs for detailed errors
   - Ensure OAuth app has required scopes

3. **Token refresh errors**:
   - Check rate limits (10 tokens per 10 minutes)
   - Verify database connectivity
   - Look for circuit breaker activation

### Common Commands

```bash
# Restart server
pkill -f indexSSESelfClient
npm run start:self-client

# View OAuth tokens
docker exec -it sdp-mcp-postgres psql -U sdpmcpservice -d sdp_mcp -c "SELECT * FROM oauth_tokens;"

# Clear expired tokens
docker exec -it sdp-mcp-postgres psql -U sdpmcpservice -d sdp_mcp -c "DELETE FROM oauth_access_tokens WHERE expires_at < NOW();"
```

## 🚀 Production Deployment

For production environments:

1. **Use a process manager**:
   ```bash
   # Install PM2
   npm install -g pm2
   
   # Start with PM2
   pm2 start dist/indexSSESelfClient.js --name sdp-mcp
   pm2 save
   pm2 startup
   ```

2. **Enable SSL/TLS** (see Nginx example above)

3. **Set up monitoring** (Prometheus, Grafana, etc.)

4. **Configure backups** for the PostgreSQL database

5. **Implement log rotation**

## 📚 Additional Resources

- [Self-Client Authentication Guide](./SELF_CLIENT_SETUP_GUIDE.md)
- [SSE Setup Guide](./SSE_SETUP_GUIDE.md)
- [OAuth Setup Guide](./OAUTH_SETUP_GUIDE.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)