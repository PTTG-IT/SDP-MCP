# Service Desk Plus API Status Codes Reference

## Overview

Status codes are used to indicate success or failure of an API call. In general:
- Status codes starting with **2** mean success
- Status codes starting with **4** mean there was an error in the provided information
- Status codes starting with **5** indicate server side errors

## Complete Status Code Reference

| Status Code | HTTP Status Code | Description | Common Causes |
|-------------|------------------|-------------|---------------|
| **200** | 200 | Success | Operation completed successfully |
| **4001** | 400 | Id or Name given in Input does not exist or not in use or user cannot set the value | • Invalid requester email<br>• Non-existent category/priority ID<br>• Invalid field value |
| **4002** | 403 | Forbidden / User not allowed to perform the operation | • Missing OAuth scope<br>• Insufficient permissions<br>• Business rule violation |
| **4004** | 500 | Internal Error (Exact error cannot be sent to user, like some Exception) | • Server-side processing error<br>• Database connectivity issues |
| **4005** | 400 | Reference Exists (Cannot delete an entity, because it is being used in another module) | • Trying to delete a category in use<br>• Deleting user with open tickets |
| **4007** | 404 | Invalid URL or Resource not found | • Wrong endpoint path<br>• Non-existent resource ID<br>• Endpoint not available |
| **4008** | 400 | Not Unique | • Duplicate entry<br>• Unique constraint violation |
| **4009** | 400 | Trying to edit non-editable field | • Modifying system fields<br>• Changing immutable properties |
| **4012** | 400 | Value for mandatory-field is not provided | • Missing required fields<br>• Empty mandatory fields<br>• Missing subcategory |
| **4014** | 400 | Trying to edit read-only field | • Modifying ID fields<br>• Changing computed fields |
| **4015** | 429 | API Rate Limit reached | • Too many requests<br>• Exceeded quota |
| **4016** | 400 | Time mismatch | • Start time > End time<br>• Created time > Responded time<br>• Invalid date ranges |
| **4021** | 400 | Data type mismatch | • String instead of number<br>• Invalid date format<br>• Wrong field type |
| **4022** | 401 | Invalid API Key | • Wrong OAuth token<br>• Expired access token<br>• Invalid authorization header |
| **7001** | 400 | Not allowed as per current license | • Feature not in license<br>• Exceeded license limits |

## Common Error Patterns

### Authentication Errors (401)
```json
{
  "response_status": {
    "status_code": 4022,
    "status": "failed",
    "messages": [{
      "message": "Invalid API Key"
    }]
  }
}
```

### Validation Errors (400)
```json
{
  "response_status": {
    "status_code": 4012,
    "status": "failed",
    "messages": [{
      "status_code": 4012,
      "type": "failed",
      "fields": ["subcategory", "requester"]
    }]
  }
}
```

### Permission Errors (403)
```json
{
  "response_status": {
    "status_code": 4002,
    "status": "failed",
    "messages": [{
      "field": "priority",
      "message": "Cannot give value for priority",
      "type": "failed"
    }]
  }
}
```

## Error Handling Best Practices

### 1. Check Specific Status Codes
```javascript
if (error.response?.data?.response_status?.status_code === 4012) {
  // Handle missing mandatory fields
  const missingFields = error.response.data.response_status.messages[0].fields;
  console.error(`Missing required fields: ${missingFields.join(', ')}`);
}
```

### 2. Handle Field-Specific Errors
```javascript
if (error.response?.data?.response_status?.status_code === 4001) {
  const messages = error.response.data.response_status.messages;
  messages.forEach(msg => {
    console.error(`Field ${msg.field}: ${msg.message}`);
  });
}
```

### 3. Don't Refresh Token on Non-Auth Errors
```javascript
// Only refresh on actual authentication errors
if (statusCode === 4022 || 
    (httpStatus === 401 && !statusCode)) {
  // Refresh token
} else {
  // Handle other errors without token refresh
}
```

## Common Solutions by Status Code

### 4001 - Invalid Field Value
- Verify email addresses exist in SDP
- Check that IDs are valid
- Use get_metadata to get valid values

### 4002 - Forbidden
- Check OAuth scopes match operation
- Verify user permissions
- Check business rules (e.g., can't update closed tickets)

### 4012 - Missing Mandatory Fields
- Check instance-specific required fields
- Common mandatory fields: subcategory, requester
- Use appropriate defaults

### 4015 - Rate Limit
- Implement exponential backoff
- Cache responses when possible
- Use bulk operations

### 4021 - Data Type Mismatch
- Ensure numbers are not strings
- Use proper date formats (epoch milliseconds)
- Check boolean vs string values

## OAuth-Specific Error Handling

### Token Expiry Pattern
```javascript
// Access token expires after 1 hour
if (error.response?.status === 401) {
  const errorCode = error.response.data?.response_status?.status_code;
  
  if (errorCode === 4022) {
    // Invalid/expired token - refresh needed
    await refreshToken();
  } else {
    // Other 401 error (missing scope, endpoint)
    // Don't refresh token
  }
}
```

### Rate Limit for Token Refresh
- Maximum 5 refresh requests per minute
- Maximum 20 refresh tokens per account
- Error: "You have made too many requests continuously"

## Testing Error Conditions

### Trigger Specific Errors
```javascript
// Trigger 4001 - Invalid requester
{
  requester: { email_id: "nonexistent@example.com" }
}

// Trigger 4012 - Missing mandatory field
{
  subject: "Test",
  // Missing subcategory when required
}

// Trigger 4002 - Forbidden operation
// Try to update priority on any ticket
{
  priority: { name: "High" }
}
```

## References

- [Service Desk Plus API Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)
- [Error Handling Guide](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/error-handling.html)
- HTTP Status Codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status