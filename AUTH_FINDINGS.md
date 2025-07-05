# Service Desk Plus Cloud API Authentication Findings

## Summary

During implementation, we discovered several important details about SDP Cloud OAuth 2.0 authentication that differ from standard implementations:

## Key Findings

### 1. OAuth Token Request Rate Limiting
- **Limit**: Maximum 10 OAuth token requests per 10 minutes
- **Error**: "You have made too many requests continuously. Please try again after some time."
- **Solution**: Implemented singleton TokenStore to share tokens across all client instances

### 2. Authorization Header Format
- **Expected**: `Authorization: Bearer {token}`
- **NOT**: `Authorization: Zoho-oauthtoken {token}` (despite some documentation suggesting this)

### 3. Grant Type Limitations
- **client_credentials** grant type has limited scope support
- **Working scope**: `SDPOnDemand.requests.ALL`
- **Not working with client_credentials**: 
  - `SDPOnDemand.projects.ALL`
  - `SDPOnDemand.admin.ALL`
  - Multiple scopes together
- **Error**: Returns `{"error": "invalid_scope"}` with 200 OK status

### 4. Full Access Requirements
For full API access (all modules), you need to implement the **authorization_code** flow:
1. Redirect user to Zoho authorization page
2. User grants permissions
3. Receive authorization code
4. Exchange code for access/refresh tokens

## Implementation Details

### TokenStore Singleton
```typescript
export class TokenStore {
  private static instance: TokenStore;
  
  // Tracks OAuth requests to prevent hitting rate limit
  private tokenRequestCount = 0;
  private tokenRequestResetTime: Date = new Date();
  
  canRequestToken(): boolean {
    const now = new Date();
    // Reset counter if 10 minutes have passed
    if (this.tokenRequestResetTime < now) {
      this.tokenRequestCount = 0;
      this.tokenRequestResetTime = new Date(now.getTime() + 10 * 60 * 1000);
    }
    return this.tokenRequestCount < 10;
  }
}
```

### Current Limitations
With `client_credentials` grant type, only the following modules work:
- ✅ Requests API
- ❌ Projects API
- ❌ Assets API
- ❌ Problems API
- ❌ Changes API
- ❌ Users API (admin scope)

## Recommendations

1. **For Development/Testing**: Use `client_credentials` with limited scope
2. **For Production**: Implement full `authorization_code` OAuth flow
3. **Token Management**: Always use singleton pattern to prevent multiple token requests
4. **Error Handling**: Implement proper retry logic with exponential backoff for rate limits

## Testing Results

```javascript
// Working configuration
{
  grant_type: 'client_credentials',
  scope: 'SDPOnDemand.requests.ALL',
  // Returns: access_token valid for 3600 seconds
}

// API call format
{
  headers: {
    'Authorization': 'Bearer {access_token}',
    'Accept': 'application/vnd.manageengine.sdp.v3+json'
  }
}
```