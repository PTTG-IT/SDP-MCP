# Troubleshooting Guide

This guide helps resolve common issues when using the Service Desk Plus Cloud API MCP Server.

## Common Issues

### Authentication Errors

#### 404 Error on OAuth Token Request

**Symptom:** Getting 404 errors when trying to authenticate.

**Cause:** Service Desk Plus Cloud uses Zoho's central OAuth server, not the instance's OAuth endpoint.

**Solution:** The API client is configured to use `https://accounts.zoho.com/oauth/v2/token` for authentication. This is handled automatically.

#### Invalid Client Credentials

**Symptom:** Authentication fails with "invalid_client" error.

**Solution:**
1. Verify your Client ID and Client Secret are correct
2. Check your OAuth app in Zoho API Console: https://api-console.zoho.com/
3. Ensure credentials are properly set in your `.env` file
4. Verify you're using the correct Zoho data center for your region

### API Request Errors

#### 415 Unsupported Media Type

**Symptom:** API requests fail with 415 error.

**Cause:** Missing or incorrect Accept header.

**Solution:** The API requires the Accept header: `application/vnd.manageengine.sdp.v3+json`. This is set automatically by the client.

#### 400 Bad Request with "status_code": 4000

**Symptom:** Requests return 400 error with validation failures.

**Cause:** Incorrect parameter format, often with pagination parameters.

**Solution:** The API uses `input_data` parameter with JSON structure for pagination:
```json
{
  "list_info": {
    "row_count": 10,
    "start_index": 1
  }
}
```

The client handles this conversion automatically when you use standard pagination parameters.

### Configuration Issues

#### Cannot Find Instance Name

**Symptom:** Not sure what to use for `SDP_INSTANCE_NAME`.

**Solution:**
1. Log into your Service Desk Plus instance
2. Go to Admin > Instance Settings
3. Look for "URL Name" or "Instance Name"
4. This is typically the subdomain part of your URL

**Example:** If your URL is `https://helpdesk.company.com/app/itdesk/`, then `itdesk` is your instance name.

#### Incorrect Base URL Format

**Symptom:** API calls fail with various errors.

**Solution:** 
- Use only the base domain without `/app/` or `/api/`
- ✅ Correct: `https://helpdesk.company.com`
- ❌ Wrong: `https://helpdesk.company.com/app/itdesk`
- ❌ Wrong: `https://helpdesk.company.com/api/v3`

### Rate Limiting

**Symptom:** Getting rate limit errors.

**Solution:**
1. The client includes automatic rate limiting (default: 60 requests/minute)
2. Adjust `SDP_RATE_LIMIT_PER_MINUTE` in your `.env` file if needed
3. The client will automatically retry with exponential backoff

### MCP Server Issues

#### MCP Server Not Connecting

**Symptom:** Claude or other MCP clients can't connect to the server.

**Solution:**
1. Ensure the server is built: `npm run build`
2. Check the path in your MCP client configuration points to `dist/index.js`
3. Verify all environment variables are properly set in the MCP client config

#### Tools Not Working

**Symptom:** MCP tools fail with various errors.

**Solution:**
1. Check the server logs for detailed error messages
2. Verify your OAuth scopes include necessary permissions
3. Ensure the API modules are properly initialized

### Response Format Issues

#### Dates Showing as Objects

**Symptom:** Date fields display as `[object Object]` instead of readable dates.

**Solution:** SDP returns dates in a structured format:
```javascript
{
  "display_value": "Aug 29, 2024 07:12 AM",
  "value": "1724933550406"
}
```

Use the `display_value` property for human-readable dates.

## Debugging Tips

### Enable Detailed Logging

Set environment variable for more verbose output:
```bash
MCP_LOG_LEVEL=debug npm start
```

### Test Connection Directly

Create a simple test script to verify connectivity:
```javascript
import { SDPClient } from './dist/api/client.js';
import { loadConfig } from './dist/utils/config.js';

const config = loadConfig();
const client = new SDPClient(config);

try {
  const requests = await client.requests.list({ per_page: 1 });
  console.log('Success!', requests);
} catch (error) {
  console.error('Failed:', error.message, error.details);
}
```

### Check API Documentation

Always refer to the official Service Desk Plus API documentation:
https://www.manageengine.com/products/service-desk/sdpod-v3-api/

### Required Fields for Creating Requests

**Symptom:** Getting validation errors when creating requests with "fields" array listing required fields.

**Solution:** Service Desk Plus requires these fields for new requests:
- `mode`: How the request was submitted (e.g., "E-Mail", "Web Form")
- `request_type`: Type of request (e.g., "Request", "Incident")
- `urgency`: Urgency level (e.g., "3 - Have Workaround")
- `level`: Support level (e.g., "1 - Frontline")
- `impact`: Impact level (e.g., "1 - Affects User")
- `category`: Request category (e.g., "General", "Hardwre" - note the spelling)
- `subcategory`: Request subcategory (e.g., "General", "Computer")
- `status`: Initial status (typically "Open")

The MCP tool now includes these as defaults when creating requests.

### Field Name Differences

**Symptom:** "EXTRA_KEY_FOUND_IN_JSON" errors when creating or updating requests.

**Solution:** Service Desk Plus uses specific field names:
- Use `email_id` instead of `email` for user objects
- Use `email_id` for technician assignment (not `email`)
- Date fields use structured format with `display_value` and `value` properties

### Closing Requests

**Symptom:** Requests won't close or remain in "Open" status after attempting to close.

**Solution:** To close a request in Service Desk Plus:
1. The request must have a technician assigned
2. You must update the status to "Closed" (ID: 216826000000006661)
3. Include `closure_info` with:
   - `closure_code`: (e.g., "Completed" with ID: 216826000000090001)
   - `closure_comments`: Resolution description
4. Use the update endpoint, not the close endpoint (which may not work as expected)

**Example:**
```javascript
await client.requests.update(requestId, {
  status: { name: "Closed", id: "216826000000006661" },
  technician: { email_id: "tech@company.com" },
  closure_info: {
    closure_code: { name: "Completed", id: "216826000000090001" },
    closure_comments: "Issue resolved"
  }
});
```

### API Data Format

**Symptom:** Getting 415 Unsupported Media Type or 400 Bad Request errors.

**Solution:** Service Desk Plus API requires:
- POST/PUT data must be sent as URL-encoded with `input_data` parameter
- The actual data should be JSON-stringified inside `input_data`
- Use `Content-Type: application/x-www-form-urlencoded`

**Example:**
```javascript
const params = new URLSearchParams();
params.append('input_data', JSON.stringify({ request: data }));
```

## Getting Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/your-repo/issues) for similar problems
2. Review the official [SDP API documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)
3. Enable debug logging and check the detailed error messages
4. Create a new issue with:
   - Error messages
   - Your configuration (without secrets)
   - Steps to reproduce