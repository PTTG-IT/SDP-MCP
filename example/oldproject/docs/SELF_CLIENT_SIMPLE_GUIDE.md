# Self Client Setup - Simple Guide

This guide shows how to set up Service Desk Plus MCP with Self Client authentication where users only provide Client ID and Secret.

## For Users

Your `.mcp.json` configuration is now very simple:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://your-server:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "1000.XXXXXXXXXXXXXXXXXXXXXXXXXX",
        "SDP_CLIENT_SECRET": "YYYYYYYYYYYYYYYYYYYYYYYYYYYY"
      }
    }
  }
}
```

That's it! Just your Client ID and Secret. The server handles everything else.

## For Administrators

### Initial Server Setup

1. **Configure your company details** in `.env`:
   ```bash
   # Company-specific (hard-coded for internal use)
   SDP_BASE_URL=https://sdpondemand.manageengine.com
   SDP_INSTANCE_NAME=yourcompany
   
   # Database and encryption
   SDP_ENCRYPTION_KEY=your-32-character-encryption-key
   SDP_DB_HOST=localhost
   SDP_DB_PORT=5433
   # ... other database settings
   ```

2. **Start the database**:
   ```bash
   docker-compose up -d
   ```

3. **Build and start the server**:
   ```bash
   npm install
   npm run build
   npm run start:self-client
   ```

### Adding a New User

When a user creates their Self Client and gets their Client ID/Secret:

1. **Help them generate their initial OAuth token**:
   ```bash
   npm run oauth:setup
   ```
   
   This script will:
   - Ask for their Client ID and Secret
   - Guide them through getting an authorization code
   - Store their refresh token securely in the database

2. **Give them the simple configuration** shown above

### How It Works

1. User connects with just Client ID and Secret
2. Server looks up their stored OAuth tokens in the database
3. If tokens don't exist, user is prompted to complete initial setup
4. Once set up, tokens are automatically refreshed as needed
5. All credentials are encrypted and stored securely

### OAuth Token Lifecycle

```
First Time:
Client ID + Secret + Auth Code → Refresh Token → Database (encrypted)

Subsequent Connections:
Client ID + Secret → Look up Refresh Token → Get Access Token → Make API calls
```

### Admin Commands

```bash
# Initial OAuth setup for a user
npm run oauth:setup

# View all registered clients
curl http://localhost:3456/oauth/clients

# Manual token setup (if needed)
curl -X POST http://localhost:3456/oauth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "1000.XXX",
    "clientSecret": "YYY",
    "authCode": "1000.ZZZ"
  }'
```

## Security Benefits

- **No refresh tokens in config files** - Only stored encrypted in database
- **Simple user experience** - Just Client ID and Secret
- **Centralized token management** - Admin can revoke/manage tokens
- **Automatic token refresh** - Users never see token expiry
- **Encrypted storage** - All sensitive data encrypted at rest

## Troubleshooting

### "No OAuth tokens found" Error

The user needs to complete initial OAuth setup:
1. Run `npm run oauth:setup`
2. Follow the prompts
3. Tokens will be stored automatically

### "Token refresh failed" Error

- Check if Client ID/Secret are correct
- Verify the refresh token hasn't been revoked in Zoho
- Re-run initial setup if needed

### Connection Issues

- Ensure server is running: `npm run start:self-client`
- Check firewall/network settings
- Verify server URL in .mcp.json