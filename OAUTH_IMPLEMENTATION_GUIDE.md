# Service Desk Plus Cloud OAuth Implementation Guide

## Overview

This guide provides comprehensive information for implementing OAuth 2.0 authentication with ManageEngine Service Desk Plus Cloud API, based on research and practical implementation experience.

## Key Findings

### 1. OAuth Grant Types

**❌ NOT SUPPORTED: Client Credentials Grant**
- The `client_credentials` grant type is NOT supported by SDP Cloud
- This explains why we get `invalid_scope` errors with most scopes

**✅ SUPPORTED: Authorization Code Grant**
- Primary authentication method for SDP Cloud
- Requires user interaction for initial authorization
- Best for applications with user interfaces

**✅ RECOMMENDED: Self Client**
- Best option for server-to-server integrations
- No user interaction required after initial setup
- Ideal for backend automation and MCP servers

### 2. OAuth Rate Limits

**Token Generation Limits:**
- Maximum 5 refresh tokens per minute
- Maximum 10 access tokens per refresh token in 10 minutes
- Maximum 10 active access tokens per refresh token
- Maximum 20 active refresh tokens per user

**API Rate Limits:**
- 100 requests per minute for Cloud API
- Use exponential backoff with jitter for retry logic

### 3. OAuth Scopes

**Correct Scope Format:** `SDPOnDemand.[module].[permission]`

**Available Scopes:**
```
SDPOnDemand.requests.ALL      # Full access to requests
SDPOnDemand.requests.CREATE   # Create requests only
SDPOnDemand.requests.READ     # Read requests only

SDPOnDemand.projects.ALL      # Full access to projects
SDPOnDemand.projects.READ     # Read projects only

SDPOnDemand.assets.ALL        # Full access to assets
SDPOnDemand.assets.READ       # Read assets only

SDPOnDemand.setup.ALL         # Full admin access
SDPOnDemand.setup.CREATE      # Create admin items
SDPOnDemand.setup.READ        # Read admin settings

SDPOnDemand.problems.ALL      # Full access to problems
SDPOnDemand.changes.ALL       # Full access to changes
SDPOnDemand.users.ALL         # Full access to users
```

**Note:** The `.admin` permission level does not exist. Use `.ALL` for full access.

### 4. Self Client Setup Process

#### Step 1: Access Developer Console
- Use your data center specific URL
- For US: https://api-console.zoho.com/
- For EU: https://api-console.zoho.eu/
- For IN: https://api-console.zoho.in/

#### Step 2: Create Self Client
1. Go to Zoho Developer Console
2. Click "Add Client"
3. Choose "Self Client" from client types
4. Click OK in the popup
5. Note your Client ID and Client Secret

#### Step 3: Generate Grant Token
1. Click "Generate Code" tab
2. Enter required scopes (comma-separated):
   ```
   SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL
   ```
3. Select time duration (recommend 10 minutes)
4. Enter description
5. Click Generate
6. Copy the grant token immediately

#### Step 4: Exchange for Access Token
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_GRANT_TOKEN"
```

This returns:
```json
{
  "access_token": "1000.xxx",
  "refresh_token": "1000.xxx",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 5. Token Management Best Practices

1. **Cache Access Tokens**
   - Valid for 1 hour (3600 seconds)
   - Subtract 60 seconds for safety margin
   - Reuse until expiry to avoid rate limits

2. **Refresh Token Strategy**
   ```javascript
   // Refresh when token has < 5 minutes remaining
   if (tokenExpiry - Date.now() < 5 * 60 * 1000) {
     await refreshToken();
   }
   ```

3. **Rate Limit Handling**
   ```javascript
   // Exponential backoff with jitter
   const delay = Math.min(1000 * Math.pow(2, attempt), 32000);
   const jitter = Math.random() * 1000;
   await sleep(delay + jitter);
   ```

4. **Error Handling**
   - HTTP 401: Token expired, refresh and retry
   - HTTP 429: Rate limited, check headers and backoff
   - "invalid_scope": Using wrong grant type or scope format

### 6. Authorization Header Format

**Correct Format:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**NOT:**
- `Authorization: Zoho-oauthtoken YOUR_ACCESS_TOKEN`
- `Authorization: OAuth YOUR_ACCESS_TOKEN`

### 7. Environment Variables

```env
# OAuth Configuration
SDP_CLIENT_ID=your_client_id
SDP_CLIENT_SECRET=your_client_secret
SDP_REFRESH_TOKEN=your_refresh_token  # From Self Client setup

# API Configuration
SDP_BASE_URL=https://sdpondemand.manageengine.com
SDP_INSTANCE_NAME=your_instance
```

## Implementation Recommendations

### For Development/Testing
1. Use Self Client for quick setup
2. Generate grant token with minimal scopes initially
3. Test with Postman before implementing in code

### For Production
1. Implement full OAuth 2.0 authorization code flow for user-facing apps
2. Use Self Client for backend/automated services
3. Implement robust token caching and refresh logic
4. Add comprehensive error handling and retry logic
5. Monitor rate limit headers in responses

### Migration from Client Credentials
If you were trying to use `client_credentials`:
1. Set up Self Client in Zoho Developer Console
2. Generate and exchange grant token for refresh token
3. Store refresh token securely
4. Update code to use refresh token flow instead

## Common Issues and Solutions

1. **"invalid_scope" error**
   - Solution: Use Self Client or authorization code flow
   - Check scope format (SDPOnDemand.module.permission)

2. **"You have made too many requests continuously"**
   - Solution: Implement token caching
   - Wait 10 minutes before retrying
   - Use singleton pattern for token management

3. **401 Unauthorized with valid token**
   - Check Authorization header format (Bearer)
   - Verify token hasn't expired
   - Ensure correct data center URL

4. **Limited API access**
   - Self Client and auth code support all scopes
   - Client credentials has severe limitations

## References

- [OAuth 2.0 Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/oauth-2.0.html)
- [Self Client Overview](https://www.zoho.com/accounts/protocol/oauth/self-client/overview.html)
- [API Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/SDPOD-V3-API.html)