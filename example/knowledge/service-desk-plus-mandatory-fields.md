# Service Desk Plus Mandatory Fields Guide

## Overview

Service Desk Plus instances can be configured to require specific mandatory fields when creating or updating requests. This guide documents common mandatory fields and how to handle error 4012.

## Error 4012: Value for mandatory-field is not provided

This error occurs when required fields are missing from API requests. The error response includes which fields are missing:

```json
{
  "response_status": {
    "status_code": 4000,
    "messages": [
      {
        "status_code": 4012,
        "type": "failed",
        "fields": ["mode", "request_type", "urgency", "level", "impact", "category", "subcategory", "status"]
      }
    ],
    "status": "failed"
  }
}
```

## Common Mandatory Fields

### 1. Mode
The channel through which the request was received:
- `{ name: "Web Form" }` - Request via web portal
- `{ name: "E-Mail" }` - Request via email
- `{ name: "Phone Call" }` - Request via phone
- `{ name: "MS Teams" }` - Request via Microsoft Teams

### 2. Request Type
The type of request:
- `{ name: "Incident" }` - Something is broken
- `{ name: "Request" }` - Need something new

### 3. Urgency
How urgent the request is:
- `{ name: "1 - Suggestion" }` - Low urgency
- `{ name: "2 - General Concern" }` - Normal urgency
- `{ name: "3 - Have Workaround" }` - High urgency
- `{ name: "4 - Dead in the Water" }` - Critical urgency

### 4. Level
Support tier level:
- `{ name: "1 - Frontline" }` - Basic support
- `{ name: "2 - Technician" }` - Expert support
- `{ name: "3 - Engineer" }` - Engineering support
- `{ name: "4 - Executive" }` - Executive escalation

### 5. Impact
Who is affected:
- `{ name: "1 - Affects User" }` - Single user
- `{ name: "2 - Affects Group" }` - Group of users
- `{ name: "3 - Affects Department" }` - Entire department
- `{ name: "4 - Affects Business" }` - Business-wide impact

### 6. Priority
Request priority (exact values vary by instance):
- `{ name: "1 - Low" }`
- `{ name: "2 - Normal" }`
- `{ name: "3 - High" }`
- `{ name: "4 - Critical" }`

Note: Some instances use different naming like "z - Medium" instead of numeric prefixes.

### 7. Category & Subcategory
Request categorization:
- `{ name: "Software" }` - Software issues
- `{ name: "Hardware" }` - Hardware issues
- `{ name: "Access" }` - Access/permission requests
- `{ name: "Data/Reporting" }` - Data or report requests

## Example Create Request

```javascript
const request = {
  subject: "Need software installation",
  description: "Please install Visual Studio Code",
  mode: { name: "Web Form" },
  request_type: { name: "Request" },
  urgency: { name: "2 - General Concern" },
  level: { name: "1 - Frontline" },
  impact: { name: "1 - Affects User" },
  category: { name: "Software" },
  status: { name: "Open" },
  priority: { name: "2 - Normal" },
  requester: { email_id: "user@company.com" }
};
```

## Best Practices

1. **Use get_metadata API** to retrieve valid values for your instance
2. **Store common values** in configuration for reuse
3. **Handle errors gracefully** by parsing the error response
4. **Provide defaults** for non-critical fields
5. **Validate requester email** exists in the system

## Troubleshooting

### Priority Field Issues
Some instances reject priority fields even with valid IDs. Solutions:
- Try using name format instead of ID: `{ name: "2 - Normal" }`
- Check if priority is truly mandatory for your instance
- Use the exact format returned by get_metadata

### Requester Validation
Error 4001 on requester field means:
- Email doesn't exist in the system
- Email format is invalid
- User is inactive/deleted

### Category Mismatch
Ensure subcategory matches the parent category. Invalid combinations will fail.

## Configuration Detection

To detect which fields are mandatory for your instance:

1. Try creating a minimal request with only subject
2. Parse the error response to get the list of mandatory fields
3. Use get_metadata to find valid values for each field
4. Cache the configuration for future use

## References

- [API Error Codes](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/common-error-code.html)
- [Request API Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/requests/request.html)