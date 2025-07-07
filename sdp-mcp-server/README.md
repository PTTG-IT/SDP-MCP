# SDP MCP Server

A multi-tenant Model Context Protocol (MCP) server for Service Desk Plus Cloud API integration.

## Overview

This server enables AI assistants (like Claude) to interact with Service Desk Plus Cloud instances through a secure, multi-tenant architecture. Each tenant uses their own OAuth credentials with complete isolation.

## Features

- 🏢 **Multi-Tenant Architecture**: Complete isolation between tenants
- 🔐 **OAuth 2.0 Authentication**: Self-client certificates per tenant
- 🛡️ **Enterprise Security**: AES-256-GCM encryption, per-tenant keys
- 📊 **Comprehensive Audit Logging**: All operations tracked
- 🚦 **Rate Limiting**: Per-tenant rate limits with circuit breakers
- 🔄 **Automatic Token Refresh**: Managed token lifecycle
- 📡 **SSE Transport**: Server-Sent Events for real-time communication

## Project Status

Currently in active development. See [DEVELOPMENT_PLAN.md](../development_plan.md) for progress.

### Completed
- ✅ Phase 1: Foundation (Database, Security, Configuration)
- ✅ Phase 2.1: Tenant Management
- ✅ Phase 2.2: OAuth Integration

### In Progress
- ⏳ Phase 2.3: Rate Limiting & Circuit Breakers

## Technology Stack

- **Language**: TypeScript (Node.js 20+)
- **Database**: PostgreSQL 15+
- **Cache**: Redis
- **MCP SDK**: @modelcontextprotocol/sdk
- **Security**: AES-256-GCM encryption, bcrypt

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis
- Docker & Docker Compose

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sdp-mcp-server.git
cd sdp-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the database and Redis:
```bash
docker-compose up -d
```

5. Run database migrations:
```bash
npm run migrate
```

6. Start the development server:
```bash
npm run dev
```

## Architecture

The server follows a modular architecture with clear separation of concerns:

```
src/
├── server/         # MCP server implementation
├── tenants/        # Multi-tenant management
├── auth/           # Authentication & OAuth
├── sdp/            # Service Desk Plus integration
├── database/       # Data access layer
├── monitoring/     # Logging & metrics
└── utils/          # Shared utilities
```

## Security

- Per-tenant encryption keys derived from master key
- OAuth tokens encrypted at rest
- Comprehensive audit logging
- Tenant isolation at all levels
- Rate limiting and circuit breakers

## License

[License Type] - See LICENSE file for details

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Support

For issues and questions, please use the GitHub issue tracker.