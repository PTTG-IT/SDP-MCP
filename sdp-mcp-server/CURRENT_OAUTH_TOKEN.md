# Current OAuth Token Configuration

## Token Generated
- **Date**: January 9, 2025
- **Auth Code Used**: `1000.de4e538fac76581a916deaaa50b5b72a.3108d7921315306763447100a02bb4d7`
- **Status**: ✅ Successfully exchanged

## OAuth Scopes Granted

This token has the following permissions:

### 1. SDPOnDemand.requests.ALL
- ✅ Create new requests/incidents/tickets
- ✅ Read/view all requests
- ✅ Update request details, status, priority
- ✅ Delete requests
- ✅ Close requests with resolution
- ✅ Add notes and comments
- ✅ Manage attachments
- ✅ View request history
- ✅ Manage time entries
- ✅ Handle approvals

### 2. SDPOnDemand.problems.ALL
- ✅ Create problem records
- ✅ Read/view all problems
- ✅ Update problem details
- ✅ Delete problems
- ✅ Perform root cause analysis
- ✅ Document workarounds
- ✅ Link problems to requests
- ✅ Manage problem attachments

### 3. SDPOnDemand.changes.ALL
- ✅ Create change requests
- ✅ Read/view all changes
- ✅ Update change details
- ✅ Delete changes
- ✅ Manage CAB approvals
- ✅ Perform impact analysis
- ✅ Create change tasks
- ✅ Document rollback plans

### 4. SDPOnDemand.solutions.ALL
- ✅ Create knowledge base articles
- ✅ Read/search all solutions
- ✅ Update solution content
- ✅ Delete solutions
- ✅ Link solutions to requests
- ✅ Manage solution topics
- ✅ Handle solution ratings
- ✅ Manage keywords

### 5. SDPOnDemand.assets.READ
- ✅ View asset details
- ✅ Check asset assignments
- ✅ View asset history
- ✅ See software installations
- ✅ View hardware components
- ❌ Cannot create/update/delete assets

### 6. SDPOnDemand.setup.READ
- ✅ Read categories and subcategories
- ✅ View priorities
- ✅ View statuses
- ✅ Access request templates
- ✅ View SLA policies
- ✅ Read business rules
- ✅ Access all configuration metadata
- ❌ Cannot modify setup/configuration

### 7. SDPOnDemand.users.READ
- ✅ View user profiles
- ✅ List technicians (if endpoint exists)
- ✅ View user groups
- ✅ Check department associations
- ❌ Cannot create/update/delete users

## What This Token CANNOT Do

- ❌ Manage contracts
- ❌ Handle purchase orders
- ❌ Modify assets (read-only)
- ❌ Change system configuration (read-only)
- ❌ Create/modify users (read-only)
- ❌ Access releases module
- ❌ Manage accounts
- ❌ Handle general/admin functions

## MCP Tools Enabled

With these scopes, the following MCP tools are fully functional:

### Request Management
- ✅ `list_requests` - List and filter requests
- ✅ `get_request` - Get request details
- ✅ `create_request` - Create new requests
- ✅ `update_request` - Update request details
- ✅ `close_request` - Close with resolution
- ✅ `add_note` - Add notes to requests
- ✅ `search_requests` - Search requests

### Metadata Tools
- ✅ `get_metadata` - Get all field values

### Future Tools (can be added)
- `create_problem` - Create problem from request
- `create_change` - Create change request
- `search_solutions` - Search KB articles
- `link_solution` - Link solution to request
- `get_asset` - View asset details

## Token Storage

The refresh token should be stored in `.env` as:
```
SDP_OAUTH_REFRESH_TOKEN=your_new_refresh_token_here
```

This token will remain valid until manually revoked and can generate new access tokens as needed.