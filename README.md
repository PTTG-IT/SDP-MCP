# Service Desk Plus Cloud API MCP Server

A comprehensive integration solution for ManageEngine Service Desk Plus Cloud API that provides both a programmatic API client and an MCP (Model Context Protocol) server for AI assistants like Claude.

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
- 📚 Support for all major SDP modules:
  - ✅ Requests (create, update, close, search, assign)
  - ✅ Projects (full project management with tasks & time tracking)
  - ✅ Assets (list, get, create, update)
  - ✅ Users (search, list, get details)
  - 🚧 Problems (coming soon)
  - 🚧 Changes (coming soon)
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

## Installation

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

4. Configure your Service Desk Plus credentials in `.env`:
```env
SDP_CLIENT_ID=your_client_id
SDP_CLIENT_SECRET=your_client_secret
SDP_BASE_URL=https://your-domain.com  # Your SDP portal URL (without /app/)
SDP_INSTANCE_NAME=your_instance  # Found in Admin > Instance Settings
SDP_REFRESH_TOKEN=your_refresh_token  # Generated via Self Client setup (see OAuth Setup below)
```

**Important Notes:**
- `SDP_BASE_URL` should be your portal's base URL (e.g., `https://helpdesk.company.com`)
- `SDP_INSTANCE_NAME` can be found in your Service Desk Plus instance settings
- OAuth uses Zoho's central authentication server (`https://accounts.zoho.com`)
- After creating new credentials, always revoke old ones for security

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