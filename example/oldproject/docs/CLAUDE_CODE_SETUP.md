# Claude Code Setup for Service Desk Plus MCP

This guide explains how to configure Claude Code to use the Service Desk Plus MCP server with your own credentials.

## Prerequisites

1. Service Desk Plus Cloud account with API access
2. Zoho OAuth credentials (Client ID, Client Secret, Refresh Token)
3. Node.js installed on your system
4. Claude Code extension installed in VS Code

## Option 1: Direct Environment Variables in .mcp.json

This is the simplest approach where you configure your credentials directly in the `.mcp.json` file.

1. **Create or edit `.mcp.json` in your project root**:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "node",
      "args": ["./dist/indexSSE.js"],
      "env": {
        "SDP_CLIENT_ID": "your-actual-client-id",
        "SDP_CLIENT_SECRET": "your-actual-client-secret",
        "SDP_INSTANCE_NAME": "your-instance-name",
        "SDP_BASE_URL": "https://your-portal.servicedeskplus.com",
        "SDP_REFRESH_TOKEN": "your-refresh-token",
        "SDP_HTTP_PORT": "3456",
        "SDP_HTTP_HOST": "127.0.0.1",
        "SDP_API_KEYS": "generate-a-secure-key-here",
        "SDP_USE_DB_TOKENS": "false",
        "SDP_USE_AUDIT_LOG": "false",
        "SDP_USE_CHANGE_TRACKING": "false",
        "SDP_DEFAULT_TECHNICIAN_EMAIL": "your-email@company.com"
      }
    }
  }
}
```

2. **Build the project**:
```bash
npm install
npm run build
```

3. **Restart Claude Code** to pick up the new configuration

## Option 2: Using Environment Files (More Secure)

This approach keeps your credentials in a separate file that won't be committed to git.

1. **Create `.env.claude` file**:
```bash
cp .env.claude.example .env.claude
```

2. **Edit `.env.claude` with your credentials**:
```env
# Your Service Desk Plus credentials
SDP_CLIENT_ID=1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
SDP_CLIENT_SECRET=YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
SDP_INSTANCE_NAME=mycompany
SDP_BASE_URL=https://helpdesk.mycompany.com
SDP_REFRESH_TOKEN=1000.ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ

# Server configuration
SDP_HTTP_PORT=3456
SDP_API_KEYS=my-secure-api-key-12345
SDP_DEFAULT_TECHNICIAN_EMAIL=john.doe@mycompany.com
```

3. **Update `.mcp.json` to use the script**:
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "bash",
      "args": ["-c", "source .env.claude && node ./dist/indexSSE.js"]
    }
  }
}
```

## Option 3: User-Specific Instances

For shared systems where multiple users need their own credentials:

1. **Create a user-specific environment file**:
```bash
cp .env.claude.example .env.yourname
# Edit .env.yourname with your personal credentials
```

2. **Configure `.mcp.json` to use your instance**:
```json
{
  "mcpServers": {
    "service-desk-plus-yourname": {
      "command": "bash",
      "args": ["./start-user-instance.sh", "yourname"]
    }
  }
}
```

## Getting Your Credentials

### 1. Client ID and Secret

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Click "ADD CLIENT" → Choose "Self Client"
3. Enter details and click "CREATE"
4. Copy the Client ID and Client Secret

### 2. Instance Name

1. Log into Service Desk Plus
2. Go to Admin → Instance Settings
3. Find your instance name (e.g., "mycompany")

### 3. Refresh Token

Run the setup script:
```bash
node scripts/setup-self-client.js
```

Follow the prompts to generate your refresh token.

### 4. API Key

Generate a secure API key for the SSE server:
```bash
# Generate a random API key
openssl rand -hex 32
```

## Verifying Your Setup

1. **Check if the server starts**:
   Look for the startup message in Claude Code's output panel

2. **Test a simple command**:
   Ask Claude: "Can you search for recent service desk requests?"

3. **Check logs**:
   View the server logs in the Claude Code output panel

## Troubleshooting

### "Authentication failed" errors
- Verify your Client ID and Client Secret are correct
- Check that your refresh token hasn't expired
- Ensure your instance name matches exactly

### "Connection refused" errors
- Check if the port (default: 3456) is already in use
- Try a different port in your configuration

### "No MCP servers found"
- Restart VS Code after updating .mcp.json
- Check that the file paths in .mcp.json are correct
- Ensure the project is built (`npm run build`)

## Security Best Practices

1. **Never commit credentials**: Add `.env.*` to your `.gitignore`
2. **Use strong API keys**: Generate random keys for SDP_API_KEYS
3. **Rotate tokens regularly**: Update refresh tokens periodically
4. **Limit permissions**: Use OAuth scopes that grant only necessary access

## Advanced Configuration

### Custom Port
If port 3456 is in use, change it:
```json
"env": {
  "SDP_HTTP_PORT": "3457"
}
```

### Enable Database Features
For persistent token storage:
```json
"env": {
  "SDP_USE_DB_TOKENS": "true",
  "SDP_DB_HOST": "localhost",
  "SDP_DB_PORT": "5433"
}
```

### Rate Limiting
Adjust rate limits if needed:
```json
"env": {
  "SDP_RATE_LIMIT_PER_MINUTE": "120"
}
```

## Next Steps

Once configured, you can use Claude Code to:
- Create and manage service requests
- Search for users and assign tickets
- Create projects and tasks
- Generate reports and summaries

See the [MCP Tools Documentation](../MCP_TOOLS.md) for available commands.