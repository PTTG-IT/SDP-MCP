# Implementation Plan for Non-Functional MCP Tools

## Priority Order

Based on user value and implementation complexity, here's the recommended order:

### Phase 1: Quick Fixes (1-2 days)

#### 1.1 Fix Authentication Issues
**Tools Affected**: All lookup tools (get_priorities, get_categories, etc.)

**Steps**:
1. Add `SDPOnDemand.setup.READ` to OAuth scopes
2. Regenerate refresh token with new scope
3. Test lookup tools

**Code Changes**:
- Update `VALID_SCOPES.md` with setup.READ
- Update setup instructions

#### 1.2 Fix Project Task Listing
**Tools Affected**: list_project_tasks

**Steps**:
1. Check API documentation for correct parameters
2. Remove pagination from task listing API
3. Test with working project

**Code Changes**:
```typescript
// In src/api/modules/projects.ts
async listTasks(projectId: string, filters?: any) {
  // Remove page/per_page from params
  const params = {
    input_data: JSON.stringify({
      list_info: {
        row_count: filters?.per_page || 100,
        // Don't include page parameter
      }
    })
  };
}
```

### Phase 2: User Management Fix (2-3 days)

#### 2.1 Debug Users API
**Tools Affected**: get_user, search_users

**Investigation Steps**:
1. Check if users API requires different base path
2. Test with Postman/curl to verify endpoints
3. Check if SDPOnDemand.users.ALL scope is correct

**Potential Fixes**:
```typescript
// Option 1: Different endpoint
/api/v3/users -> /api/v3/sdpusers

// Option 2: Different method
GET /users?email=x -> POST /users/search

// Option 3: Admin endpoint
/api/v3/admin/users
```

### Phase 3: Asset Management Implementation (1 week)

#### 3.1 Create Assets Module
**New File**: `src/api/modules/assets.ts`

```typescript
import { BaseAPI } from './base.js';

export interface Asset {
  id: string;
  name: string;
  asset_tag?: string;
  product: { name: string };
  vendor?: { name: string };
  user?: { email_id: string };
  // ... other fields
}

export class AssetsAPI extends BaseAPI {
  async create(data: Partial<Asset>) {
    const assetData = {
      asset: this.transformFields(data)
    };
    
    return this.post('/assets', {
      input_data: JSON.stringify(assetData)
    });
  }
  
  async update(id: string, data: Partial<Asset>) {
    // Implementation
  }
  
  async get(id: string) {
    // Implementation
  }
  
  async search(query: string, filters?: any) {
    // Implementation
  }
}
```

#### 3.2 Add Asset Handlers
**Update**: `src/mcp/handlers.ts`

```typescript
// Add to handlers
create_asset: async (args) => {
  const assetData: any = {
    name: args.name,
    product: { name: args.product }
  };
  
  if (args.asset_tag) assetData.asset_tag = args.asset_tag;
  if (args.vendor) assetData.vendor = { name: args.vendor };
  if (args.user_email) assetData.user = { email_id: args.user_email };
  
  const asset = await client.assets.create(assetData);
  return `Asset created successfully\nID: ${asset.id}\nName: ${asset.name}`;
},
```

### Phase 4: Research Problems/Changes APIs (1 week)

#### 4.1 Verify API Availability
**Research Tasks**:
1. Check SDP Cloud documentation for Problems API
2. Check SDP Cloud documentation for Changes API
3. Test endpoints with Postman
4. Confirm scope requirements

**If APIs exist**:
- Implement similar to Assets module
- Add proper error handling
- Update documentation

**If APIs don't exist**:
- Document in MCP_TOOLS.md as "Not available in Cloud"
- Remove from tool list
- Suggest alternatives (use Requests for problems)

## Implementation Schedule

### Week 1
- [ ] Monday: Fix authentication (add setup.READ scope)
- [ ] Tuesday: Fix project task listing
- [ ] Wednesday: Debug users API
- [ ] Thursday: Implement users fix
- [ ] Friday: Start assets module

### Week 2
- [ ] Monday-Tuesday: Complete assets module
- [ ] Wednesday: Test assets thoroughly
- [ ] Thursday: Research problems/changes APIs
- [ ] Friday: Document findings, plan next steps

## Testing Strategy

### For Each Fixed Tool:
1. **Unit Test** - Test API module in isolation
2. **Integration Test** - Test through MCP handler
3. **Manual Test** - Test with Claude/MCP client
4. **Error Test** - Test with invalid data
5. **Document** - Update MCP_TOOLS.md

### Test Data Needed:
- Valid project ID with tasks
- Valid user emails in system
- Asset information for testing
- Problem/change test scenarios

## Success Metrics

### Phase 1 Success:
- All lookup tools return data
- Project tasks list properly

### Phase 2 Success:
- User search returns results
- Get user by email works

### Phase 3 Success:
- Can create, update, search assets
- Asset assignment works

### Phase 4 Success:
- Clear documentation on problems/changes
- Implementation if APIs exist

## Risk Mitigation

### Risk: Scope Changes Break Auth
**Mitigation**: Document exact working scopes, test incrementally

### Risk: API Endpoints Different Than Expected
**Mitigation**: Use Postman first, verify with curl

### Risk: Rate Limiting During Testing
**Mitigation**: Implement caching, use test data

### Risk: Breaking Existing Tools
**Mitigation**: Comprehensive test suite, gradual rollout

## Next Steps

1. **Immediate**: Get new refresh token with setup.READ scope
2. **Today**: Fix project task listing
3. **This Week**: Debug and fix users API
4. **Next Week**: Implement assets module

## Notes for Implementation

- Always check response format before assuming structure
- Use TypeScript interfaces for all API responses
- Add proper error messages for common failures
- Update documentation as you go
- Test with minimal data first, then add complexity