# Authentication Decision Guide

## Current Situation
- Using Self Client credentials
- `client_credentials` grant works but only for `SDPOnDemand.requests.ALL`
- Need full API access for projects, assets, problems, etc.

## Option 1: Complete Self Client Setup (Recommended)
**Best for: Full API access to all modules**

### Steps:
1. Go to Zoho Developer Console
2. Generate a grant code with all required scopes
3. Exchange for refresh token using `scripts/setup-self-client.js`
4. Add refresh token to `.env`

### Pros:
- ✅ Full access to all API endpoints
- ✅ Automatic token refresh
- ✅ No user interaction after setup
- ✅ Follows Zoho's intended flow

### Cons:
- ❌ One-time manual setup required
- ❌ Grant code expires quickly (10 mins)

## Option 2: Stay with Limited Access
**Best for: Quick testing or requests-only operations**

### Current State:
- Already working for requests API
- No additional setup needed

### Pros:
- ✅ Zero configuration
- ✅ Already functioning
- ✅ Good for testing

### Cons:
- ❌ Only requests API accessible
- ❌ No projects, assets, problems access
- ❌ Severely limits MCP functionality

## Option 3: Create Regular OAuth App
**Best for: Multi-tenant or user-facing apps**

### Steps:
1. Create new OAuth app in Zoho
2. Implement authorization code flow
3. Handle user consent

### Pros:
- ✅ Designed for multi-user scenarios
- ✅ Each user authorizes separately

### Cons:
- ❌ Overkill for single-instance MCP
- ❌ Requires user interaction
- ❌ More complex implementation

## Recommendation

**Go with Option 1: Complete Self Client Setup**

For an MCP server that needs to:
- Access multiple API endpoints (projects, assets, etc.)
- Run without user interaction
- Serve AI assistants reliably

The one-time setup effort is worth it for full API access.

## Quick Setup Guide

```bash
# 1. Get grant code from Zoho Developer Console with these scopes:
SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.users.ALL,SDPOnDemand.setup.ALL

# 2. Run setup script
node scripts/setup-self-client.js

# 3. Add to .env
SDP_REFRESH_TOKEN=<your-refresh-token>

# 4. Update auth to use refresh token flow
```

## Why This Matters for MCP

MCP tools need predictable, reliable access to various SDP modules:
- `create_project` needs projects API
- `assign_technician` needs users API  
- `update_asset` needs assets API

Without full access, most MCP tools won't function properly.