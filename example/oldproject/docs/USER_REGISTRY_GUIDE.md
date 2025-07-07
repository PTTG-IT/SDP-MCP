# User Registry Guide

This guide explains how to set up and use the API Key Mapping Service (User Registry) for multi-user access to the Service Desk Plus MCP server.

## Overview

The User Registry allows multiple users to connect to a single MCP server instance using simple API keys (`usr_*` format) that map to their individual Service Desk Plus credentials stored securely on the server.

### Benefits

- **Simple client configuration**: Users only need one API key in their `.mcp.json`
- **Secure credential storage**: SDP credentials are encrypted with AES-256-GCM
- **Centralized management**: Admin can manage all users from the server
- **Usage tracking**: Monitor who is using the system and how often
- **Easy updates**: Server improvements don't require client changes

## Prerequisites

1. PostgreSQL database running (via Docker)
2. Node.js 18+ installed
3. Environment variables configured
4. Encryption key set up

## Initial Setup

### 1. Set Environment Variables

Create or update your `.env` file:

```bash
# Database connection
SDP_DB_HOST=localhost
SDP_DB_PORT=5433
SDP_DB_NAME=sdp_mcp
SDP_DB_USER=sdpmcpservice
SDP_DB_PASSWORD=your_secure_database_password_here

# Encryption key (32+ characters)
SDP_ENCRYPTION_KEY=your-32-character-encryption-key-here

# Server configuration
SDP_HTTP_PORT=3456
SDP_HTTP_HOST=0.0.0.0
SDP_ENABLE_CORS=true
SDP_CORS_ORIGIN=*

# Feature flags
SDP_USE_DB_TOKENS=true
SDP_USE_AUDIT_LOG=true
SDP_USE_CHANGE_TRACKING=true

# Optional: Standard API keys (for backward compatibility)
SDP_API_KEYS=
```

### 2. Start the Database

```bash
docker-compose up -d
```

### 3. Build the Project

```bash
npm install
npm run build
```

## Adding Users

### Option 1: Interactive Setup Script (Recommended)

The easiest way to add users is with the interactive setup script:

```bash
npm run user:setup
```

This will:
1. Validate your database connection
2. Initialize the schema if needed
3. Guide you through adding users
4. Generate API keys and configuration

### Option 2: Admin CLI Tool

For more control, use the admin CLI:

```bash
# List all users
npm run user:admin list

# Create a new user
npm run user:admin create

# Show user details
npm run user:admin show <userId>

# Update user credentials
npm run user:admin update-credentials <userId>

# Deactivate a user
npm run user:admin deactivate <userId>
```

### Option 3: Direct Database Insert (Advanced)

For bulk operations, you can insert directly into the database. See the migration file for the schema.

## Starting the Server

Start the server with user registry enabled:

```bash
npm run start:registry
```

Or for development:

```bash
npm run dev:registry
```

The server will:
- Validate encryption setup
- Connect to the database
- Initialize the user registry
- Start accepting connections

## Client Configuration

After creating a user, provide them with their API key and this configuration:

### For Claude Desktop

Edit `.mcp.json` (location varies by OS):
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://your-server.com:3456/sse",
      "headers": {
        "X-API-Key": "usr_2KtY3Bz9F5X8vQ..."
      }
    }
  }
}
```

### For Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse", 
      "url": "http://your-server.com:3456/sse",
      "headers": {
        "X-API-Key": "usr_2KtY3Bz9F5X8vQ..."
      }
    }
  }
}
```

## Security Considerations

### Encryption Key

- Use a strong, random 32+ character key
- Store it securely (environment variable, secrets manager)
- Never commit it to version control
- Changing the key will invalidate all stored credentials

### API Keys

- Each user gets a unique API key
- Keys are hashed before storage (SHA-256)
- Keys can be deactivated without deleting the user
- Monitor usage to detect anomalies

### Network Security

- Use HTTPS in production (reverse proxy recommended)
- Configure IP allowlists if needed
- Enable CORS only for trusted origins
- Use firewall rules to restrict access

## Monitoring and Maintenance

### View Active Sessions

```bash
curl -H "X-API-Key: admin-key" http://localhost:3456/sessions
```

### Check User Usage

```sql
-- Connect to database
docker exec -it sdp-mcp-postgres psql -U sdpmcpservice -d sdp_mcp

-- View user activity
SELECT 
  um.user_name,
  um.last_used_at,
  um.usage_count,
  COUNT(umu.id) as recent_sessions
FROM user_mappings um
LEFT JOIN user_mapping_usage umu ON um.id = umu.user_mapping_id
  AND umu.used_at > NOW() - INTERVAL '7 days'
GROUP BY um.id
ORDER BY um.last_used_at DESC;
```

### Database Backups

Regular backups are crucial since credentials are stored in the database:

```bash
# Backup
docker exec sdp-mcp-postgres pg_dump -U sdpmcpservice sdp_mcp > backup.sql

# Restore
docker exec -i sdp-mcp-postgres psql -U sdpmcpservice sdp_mcp < backup.sql
```

## Troubleshooting

### User Can't Connect

1. Verify the API key is correct
2. Check if the user is active: `npm run user:admin show <userId>`
3. Test database connection: `node scripts/test-db.js`
4. Check server logs for authentication errors

### Encryption Errors

1. Verify `SDP_ENCRYPTION_KEY` is set
2. Ensure the key hasn't changed since users were created
3. Test encryption: Set a test key and run the server

### Database Connection Issues

1. Check Docker container: `docker ps`
2. Verify port 5433 is not in use: `lsof -i :5433`
3. Check logs: `docker logs sdp-mcp-postgres`

## Limitations

### Current Limitations

1. **MCP SDK Session Context**: The SDK doesn't provide session context in tool handlers, limiting per-user rate limiting within tools
2. **Credential Updates**: Users must contact admin to update their SDP credentials
3. **No Self-Service**: Users cannot reset their own API keys

### Planned Improvements

1. Web interface for user self-service
2. OAuth flow for initial credential setup
3. Automatic credential rotation
4. Enhanced analytics dashboard

## Example: Adding Your First User

```bash
# 1. Start the database
docker-compose up -d

# 2. Set up encryption key
export SDP_ENCRYPTION_KEY=my-super-secret-32-character-key

# 3. Run the setup script
npm run user:setup

# 4. Follow the prompts:
#    User name: John Doe
#    User email: john.doe@company.com
#    SDP Client ID: [from SDP OAuth app]
#    SDP Client Secret: [from SDP OAuth app]
#    SDP Base URL: https://sdpondemand.manageengine.com
#    SDP Instance Name: yourcompany
#    SDP Refresh Token: [from OAuth flow]

# 5. Save the generated API key and configuration

# 6. Start the server
npm run start:registry
```

## Migration from Standard API Keys

If you're currently using standard API keys in `SDP_API_KEYS`:

1. Keep existing API keys during migration
2. Add users to the registry one by one
3. Update client configurations gradually
4. Remove standard API keys once all users migrated

The server supports both authentication methods simultaneously.