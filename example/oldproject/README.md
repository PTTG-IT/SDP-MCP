# Service Desk Plus Cloud API MCP Server

A comprehensive **multi-user MCP server** for ManageEngine Service Desk Plus Cloud API that enables multiple remote clients to access Service Desk Plus tools through a centralized server with AI assistant integration.

## 🌐 Multi-User Remote Access Architecture

This MCP server is designed to run on a central host and serve multiple remote users:

- 🌍 **Remote Access** - Multiple computers can connect to this MCP server over the network
- 👥 **Multi-User Support** - Each user authenticates with their own OAuth credentials
- 🔧 **Shared Tools** - All users access the same set of Service Desk Plus API tools
- 💾 **Centralized Database** - PostgreSQL stores tokens and tracks usage for all users
- 📡 **SSE Transport** - Uses Server-Sent Events for real-time remote connections

## 🚀 NEW: Self-Client Authentication Implementation

Remote users connect using a streamlined authentication model:

- 🔑 **Simple Configuration** - Users only provide Client ID and Secret in `.mcp.json`
- 🔐 **Automatic Token Management** - Server handles all OAuth token lifecycle
- 💾 **Persistent Token Storage** - Refresh tokens encrypted in PostgreSQL database
- 🔄 **Smart Token Refresh** - Automatic refresh with rate limit awareness
- 🛡️ **Circuit Breaker Protection** - Graceful handling of API failures
- 📊 **Comprehensive Monitoring** - Track all OAuth operations and errors

[**→ Self-Client Auth Plan**](docs/SELF_CLIENT_AUTHENTICATION_PLAN.md) | [**→ User Registry Guide**](docs/USER_REGISTRY_GUIDE.md) | [**→ SSE Setup Guide**](docs/SSE_SETUP_GUIDE.md) | [**→ Quick Start**](docs/QUICK_START.md)

## 📊 MCP Tool Status (32 Total)

| Status | Count | Description |
|--------|-------|-------------|
| ✅ **Working** | 16 | Fully functional and tested |
| ⚠️ **Partially Working** | 1 | Has minor issues |
| ❌ **Not Working** | 9 | Not implemented or auth issues |
| 🔧 **Untested** | 6 | Implemented but needs testing |

**Quick Overview:**
- ✅ **Request Management**: All 8 tools working (create, update, close, search, etc.)
- ✅ **User Management**: Both tools working (fixed by splitting requesters/technicians)
- ✅ **Core Projects**: 6/11 tools working (create, update, list, summary)
- ⚠️ **Project Tasks**: 1 tool has pagination issues, 5 need testing
- ❌ **Assets**: 3 tools not implemented (module missing)
- ❌ **Lookups**: 4 tools need SDPOnDemand.setup.READ scope
- ❌ **Problems/Changes**: Not implemented

[View detailed tool status →](docs/CURRENT_TOOL_STATUS.md)

## 🚀 Quick Start

See our [Quick Start Guide](docs/QUICK_START.md) for a 5-minute setup!

## 🤖 Context Engineering

This project uses **Context Engineering** to enable AI assistants to better understand and work with the codebase. 

### For AI Assistants (Claude)
1. Start by reading `PLANNING.md` to understand the architecture
2. Check `TASK.md` for current work items
3. Use `/generate-prp` to create implementation plans from feature requests
4. Use `/execute-prp` to implement features with validation

### For Developers
1. Create feature requests in `INITIAL.md`
2. Use the context engineering workflow to generate comprehensive implementation plans
3. Execute plans with built-in validation and testing

## Features

- 🔐 OAuth 2.0 authentication with Self Client support
- 📦 Full API client for Service Desk Plus Cloud
- 🤖 MCP server for AI integration
- 🔄 Automatic rate limiting and retry logic
- 📚 Support for major SDP modules:
  - ✅ **Requests** - All operations working (create, update, close, search, assign, notes)
  - ✅ **Projects** - Core features working (create, update, list, summary)
  - ✅ **Users** - Fully working (split into requesters/technicians)
  - ⚠️ **Tasks** - Partially working (list has issues, others untested)
  - ❌ **Assets** - Not implemented yet
  - ❌ **Problems** - Not implemented yet
  - ❌ **Changes** - Not implemented yet
- 🛡️ Comprehensive error handling
- 📝 TypeScript support with full type definitions
- 🔑 Full OAuth scope support with refresh token flow

## Prerequisites

- Node.js 18 or later
- Service Desk Plus Cloud account with API access
- OAuth 2.0 credentials (Client ID and Client Secret)

## 🔒 Security Notice

**IMPORTANT:** This project handles sensitive API credentials. Please follow these security practices:

1. **Never commit credentials**: The `.env` file contains sensitive information and should NEVER be committed to version control
2. **Rotate credentials regularly**: If credentials are exposed, revoke them immediately in your Service Desk Plus admin panel
3. **Use environment variables**: Always use environment variables for sensitive configuration
4. **Review error messages**: Ensure error messages don't expose sensitive implementation details

### Credential Security Checklist
- [ ] `.env` file is in `.gitignore` (already configured)
- [ ] Never share your Client ID and Client Secret
- [ ] Use different credentials for development and production
- [ ] Enable OAuth 2.0 scope restrictions in SDP if available
- [ ] Monitor API usage for unauthorized access

## Server Installation (For Hosting the MCP Server)

1. Clone the repository:
```bash
git clone <repository-url>
cd service-desk-plus-cloud-api
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment variables template:
```bash
cp .env.example .env
```

4. Configure your Service Desk Plus instance in `.env`:
```env
# Company-specific configuration (hard-coded for all users)
SDP_BASE_URL=https://your-domain.com  # Your SDP portal URL (without /app/)
SDP_INSTANCE_NAME=your_instance  # Found in Admin > Instance Settings

# Database configuration
SDP_DB_HOST=localhost
SDP_DB_PORT=5433
SDP_DB_NAME=sdp_mcp
SDP_DB_USER=sdpmcpservice
SDP_DB_PASSWORD=your_secure_password_here
```

5. Start the database:
```bash
docker-compose up -d
```

6. Start the MCP server:
```bash
npm run start:self-client
```

The server will run on `http://localhost:3456/sse` by default.

## Remote Client Setup (For Connecting to the MCP Server)

Each remote user needs to:

1. Create a `.mcp.json` file in their home directory:
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://YOUR_SERVER_HOST:3456/sse",
      "env": {
        "SDP_CLIENT_ID": "1000.YOUR_CLIENT_ID",
        "SDP_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

2. Replace:
   - `YOUR_SERVER_HOST` with the IP/hostname of the MCP server
   - `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` with OAuth credentials from Zoho

**Important Notes:**
- Each user needs their own OAuth credentials from Zoho API Console
- The server must be accessible from client machines (check firewall rules)
- Tokens are managed automatically by the server - no manual refresh needed

## Getting OAuth Credentials

For Service Desk Plus **Cloud**, OAuth credentials are managed through the Zoho API Console:

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Click **Add Client**
3. Choose **Self Client** for internal applications (or appropriate type for your use case)
4. Click **Create**
5. On the API Console main page, click on your client application
6. Navigate to the **Client Secret** tab
7. Copy your **Client ID** and **Client Secret**

**Important Notes:**
- Use your domain-specific Zoho Developer Console based on your data center
- For on-premise Service Desk Plus installations, API keys are generated differently (Admin → Technicians)
- Self Client requires a one-time OAuth setup to get refresh token (see OAuth Setup section below)

## OAuth Setup (Self Client)

For full API access, you need to complete a one-time OAuth setup:

1. **Generate Grant Code**:
   - Go to your Self Client in Zoho Developer Console
   - Click "Generate Code" tab
   - Enter scopes: `SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.users.ALL`
   - Set time duration: 10 minutes
   - Copy the code immediately

2. **Exchange for Refresh Token**:
   ```bash
   node scripts/setup-self-client.js
   ```
   Follow the prompts to enter your Client ID, Secret, and Grant Code.

3. **Verify Setup**:
   The script will automatically add the refresh token to your `.env` file.

For detailed instructions, see [OAuth Setup Guide](docs/OAUTH_SETUP_COMPLETE_GUIDE.md) or [Quick Reference](docs/OAUTH_QUICK_REFERENCE.md).

## Usage

### As an MCP Server

#### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "node",
      "args": ["/path/to/service-desk-plus-cloud-api/dist/index.js"],
      "env": {
        "SDP_CLIENT_ID": "your_client_id",
        "SDP_CLIENT_SECRET": "your_client_secret",
        "SDP_BASE_URL": "https://your-domain.com",
        "SDP_INSTANCE_NAME": "your_instance",
        "SDP_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

#### Available MCP Tools

- `create_request` - Create a new service request
- `update_request` - Update an existing request
- `get_request` - Get request details
- `search_requests` - Search for requests
- `create_asset` - Create a new asset
- `update_asset` - Update asset information
- `search_assets` - Search for assets
- `get_user` - Get user information
- `create_task` - Create a task for a request
- And many more...

### As a Node.js Library

```typescript
import { SDPClient } from 'service-desk-plus-cloud-api';

const client = new SDPClient({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  baseUrl: 'https://your-domain.com',
  instanceName: 'your_instance'
});

// Create a request
const request = await client.requests.create({
  subject: 'New laptop request',
  description: 'I need a new laptop for development work',
  requester: { email: 'user@example.com' },
  category: 'Hardware',
  priority: 'High'
});

// Search for assets
const assets = await client.assets.search({
  query: 'laptop',
  limit: 10
});
```

## Development

### Context Engineering Workflow

This project follows a context engineering approach for feature development:

1. **Define Feature**: Update `INITIAL.md` with your feature request
2. **Generate PRP**: Run `/generate-prp` to create a detailed implementation plan
3. **Review Plan**: Check the generated PRP in the `PRPs/` directory
4. **Execute Implementation**: Run `/execute-prp <prp-filename>` to implement
5. **Track Progress**: Monitor tasks in `TASK.md`

### Key Context Files

- **`CLAUDE.md`**: AI assistant guidelines and coding standards
- **`PLANNING.md`**: Project architecture and technical decisions
- **`TASK.md`**: Current tasks and progress tracking
- **`INITIAL.md`**: Template for new feature requests
- **`PRPs/`**: Product Requirements Prompts for features

### Building

```bash
npm run build
```

### Running in Development

```bash
npm run dev
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## 📚 Documentation

- [API Reference](docs/API_REFERENCE.md) - Detailed API documentation
- [MCP Tools](docs/MCP_TOOLS.md) - Available MCP tools and usage
- [OAuth Setup Guide](docs/OAUTH_SETUP_COMPLETE_GUIDE.md) - Complete OAuth setup instructions
- [OAuth Quick Reference](docs/OAUTH_QUICK_REFERENCE.md) - Quick OAuth troubleshooting
- [Self-Client Authentication Plan](docs/SELF_CLIENT_AUTHENTICATION_PLAN.md) - Implementation roadmap
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Security](SECURITY.md) - Security best practices
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Changelog](CHANGELOG.md) - Version history

## Project Structure

```
service-desk-plus-cloud-api/
├── .claude/                  # Context engineering configuration
│   ├── commands/             # Custom AI commands
│   └── settings.local.json   # Permission settings
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── api/                  # API client implementation
│   │   ├── client.ts         # Base API client
│   │   ├── auth.ts           # OAuth authentication
│   │   └── modules/          # API modules
│   ├── mcp/                  # MCP server implementation
│   │   ├── tools.ts          # Tool definitions
│   │   └── handlers.ts       # Tool handlers
│   └── utils/                # Utility functions
├── PRPs/                     # Product Requirements Prompts
│   └── templates/            # PRP templates
├── docs/                     # Documentation
├── examples/                 # Usage examples
├── tests/                    # Test files
├── CLAUDE.md                 # AI assistant guidelines
├── PLANNING.md               # Architecture documentation
├── TASK.md                   # Task tracking
└── INITIAL.md                # Feature request template
```

## API Modules

### ✅ Requests (Fully Implemented)
- Create, update, delete requests
- Add notes and attachments
- Change status and assignments
- Search and filter requests
- Close requests with resolution

### ✅ Projects (Fully Implemented)
- Create and manage projects
- Task management with hierarchy
- Milestone tracking
- Time tracking with worklogs
- Project progress monitoring
- Resource allocation

### ✅ Users (Fully Implemented)
- Get user information
- Search users
- List all users

### 🚧 Assets (Coming Soon)
- Manage IT assets
- Track asset lifecycle
- Associate assets with users
- Bulk operations

### 🚧 Problems (Coming Soon)
- Create and manage problems
- Link to incidents
- Root cause analysis
- Problem resolution tracking

### 🚧 Changes (Coming Soon)
- Change request management
- Approval workflows
- Impact analysis
- Change scheduling

## Error Handling

The API client provides detailed error information:

```typescript
try {
  await client.requests.create(data);
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limiting
  } else if (error.code === 'AUTHENTICATION_FAILED') {
    // Handle auth errors
  }
}
```

## Rate Limiting

The client automatically handles rate limiting with exponential backoff. You can configure the rate limit in your environment variables:

```env
SDP_RATE_LIMIT_PER_MINUTE=60
```

## Contributing

### Adding New Features

1. **Create Feature Request**: Copy `INITIAL.md` and fill in your feature details
2. **Generate Implementation Plan**: AI assistants will use `/generate-prp` to create a comprehensive plan
3. **Review the PRP**: Check the generated plan in `PRPs/` directory
4. **Implement**: Use `/execute-prp` or implement manually following the plan
5. **Test**: Ensure all tests pass and coverage meets standards
6. **Document**: Update API and MCP documentation

### Code Standards

- Follow TypeScript strict mode
- Maintain 80%+ test coverage
- Use ESLint and Prettier
- Follow patterns in existing code
- Read `CLAUDE.md` for detailed guidelines

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.

For Service Desk Plus API documentation, visit: https://www.manageengine.com/products/service-desk/sdpod-v3-api/

## Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Service Desk Plus API v3 Guide](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)
- [OAuth 2.0 Setup Guide](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started.html)