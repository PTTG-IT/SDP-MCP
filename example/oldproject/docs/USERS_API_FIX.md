# Users API Fix Documentation

## Problem
The Service Desk Plus Cloud API v3 returned 404 errors for the generic `/users` endpoint. Research revealed that users are split into two distinct endpoints:
- `/requesters` - Regular users who submit requests
- `/technicians` - Support staff who handle requests

## Solution Implemented

### 1. Created Separate API Modules
- `src/api/modules/requesters.ts` - Handles requester operations
- `src/api/modules/technicians.ts` - Handles technician operations
- Removed the generic `users.ts` module

### 2. Updated Client Integration
- Modified `src/api/client.ts` to use `requesters` and `technicians` instead of `users`
- Updated exports in `src/exports.ts`
- Fixed `src/api/optimizedClient.ts` to wrap the new modules

### 3. Enhanced MCP Handlers
The `get_user` and `search_users` handlers now:
- Search both requesters and technicians
- Return a unified response with `user_type` field
- Handle cases where a user might exist in either category

### 4. Updated Lookup Handler
Modified `get_technicians` in `src/mcp/handlers/lookups.ts` to use the technicians API directly.

## API Usage Examples

### JavaScript/TypeScript
```typescript
// Search for requesters
const requesters = await client.requesters.search('john@example.com');

// Search for technicians  
const technicians = await client.technicians.search('support@example.com');

// List all requesters
const allRequesters = await client.requesters.list({ per_page: 100 });

// List all technicians
const allTechnicians = await client.technicians.list({ per_page: 100 });

// Get specific requester
const requester = await client.requesters.get('123456');

// Get specific technician
const technician = await client.technicians.get('789012');
```

### MCP Tools
```typescript
// Search users (searches both requesters and technicians)
{
  "tool": "search_users",
  "arguments": {
    "query": "john",
    "limit": 20
  }
}

// Get user by ID or email (checks both types)
{
  "tool": "get_user", 
  "arguments": {
    "email": "john@example.com"
  }
}

// Get all technicians
{
  "tool": "get_technicians",
  "arguments": {}
}
```

## Response Format

### Requester Object
```typescript
{
  id: string;
  name: string;
  email_id?: string;
  phone?: string;
  mobile?: string;
  department?: {
    id: string;
    name: string;
  };
  job_title?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  is_vipuser?: boolean;
  site?: {
    id: string;
    name: string;
  };
}
```

### Technician Object
```typescript
{
  id: string;
  name: string;
  email_id?: string;
  phone?: string;
  mobile?: string;
  department?: {
    id: string;
    name: string;
  };
  job_title?: string;
  first_name?: string;
  last_name?: string;
  is_technician?: boolean;
  login_name?: string;
  site?: {
    id: string;
    name: string;
  };
}
```

### Unified MCP Response
The MCP handlers return a unified format with `user_type` field:
```typescript
{
  id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  department?: string;
  job_title?: string;
  user_type: 'requester' | 'technician';
  is_vip: boolean;
  is_technician: boolean;
}
```

## Testing Results
- ✅ Requester search API works
- ✅ Technician search API works  
- ✅ Requester list API works
- ✅ Technician list API works
- ✅ MCP handlers properly search both types
- ✅ Unified response format implemented

## Notes
1. The search functionality uses the `email_id` and `name` fields for matching
2. VIP status is only applicable to requesters (`is_vipuser` field)
3. Site information is available for both requesters and technicians
4. The MCP tools provide a unified interface that searches both types automatically