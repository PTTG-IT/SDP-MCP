# Current MCP Tool Status Report
**Last Updated: January 5, 2025**

## Summary Statistics
- ✅ **Working**: 16 tools
- ⚠️ **Partially Working**: 1 tool
- ❌ **Not Working**: 9 tools
- 🔧 **Untested**: 6 tools
- **Total**: 32 tools

## ✅ Fully Working Tools (16)

### Request Management (8/8)
- `create_request` - Create new service requests
- `update_request` - Update existing requests
- `get_request` - Get request details
- `search_requests` - Search requests by keywords
- `list_requests` - List requests with filters
- `close_request` - Close requests with resolution
- `add_note_to_request` - Add notes/comments
- `assign_request` - Assign to technician

### User Management (2/2) 
- `get_user` - Get user info (searches both requesters & technicians)
- `search_users` - Search users (searches both types)

### Project Management Core (6/11)
- `create_project` - Create projects (with duplicate detection!)
- `update_project` - Update project details
- `get_project` - Get project information
- `list_projects` - List projects with filters
- `get_project_summary` - Get comprehensive project overview
- `get_technicians` - List all technicians (using direct API)

## ⚠️ Partially Working Tools (1)

### Project Task Management
- `list_project_tasks` - Returns "EXTRA_PARAM_FOUND" error
  - **Issue**: API doesn't accept pagination parameters
  - **Fix needed**: Remove page/per_page from parameters

## ❌ Not Working Tools (9)

### Not Implemented (5)
- `create_asset` - Module not implemented
- `update_asset` - Module not implemented  
- `search_assets` - Module not implemented
- `create_problem` - Module not implemented
- `create_change` - Module not implemented

### Authentication Issues (4)
Need `SDPOnDemand.setup.READ` scope:
- `get_priorities` - Returns "Authentication failed"
- `get_categories` - Returns "Authentication failed"
- `get_statuses` - Returns "Authentication failed"
- `get_request_types` - Returns "Authentication failed"

## 🔧 Untested Tools (5)

### Project Features
These are implemented but need testing:
- `create_task` - Create project tasks
- `update_task` - Update task details
- `complete_task` - Mark tasks complete
- `add_worklog` - Log time on tasks/projects
- `create_milestone` - Create project milestones

### Lookup Tools
- `get_subcategories` - Likely has auth issues like other lookups

## Implementation Priority

### 1. Quick Fixes (1-2 days)
1. **Fix `list_project_tasks`** - Remove pagination parameters
2. **Test project task tools** - Verify create_task, update_task, etc.
3. **Add setup.READ scope** - Fix all lookup tools

### 2. Asset Management (3-5 days)
1. Create `src/api/modules/assets.ts`
2. Implement create, update, search operations
3. Add MCP handlers
4. We already have the OAuth scope!

### 3. Research Required (1 week)
1. **Problems API** - Check if available in SDP Cloud
2. **Changes API** - Check if available in SDP Cloud
3. **Subcategories** - Test after fixing auth

## Current OAuth Scopes
✅ Active scopes:
- SDPOnDemand.requests.ALL
- SDPOnDemand.projects.ALL
- SDPOnDemand.assets.ALL
- SDPOnDemand.users.ALL

❌ Missing scope:
- SDPOnDemand.setup.READ (needed for lookups)

## Recent Fixes
1. **Users API** - Split into requesters/technicians endpoints
2. **Get Technicians** - Now uses direct API instead of lookups
3. **Project Duplicate Detection** - Prevents duplicate projects

## Known Issues
1. **Rate Limiting** - OAuth token requests limited to 10/10min
2. **Lookup Tools** - Need setup.READ scope
3. **Project Tasks** - Pagination parameters cause errors
4. **Problems/Changes** - May not exist in Cloud API

## Testing Commands

### Test a working tool:
```bash
# Test user search
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_users",
      "arguments": {"query": "admin"}
    },
    "id": 1
  }'
```

### Test project tasks (currently broken):
```bash
# Will return EXTRA_PARAM_FOUND error
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_project_tasks",
      "arguments": {"project_id": "YOUR_PROJECT_ID"}
    },
    "id": 1
  }'
```