# Service Desk Plus MCP Server - API Issues Fix Summary

## Issues Found and Fixed

### 1. Search Requests (✅ FIXED)
**Problem**: The `search_criteria` was using array format which caused 400 errors.

**Solution**: Changed to object format for single criteria:
```javascript
// Before (incorrect):
search_criteria: [{
  field: 'subject',
  condition: 'contains',
  value: query
}]

// After (correct):
search_criteria: {
  field: 'subject',
  condition: 'contains',
  value: query
}
```

**File Updated**: `src/sdp-api-client-v2.cjs` - `searchRequests()` method

### 2. Subcategories (✅ FIXED)
**Problem**: No method to retrieve valid subcategories for a given category.

**Solution**: Added methods to metadata client:
- `getSubcategories(categoryId)` - Retrieves subcategories for a category
- `getSubcategoryId(categoryId, subcategoryName)` - Gets subcategory ID by name

**Endpoint**: `/categories/{categoryId}/subcategories`

**File Updated**: `src/sdp-api-metadata.cjs`

### 3. Technicians Endpoint (⚠️ PARTIAL FIX)
**Problem**: The `/technicians` endpoint returns 401 Unauthorized.

**Analysis**: 
- The `/technicians` endpoint doesn't exist in SDP Cloud
- The `/users` endpoint also returns 401, suggesting missing OAuth scope
- Required scope: `SDPOnDemand.users.READ`

**Solution**: Updated to use `/users` endpoint, but OAuth scope needs to be added to the token.

**File Updated**: `src/sdp-api-users.cjs`

### 4. Request Creation - Requester Field (❌ NEEDS FIX)
**Problem**: Requester field validation fails with error 4001.

**Root Cause**: The email address must exist in the Service Desk Plus system. Test emails like `test@example.com` don't exist.

**Solution Options**:
1. Use a known requester ID from existing requests
2. Use the default requester configured in the system
3. Create a test user in SDP first

## Implementation Notes

### Search Implementation
The Service Desk Plus API expects different formats for search criteria:
- **Single criterion**: Use object format
- **Multiple criteria**: Use array format with logical operators

### Subcategory Requirements
- When a category is specified, subcategory becomes mandatory
- Each category has its own set of valid subcategories
- Use the metadata API to retrieve valid values

### OAuth Scope Requirements
Current implementation needs these scopes:
- `SDPOnDemand.requests.ALL` - For request operations
- `SDPOnDemand.users.READ` - For technician/user lookups (missing)
- `SDPOnDemand.problems.ALL` - For problem operations
- `SDPOnDemand.changes.ALL` - For change operations

## Next Steps

1. **Add OAuth Scope**: Request `SDPOnDemand.users.READ` scope for the OAuth token
2. **Fix Requester Validation**: 
   - Option A: Use the mock API for testing (`SDP_USE_MOCK_API=true`)
   - Option B: Get a valid requester ID from existing requests
   - Option C: Use a known email address that exists in the system
3. **Update Working SSE Server**: Ensure all fixes are applied to the production server

## Testing

Use the provided test scripts:
- `scripts/test-api-issues.cjs` - Tests all three issues
- `scripts/test-search-formats.cjs` - Tests search formats
- `scripts/test-fixes.cjs` - Comprehensive test of all fixes
- `scripts/test-real-api-formats.cjs` - Tests with real API data

## Files Modified

1. `/Users/kalten/projects/SDP-MCP/sdp-mcp-server/src/sdp-api-client-v2.cjs`
   - Fixed `searchRequests()` method to use object format
   - Enhanced `createRequest()` to handle object-format categories

2. `/Users/kalten/projects/SDP-MCP/sdp-mcp-server/src/sdp-api-metadata.cjs`
   - Added `getSubcategories()` method
   - Added `getSubcategoryId()` method

3. `/Users/kalten/projects/SDP-MCP/sdp-mcp-server/src/sdp-api-users.cjs`
   - Removed `/technicians` endpoint attempts
   - Updated to use `/users` endpoint only
   - Removed broken filter_by logic

## Known Limitations

1. **OAuth Scopes**: The current token is missing `SDPOnDemand.users.READ` scope
2. **Requester Validation**: Emails must exist in the SDP system
3. **Rate Limiting**: Be careful with token refresh attempts to avoid rate limits