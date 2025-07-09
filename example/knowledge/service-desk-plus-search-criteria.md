# Service Desk Plus Search Criteria and List Optimization Guide

## Overview

This guide documents the powerful search capabilities of Service Desk Plus API v3, including search criteria syntax, pagination strategies, and optimization techniques for list operations.

## List Info Structure

The `list_info` object controls how data is retrieved and paginated:

```javascript
{
  "list_info": {
    "row_count": 100,          // Max 100 per API limits
    "start_index": 1,          // Starting row (1-based)
    "page": 1,                 // Alternative to start_index
    "sort_field": "created_time",
    "sort_order": "desc",
    "get_total_count": true,   // Get total record count
    "search_criteria": [...],  // Search conditions
    "fields_required": [...]   // Limit fields returned
  }
}
```

## Search Criteria Basics

### Simple Search
```javascript
{
  "field": "subject",
  "condition": "contains",
  "value": "printer"
}
```

### Supported Conditions

| Description | Operator | Short Hand |
|------------|----------|------------|
| Equals | `is` | `=`, `eq` |
| Not Equal | `is not` | `!=`, `neq` |
| Greater than | `greater than` | `gt` |
| Greater or Equal | `greater or equal` | `gte` |
| Less than | `lesser than` | `lt` |
| Less or Equal | `lesser or equal` | `lte` |
| Range | `between` | |
| Not in Range | `not between` | |
| Starts with | `starts with` | |
| Ends with | `ends with` | |
| Contains | `contains` | |
| Not Contains | `not contains` | |

### Field Paths

You can search on nested fields using dot notation:
- `status.name` - Status name
- `status.internal_name` - Internal status identifier
- `priority.name` - Priority name
- `requester.email_id` - Requester's email
- `technician.name` - Assigned technician
- `group.name` - Group name

## Complex Search Examples

### AND Condition
Search for open tickets created in the last 7 days:

```javascript
{
  "list_info": {
    "row_count": 100,
    "search_criteria": {
      "field": "status.name",
      "condition": "is",
      "value": "Open",
      "children": [{
        "field": "created_time",
        "condition": "greater than",
        "value": "1488451440000",
        "logical_operator": "AND"
      }]
    }
  }
}
```

### OR Condition
Search for high priority OR critical tickets:

```javascript
{
  "list_info": {
    "search_criteria": [{
      "field": "priority.name",
      "condition": "is",
      "value": "3 - High"
    }, {
      "field": "priority.name",
      "condition": "is",
      "value": "4 - Critical",
      "logical_operator": "OR"
    }]
  }
}
```

### Multiple Values
Search for tickets in specific groups:

```javascript
{
  "field": "group.name",
  "condition": "is",
  "values": ["Network", "Hardware", "Software"]
}
```

### Complex Nested Criteria
Open tickets in Network group created today:

```javascript
{
  "list_info": {
    "search_criteria": [{
      "field": "group.name",
      "condition": "is",
      "values": ["Network"]
    }, {
      "field": "status.internal_name",
      "condition": "is",
      "logical_operator": "and",
      "values": ["Open"]
    }, {
      "field": "created_time",
      "condition": "greater than",
      "logical_operator": "and",
      "values": ["1553731200000"],
      "children": [{
        "field": "created_time",
        "condition": "lesser than",
        "logical_operator": "and",
        "values": ["1553817599000"]
      }]
    }]
  }
}
```

## Pagination Strategies

### Using start_index
```javascript
// Page 1: rows 1-100
{ "row_count": 100, "start_index": 1 }

// Page 2: rows 101-200
{ "row_count": 100, "start_index": 101 }

// Calculate next page:
// start_index (new) = start_index (previous) + row_count
```

### Using page (Easier)
```javascript
// Page 1
{ "row_count": 100, "page": 1 }

// Page 2
{ "row_count": 100, "page": 2 }
```

## Optimization Techniques

### 1. Limit Fields Returned
Use `fields_required` to only get needed fields:

```javascript
{
  "list_info": {
    "row_count": 100,
    "fields_required": ["id", "subject", "status", "priority", "created_time"]
  }
}
```

### 2. Use Specific Field Paths
Instead of loading full objects, search on specific fields:
- Use `status.internal_name` instead of loading full status object
- Use `technician.name` for display purposes

### 3. Batch Operations
Process records in batches of 100 (API maximum):

```javascript
async function getAllRequests(client) {
  const results = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await client.advancedSearchRequests(
      [{ field: "status.name", condition: "is", value: "Open" }],
      { limit: 100, page }
    );
    
    results.push(...response.requests);
    hasMore = response.has_more;
    page++;
  }
  
  return results;
}
```

### 4. Use Indexed Fields
These fields are typically indexed and search faster:
- `id`
- `created_time`
- `status.internal_name`
- `requester.email_id`

## Common Query Patterns

### Recent Tickets
```javascript
const lastWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
{
  "field": "created_time",
  "condition": "greater than",
  "value": lastWeek.toString()
}
```

### Unassigned Tickets
```javascript
{
  "field": "technician",
  "condition": "is not"
}
```

### My Tickets (by email)
```javascript
{
  "field": "requester.email_id",
  "condition": "is",
  "value": "user@example.com"
}
```

### Overdue Tickets
```javascript
[{
  "field": "due_by_time",
  "condition": "lesser than",
  "value": Date.now().toString()
}, {
  "field": "status.name",
  "condition": "is not",
  "values": ["Closed", "Resolved"],
  "logical_operator": "AND"
}]
```

## Error Handling

### Common Search Errors

1. **Invalid field path**: Check API documentation for valid field names
2. **Invalid condition**: Use only supported operators
3. **Type mismatch**: Ensure value types match field types (string, number, boolean)
4. **Syntax errors**: Validate JSON structure

### Debugging Tips

1. Start with simple criteria and build complexity
2. Test field paths individually
3. Use API explorer to validate queries
4. Check response for actual field names

## Performance Considerations

1. **Row Count**: Always specify `row_count` (max 100)
2. **Total Count**: Only use `get_total_count: true` when needed
3. **Field Limiting**: Use `fields_required` to reduce payload size
4. **Caching**: Cache metadata like statuses, priorities, categories
5. **Parallel Requests**: Avoid parallel requests that might hit rate limits

## Implementation Example

```javascript
// Enhanced search implementation
class SDPSearchBuilder {
  constructor() {
    this.criteria = [];
  }
  
  where(field, condition, value) {
    this.criteria.push({ field, condition, value });
    return this;
  }
  
  and(field, condition, value) {
    this.criteria.push({ 
      field, 
      condition, 
      value, 
      logical_operator: 'AND' 
    });
    return this;
  }
  
  or(field, condition, value) {
    this.criteria.push({ 
      field, 
      condition, 
      value, 
      logical_operator: 'OR' 
    });
    return this;
  }
  
  build() {
    return this.criteria;
  }
}

// Usage
const search = new SDPSearchBuilder()
  .where('status.name', 'is', 'Open')
  .and('priority.name', 'is', '3 - High')
  .and('created_time', 'greater than', lastWeek)
  .build();
```

## Best Practices

1. **Use search_criteria instead of filter_by** - More powerful and flexible
2. **Prefer field paths** - `status.name` over loading full status object
3. **Batch large operations** - Process in chunks of 100
4. **Cache metadata** - Store frequently used values like status/priority IDs
5. **Monitor API limits** - Track usage to avoid rate limiting
6. **Use appropriate operators** - `contains` for text search, `is` for exact match
7. **Test incrementally** - Build complex queries step by step

## References

- [Service Desk Plus API v3 Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)
- [API Input Data Format](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/input-data.html)
- [Search Criteria Examples](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/search-criteria.html)