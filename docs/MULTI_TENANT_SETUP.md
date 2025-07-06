# Multi-Tenant Setup Guide

## Overview

This guide explains how to configure the Service Desk Plus MCP server for multi-tenant use, where multiple users with different SDP credentials connect to a single server.

## Current Architecture Status

⚠️ **Important Note**: Due to limitations in the MCP SDK's SSE transport, full multi-tenant support with dynamic credentials is not currently possible. The SSE transport doesn't provide access to session context in tool handlers, preventing us from using session-specific SDP clients.

## Available Options

### Option 1: Personal Server Instance (Recommended)

Each user runs their own instance of the MCP server with their credentials:

```bash
# User 1 on port 3456
SDP_CLIENT_ID=user1_id SDP_CLIENT_SECRET=user1_secret npm run start:sse

# User 2 on port 3457  
SDP_HTTP_PORT=3457 SDP_CLIENT_ID=user2_id npm run start:sse
```

**Pros:**
- Complete isolation between users
- No credential sharing risks
- Works with current architecture

**Cons:**
- Requires multiple server instances
- Each user needs server access

### Option 2: Shared Credentials (Simple but Limited)

All users share the same SDP credentials configured on the server:

```env
# Server .env file
SDP_CLIENT_ID=shared_client_id
SDP_CLIENT_SECRET=shared_client_secret
SDP_REFRESH_TOKEN=shared_refresh_token
```

**Pros:**
- Simple setup
- Single server instance

**Cons:**
- All users share the same SDP access
- No per-user isolation
- Security concerns

### Option 3: Future Multi-Tenant Architecture (In Development)

We've laid the groundwork for true multi-tenant support:

#### Infrastructure Ready:
1. **Session Management** - Sessions can store SDP credentials
2. **Credential Extraction** - Headers parsed from client requests
3. **Dynamic Client Factory** - Create SDP clients on-demand
4. **Security Framework** - Validation and isolation

#### Configuration Format:

Users would configure their `.mcp.json` like this:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://server.example.com:3456/sse",
      "headers": {
        "X-API-Key": "server-api-key",
        "X-SDP-Client-ID": "your-client-id",
        "X-SDP-Client-Secret": "your-client-secret",
        "X-SDP-Refresh-Token": "your-refresh-token",
        "X-SDP-Base-URL": "https://your-instance.sdpondemand.manageengine.com",
        "X-SDP-Instance": "your-instance",
        "X-SDP-Technician-Email": "your-email@company.com"
      }
    }
  }
}
```

#### What's Missing:
The MCP SDK's SSE transport doesn't provide session context to tool handlers. Without this, we cannot:
- Identify which session is making a tool call
- Use the correct SDP client for that session
- Maintain isolation between users

## Recommended Setup for Multiple Users

### Using Docker Compose

Create a `docker-compose.yml` for multiple instances:

```yaml
version: '3.8'

services:
  sdp-user1:
    build: .
    ports:
      - "3456:3456"
    environment:
      - SDP_CLIENT_ID=user1_client_id
      - SDP_CLIENT_SECRET=user1_client_secret
      - SDP_REFRESH_TOKEN=user1_refresh_token
      - SDP_BASE_URL=https://instance1.sdpondemand.manageengine.com
      - SDP_INSTANCE_NAME=instance1
      - SDP_API_KEYS=user1-secure-key

  sdp-user2:
    build: .
    ports:
      - "3457:3456"
    environment:
      - SDP_CLIENT_ID=user2_client_id
      - SDP_CLIENT_SECRET=user2_client_secret
      - SDP_REFRESH_TOKEN=user2_refresh_token
      - SDP_BASE_URL=https://instance2.sdpondemand.manageengine.com
      - SDP_INSTANCE_NAME=instance2
      - SDP_API_KEYS=user2-secure-key
```

### Using Kubernetes

Deploy multiple instances with different configurations:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sdp-mcp-user1
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: sdp-mcp
        image: sdp-mcp:latest
        env:
        - name: SDP_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: sdp-user1-secrets
              key: client-id
        # ... other credentials
```

## Security Considerations

1. **API Key Management**
   - Each instance should have unique API keys
   - Use strong, randomly generated keys
   - Rotate keys regularly

2. **Network Isolation**
   - Use firewalls to restrict access
   - Consider VPN for remote users
   - Enable IP allowlists per instance

3. **Credential Storage**
   - Never commit credentials to version control
   - Use secrets management tools
   - Encrypt credentials at rest

## Future Development

We're tracking MCP SDK development for features that would enable true multi-tenant support:

1. **Session Context in Tool Handlers** - Access to session ID in request handlers
2. **Request Interceptors** - Ability to modify tool behavior per session
3. **HTTP Stream Transport** - May provide better session handling

## Alternative Architectures

### Proxy Pattern
Build a custom proxy that:
1. Accepts credentials from clients
2. Manages multiple SDP client instances
3. Routes requests to appropriate clients
4. Handles session management

### Sidecar Pattern
Deploy a sidecar container that:
1. Handles credential management
2. Provides local MCP interface
3. Connects to shared infrastructure

## Troubleshooting

### "Authentication failed" with valid credentials
- Check if credentials are properly set in environment
- Verify the instance URL is correct
- Ensure refresh token hasn't expired

### Multiple users see same data
- Verify each user has separate server instance
- Check that ports are correctly mapped
- Ensure API keys are unique per instance

### Performance issues with multiple instances
- Use connection pooling at database level
- Implement caching for common requests
- Consider horizontal scaling

## Conclusion

While true multi-tenant support awaits MCP SDK enhancements, the current architecture provides secure options for multiple users through instance isolation. Choose the approach that best fits your security requirements and infrastructure capabilities.