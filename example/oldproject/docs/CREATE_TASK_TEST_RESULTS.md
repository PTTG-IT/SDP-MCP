# Create Task Test Results

## Summary
Testing the `create_task` MCP tool revealed several issues that need to be addressed.

## Findings

### 1. Duplicate Projects
Found 2 projects with the name "Service Desk Plus MCP Server Development":
- **Project 1** (Newer): ID 216826000006339009, Status: New, Created: Jul 4, 2025 06:20 PM
- **Project 2** (Older): ID 216826000006345021, Status: Open, Created: Jul 4, 2025 08:54 PM

We should use the older project (216826000006345021) as the main project.

### 2. Project Closure Issues
Attempted to close the duplicate project but encountered validation errors. Need to investigate:
- Valid status values for projects
- Whether "Closed" or "Cancelled" is the correct status
- Required fields for project updates

### 3. Task Creation Issues

#### Date Format Problem
Initial attempt failed with date parsing error:
```json
{
  "status_code": 4001,
  "field": "scheduled_start_time",
  "message": "Unable to parse JSON for : scheduled_start_time"
}
```

**Solution**: Use `toSDPDate()` utility to convert dates to proper format:
```javascript
scheduled_start_time: toSDPDate(new Date())
// Produces: { value: "1751719890970", display_value: "Jul 5, 2025 7:51 AM" }
```

#### Authentication Loop
After fixing date format, encountered authentication failure with request retry loop. This appears to be related to token refresh logic.

#### OAuth Rate Limiting
Hit the OAuth rate limit: "You have made too many requests continuously"
- Limit is 10 token requests per 10 minutes
- Need to wait before retrying

## Code Issues Found

### 1. ProjectsAPI.createTask
The method signature doesn't match MCP handler expectations:
- API expects: `createTask(data: CreateTaskInput)`
- Handler passes: `createTask(projectId, data)`

### 2. Date Field Names
MCP handler uses different field names than API:
- Handler: `scheduled_start`, `scheduled_end`
- API: `scheduled_start_time`, `scheduled_end_time`

### 3. Required Fields
The CreateTaskInput type shows these fields:
```typescript
export interface CreateTaskInput {
  title: string;
  description?: string;
  project: { id: string };  // Note: nested object, not project_id
  milestone?: { id: string };
  owner?: { id: string } | { email_id: string };
  group?: { id: string } | { name: string };
  status?: { id: string } | { name: string };
  priority?: { id: string } | { name: string };
  task_type?: { id: string } | { name: string };
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  estimated_hours?: number;
  parent_task?: { id: string };
}
```

## Recommendations

### Immediate Fixes Needed
1. Update MCP handler to use correct field names
2. Fix date conversion in handler
3. Remove projectId parameter mismatch
4. Add better error handling for OAuth rate limits

### Testing Strategy
1. Wait 10+ minutes for OAuth rate limit to reset
2. Test with minimal required fields first
3. Add optional fields incrementally
4. Verify task appears in project

### Handler Fix Required
The `create_task` handler in `src/mcp/handlers.ts` needs to be updated to properly format the data before calling the API.

## Next Steps
1. Fix the create_task handler implementation
2. Wait for rate limit reset
3. Test again with corrected implementation
4. Update tool status if successful