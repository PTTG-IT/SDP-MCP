# Multi-User Setup for Service Desk Plus MCP Server

This guide explains how to configure the Service Desk Plus MCP server to support multiple users with their own credentials.

## Overview

The MCP protocol currently has limitations in passing client-specific environment variables to the server. To work around this, we provide several deployment options:

## Option 1: Multiple Server Instances (Recommended)

Each user runs their own instance of the MCP server with their credentials.

### Setup Steps

1. **Create a user-specific configuration file**

   Copy `.env.example` to `.env.user1` (replace `user1` with actual username):
   ```bash
   cp .env.example .env.user1
   ```

2. **Edit the configuration with user's credentials**
   ```bash
   # .env.user1
   SDP_CLIENT_ID=user1_client_id_here
   SDP_CLIENT_SECRET=user1_client_secret_here
   SDP_INSTANCE_NAME=user1-instance
   SDP_BASE_URL=https://user1-portal.com
   SDP_REFRESH_TOKEN=user1_refresh_token_here
   
   # Unique port for this user
   SDP_HTTP_PORT=3456
   ```

3. **Start the server with user-specific config**
   ```bash
   # Load user-specific environment
   export $(cat .env.user1 | xargs)
   npm run start:sse
   ```

4. **Configure Claude Code**

   In Claude Code's settings or `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "sdp-user1": {
         "command": "bash",
         "args": ["-c", "export $(cat /path/to/.env.user1 | xargs) && node /path/to/dist/indexSSE.js"]
       }
     }
   }
   ```

## Option 2: Docker Containers per User

Use Docker to isolate each user's instance:

1. **Create a Docker Compose file** (`docker-compose.users.yml`):
   ```yaml
   version: '3.8'
   
   services:
     sdp-user1:
       build: .
       ports:
         - "3456:3456"
       env_file:
         - .env.user1
       volumes:
         - ./data/user1:/data
   
     sdp-user2:
       build: .
       ports:
         - "3457:3456"
       env_file:
         - .env.user2
       volumes:
         - ./data/user2:/data
   ```

2. **Start user containers**:
   ```bash
   docker-compose -f docker-compose.users.yml up -d sdp-user1
   ```

## Option 3: Systemd Services (Linux)

Create separate systemd services for each user:

1. **Create service file** (`/etc/systemd/system/sdp-mcp-user1.service`):
   ```ini
   [Unit]
   Description=SDP MCP Server for User1
   After=network.target
   
   [Service]
   Type=simple
   User=sdpservice
   WorkingDirectory=/opt/sdp-mcp
   EnvironmentFile=/opt/sdp-mcp/.env.user1
   ExecStart=/usr/bin/node /opt/sdp-mcp/dist/indexSSE.js
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   ```

2. **Enable and start service**:
   ```bash
   sudo systemctl enable sdp-mcp-user1
   sudo systemctl start sdp-mcp-user1
   ```

## Option 4: Process Manager (PM2)

Use PM2 to manage multiple instances:

1. **Create PM2 ecosystem file** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [
       {
         name: 'sdp-mcp-user1',
         script: './dist/indexSSE.js',
         env_file: './.env.user1',
         instances: 1,
         autorestart: true
       },
       {
         name: 'sdp-mcp-user2',
         script: './dist/indexSSE.js',
         env_file: './.env.user2',
         instances: 1,
         autorestart: true
       }
     ]
   };
   ```

2. **Start with PM2**:
   ```bash
   pm2 start ecosystem.config.js
   ```

## Security Considerations

1. **API Keys**: Each instance should have its own API key for authentication
2. **Port Isolation**: Use different ports for each user's instance
3. **File Permissions**: Ensure .env files are readable only by the service user
4. **Network Security**: Use firewall rules to restrict access to each port

## Monitoring Multiple Instances

### Check instance status:
```bash
# Systemd
sudo systemctl status sdp-mcp-*

# Docker
docker ps | grep sdp-

# PM2
pm2 list
```

### View logs:
```bash
# Systemd
sudo journalctl -u sdp-mcp-user1 -f

# Docker
docker logs -f sdp-user1

# PM2
pm2 logs sdp-mcp-user1
```

## Best Practices

1. **Resource Limits**: Set memory and CPU limits per instance
2. **Log Rotation**: Configure log rotation to prevent disk space issues
3. **Health Checks**: Set up monitoring for each instance
4. **Backup**: Regularly backup user configurations

## Troubleshooting

### Port Already in Use
If you get a port conflict error, ensure each user has a unique port in their `.env` file.

### Authentication Failures
Check that each user's credentials are correctly set in their environment file.

### Resource Exhaustion
Monitor system resources and adjust limits if running many instances.

## Future Improvements

We're working on a native multi-user solution that will:
- Support dynamic credential passing from Claude Code
- Use a single server instance with session isolation
- Provide better resource utilization

For now, the multiple instance approach provides the best isolation and security for multi-user deployments.