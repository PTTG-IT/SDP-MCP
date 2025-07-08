# Service Desk Plus MCP Server

A Model Context Protocol (MCP) server that integrates with Service Desk Plus Cloud API, enabling AI assistants to perform CRUD operations on all Service Desk Plus entities.

## 🚀 Current Status (January 2025)

✅ **Fully Operational** - SSE server running on port 3456  
✅ **MCP Integration** - Successfully connected with Claude Code client  
✅ **All Tools Working** - 8 tools available and tested  
✅ **Production Ready** - Single-tenant implementation with OAuth

### Working Implementation
- **Architecture**: Direct MCP protocol over Server-Sent Events (SSE)
- **Location**: `sdp-mcp-server/src/working-sse-server.cjs`
- **Status**: All Service Desk Plus tools operational
- **Client**: Successfully tested with Claude Code

## 📋 Available Tools

1. **list_requests** - List service desk requests with optional filters
2. **get_request** - Get detailed information about a specific request
3. **search_requests** - Search requests by keyword
4. **create_request** - Create a new service desk request
5. **update_request** - Update an existing request
6. **close_request** - Close a request with resolution details
7. **add_note** - Add a note/comment to a request
8. **get_metadata** - Get valid values for priorities, statuses, categories

## 🔧 Quick Start

### Prerequisites
- Node.js 18+
- Service Desk Plus Cloud account with OAuth credentials
- Permanent refresh token (never expires!)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/SDP-MCP.git
cd SDP-MCP/sdp-mcp-server
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your OAuth credentials
```

4. **Start the server**
```bash
./start-sse-server.sh
```

The server will start on port 3456.

### Client Configuration

For Claude Code or other MCP clients:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "npx",
      "args": ["mcp-remote", "http://192.168.2.10:3456/sse", "--allow-http"]
    }
  }
}
```

## 🏗️ Architecture

### Current: Single-Tenant SSE Server
- Direct MCP protocol implementation (no SDK dependency)
- OAuth tokens via environment variables
- Automatic token refresh
- CommonJS modules to avoid ES module conflicts

### Future: Multi-Tenant Support
Planned when MCP protocol evolves to support stateless connections:
- PostgreSQL for token storage
- Per-tenant isolation
- Scope-based access control
- Rate limiting per tenant

## 📚 Documentation

- [Development Plan](DEVELOPMENT_PLAN.md) - Project roadmap and status
- [Claude Guidelines](CLAUDE.md) - AI assistant development guidelines
- [SSE Implementation](example/knowledge/service-desk-plus-sse-implementation.md) - Technical details
- [OAuth Setup Guide](sdp-mcp-server/docs/OAUTH_SETUP_GUIDE.md) - OAuth configuration

## 🔐 Security

- OAuth tokens stored securely in environment variables
- Automatic token refresh (access tokens expire after 1 hour)
- Permanent refresh tokens (one-time setup only)
- HTTPS required in production

## 🛠️ Development

### Project Structure
```
sdp-mcp-server/
├── src/
│   ├── working-sse-server.cjs   # Main SSE server
│   ├── sdp-api-client-v2.cjs   # SDP API client
│   ├── sdp-oauth-client.cjs    # OAuth management
│   └── sdp-api-metadata.cjs    # Metadata retrieval
├── .env                         # Environment config
├── start-sse-server.sh         # Startup script
└── SSE_SERVER_READY.md         # Status documentation
```

### Next Steps
- Add more SDP modules (problems, changes, projects, assets)
- Enhance existing tools with batch operations
- Improve error handling and retry logic
- Add attachment support
- Implement template support

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## 📞 Support

For issues and feature requests, please use the GitHub issue tracker.