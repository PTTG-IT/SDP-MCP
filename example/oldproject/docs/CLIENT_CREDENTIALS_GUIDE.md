# Client Credentials Configuration Guide

## Overview

The Service Desk Plus MCP server supports two modes of operation:

1. **Single-User Mode** (Server-side credentials)
2. **Multi-User Mode** (Client-side credentials) - **RECOMMENDED**

## Current Limitation

Due to MCP SDK limitations, the SSE transport cannot pass environment variables from the client to the server. This means each user needs to either:

1. Run their own instance of the server with their credentials
2. Use a shared server with shared credentials

## Recommended Setup: Personal Server Instance

### Option 1: Local Development Setup

For local development, configure your credentials in a `.env.local` file:

```bash
# Copy the example
cp .env.sse.example .env.local

# Edit with your credentials
SDP_CLIENT_ID=your_client_id
SDP_CLIENT_SECRET=your_client_secret
SDP_INSTANCE_NAME=your-instance
SDP_BASE_URL=https://your-instance.sdpondemand.manageengine.com
SDP_REFRESH_TOKEN=your_refresh_token
SDP_DEFAULT_TECHNICIAN_EMAIL=your-email@example.com

# Server settings
SDP_HTTP_PORT=3456
SDP_API_KEYS=generate-a-secure-key-here
```

Then start your personal instance:

```bash
# Load your credentials and start
env $(cat .env.local | xargs) npm run start:sse
```

### Option 2: Docker Container (Recommended for Production)

Create a personal container with your credentials:

```dockerfile
FROM node:18-slim
WORKDIR /app
COPY . .
RUN npm ci --production
ENV NODE_ENV=production
CMD ["node", "dist/indexSSE.js"]
```

Run with your credentials:

```bash
docker run -d \
  -p 3456:3456 \
  -e SDP_CLIENT_ID=your_client_id \
  -e SDP_CLIENT_SECRET=your_client_secret \
  -e SDP_INSTANCE_NAME=your-instance \
  -e SDP_BASE_URL=https://your-instance.sdpondemand.manageengine.com \
  -e SDP_REFRESH_TOKEN=your_refresh_token \
  -e SDP_DEFAULT_TECHNICIAN_EMAIL=your-email@example.com \
  -e SDP_API_KEYS=your-secure-api-key \
  --name my-sdp-mcp \
  sdp-mcp-server
```

### Option 3: Systemd Service

Create a user service file:

```ini
[Unit]
Description=My Service Desk Plus MCP Server
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=/home/%i/service-desk-plus-mcp
EnvironmentFile=/home/%i/.sdp-mcp-env
ExecStart=/usr/bin/node dist/indexSSE.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## Security Best Practices

1. **Never share your credentials** - Each user should have their own SDP API credentials
2. **Use strong API keys** - Generate unique API keys for your MCP server instance
3. **Restrict access** - Use IP allowlists if running on a network
4. **Use HTTPS** - Put the server behind a reverse proxy with SSL
5. **Rotate credentials regularly** - Update your refresh token periodically

## Future Enhancement

We're working on implementing a credential provider system that would allow:
- Secure credential storage per session
- OAuth flow for each user
- Dynamic client creation based on user identity

For now, the recommended approach is to run your own instance with your credentials.

## Troubleshooting

### "Authentication failed" errors

1. Verify your credentials are correct:
   ```bash
   # Test your environment variables
   echo $SDP_CLIENT_ID
   echo $SDP_INSTANCE_NAME
   ```

2. Check if your refresh token is still valid

3. Ensure your Service Desk Plus instance URL is correct

### Multiple users on same machine

Each user should run on a different port:

```bash
# User 1
SDP_HTTP_PORT=3456 npm run start:sse

# User 2  
SDP_HTTP_PORT=3457 npm run start:sse
```

Then configure different Claude Code workspaces to connect to different ports.