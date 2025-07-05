# Non-Functional MCP Tools Report

## Test Date: January 5, 2025

## Summary

Testing revealed several categories of non-functional tools:
1. **Not Implemented** - Modules not yet built
2. **API Errors** - Tools that exist but return errors
3. **Authentication Issues** - Tools failing due to auth/scope problems

## 1. Not Implemented Tools ❌

These tools return "NOT_IMPLEMENTED" error:

### Asset Management
- `create_asset` - Returns: "Asset management is not yet implemented"
- `update_asset` - Not tested (module not implemented)
- `search_assets` - Not tested (module not implemented)

### Problem Management
- `create_problem` - Returns: "Problem management is not yet implemented"

### Change Management
- `create_change` - Returns: "Change management is not yet implemented"

## 2. API Error Tools ⚠️

These tools are implemented but return API errors:

### User Management - FIXED ✅
- ~~`get_user` - Returns: 404 Not Found~~
  - **FIXED**: Split users into `/requesters` and `/technicians` endpoints
- ~~`search_users` - Returns: 404 Not Found~~
  - **FIXED**: MCP handlers now search both requesters and technicians

### Project Task Management
- `list_project_tasks` - Returns: "EXTRA_PARAM_FOUND" validation error
  - The API doesn't accept the pagination parameters we're sending
  - Needs investigation of correct API format

## 3. Authentication Issues 🔐

These tools fail with authentication errors:

### Lookup Tools
- `get_priorities` - Returns: "Authentication failed"
- `get_categories` - Not tested (likely same issue)
- `get_statuses` - Not tested (likely same issue)
- `get_technicians` - **PARTIALLY FIXED**: Now uses technicians.list() API directly
- `get_request_types` - Not tested (likely same issue)
- `get_subcategories` - Not tested (likely same issue)

**Possible Causes:**
1. MCP server needs restart to use refresh token
2. These endpoints require `SDPOnDemand.setup.READ` scope (which we don't have)
3. Different authentication method required for admin endpoints

## 4. Working Tools ✅

For reference, these tools are confirmed working:

### Request Management
- `create_request`
- `update_request`
- `get_request`
- `search_requests`
- `list_requests`
- `close_request`
- `add_note_to_request`
- `assign_request`

### Project Management
- `create_project` (with duplicate detection!)
- `update_project`
- `get_project`
- `list_projects`
- `get_project_summary`

### Partial Project Features
- `create_task` - Likely works but needs testing
- `update_task` - Likely works but needs testing
- `complete_task` - Likely works but needs testing
- `add_worklog` - Likely works but needs testing
- `create_milestone` - Likely works but needs testing

## Root Causes Analysis

### 1. Missing OAuth Scopes
Our current scopes:
- ✅ SDPOnDemand.requests.ALL
- ✅ SDPOnDemand.projects.ALL
- ✅ SDPOnDemand.assets.ALL (but module not implemented)
- ✅ SDPOnDemand.users.ALL (but getting 404 errors)

Missing scopes we might need:
- ❌ SDPOnDemand.setup.READ (for lookup tools)
- ❌ SDPOnDemand.problems.ALL (might not exist for Cloud)
- ❌ SDPOnDemand.changes.ALL (might not exist for Cloud)

### 2. Implementation Status
From code review:
- `src/api/modules/assets.ts` - File doesn't exist
- `src/api/modules/problems.ts` - File doesn't exist
- `src/api/modules/changes.ts` - File doesn't exist
- `src/api/modules/users.ts` - Exists but might have wrong endpoints

### 3. API Endpoint Issues
- Users API returns 404 - might need different base path
- Project tasks has parameter validation issues
- Lookup endpoints might be under different path (e.g., /setup/)

## Recommendations

### Immediate Actions
1. **Restart MCP server** with refresh token to fix auth issues
2. **Add SDPOnDemand.setup.READ** scope and regenerate refresh token
3. **Test users endpoints** with API documentation

### Short Term (1-2 weeks)
1. **Implement Assets module** - We have the scope, just need code
2. **Fix Users module** - Debug 404 errors, check API docs
3. **Fix Project Tasks** - Remove pagination parameters

### Medium Term (1 month)
1. **Research Problems/Changes APIs** - Confirm if available in Cloud
2. **Implement lookup caching** - Reduce API calls for static data
3. **Add comprehensive error messages** - Help users understand issues

### Long Term
1. **Full test suite** for all tools
2. **Mock API responses** for testing without hitting rate limits
3. **Alternative implementations** for missing APIs

## Code Locations

Files to create/modify:
- `src/api/modules/assets.ts` - Create new
- `src/api/modules/problems.ts` - Create new (if API exists)
- `src/api/modules/changes.ts` - Create new (if API exists)
- `src/api/modules/users.ts` - Fix endpoints
- `src/api/modules/projects.ts` - Fix task listing
- `src/mcp/handlers.ts` - Update once modules are fixed

## Testing Checklist

When implementing fixes:
- [ ] Test with minimal parameters first
- [ ] Add parameters incrementally
- [ ] Check API documentation for exact field names
- [ ] Verify response format matches expectations
- [ ] Test error cases (404, 401, 400)
- [ ] Update MCP_TOOLS.md documentation
- [ ] Add to test suite