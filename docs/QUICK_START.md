# Quick Start Guide

## 🚀 5-Minute Setup

### 1. Clone and Install
```bash
git clone https://github.com/TenKTech/service-desk-plus-mcp.git
cd service-desk-plus-mcp
npm install
```

### 2. Get OAuth Credentials
1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Click **Add Client** → **Self Client** → **Create**
3. Open your client and go to **Client Secret** tab
4. Copy the Client ID and Client Secret

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials:
# - SDP_CLIENT_ID=your_client_id
# - SDP_CLIENT_SECRET=your_client_secret
# - SDP_BASE_URL=https://your-helpdesk.com
# - SDP_INSTANCE_NAME=your-instance
```

### 4. Build and Test
```bash
npm run build
npm test
```

### 5. Configure MCP Client

For Claude Desktop, add to your config:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "node",
      "args": ["/path/to/service-desk-plus-mcp/dist/index.js"],
      "env": {
        "SDP_CLIENT_ID": "your_client_id",
        "SDP_CLIENT_SECRET": "your_client_secret",
        "SDP_BASE_URL": "https://your-helpdesk.com",
        "SDP_INSTANCE_NAME": "your-instance"
      }
    }
  }
}
```

## 🎯 Common Tasks

### Create a Request
```
Create a request with subject "Laptop not working" for user john@company.com
```

### Search Requests
```
Search for all open requests containing "printer"
```

### Close a Request
```
Close request 12345 with resolution "Replaced toner cartridge"
```

### Assign Request
```
Assign request 12345 to technician tech@company.com
```

## 🔍 Troubleshooting Quick Fixes

### "Invalid Client" Error
- Check credentials in `.env`
- Verify at https://api-console.zoho.com/

### "404 Not Found" Error
- Check `SDP_BASE_URL` format (no `/app/` at end)
- Verify `SDP_INSTANCE_NAME` is correct

### Request Creation Fails
- Required fields are set by default
- Check category/subcategory names in your instance

## 📖 More Resources

- [Full Documentation](../README.md)
- [API Reference](API_REFERENCE.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)
- [Security Best Practices](../SECURITY.md)