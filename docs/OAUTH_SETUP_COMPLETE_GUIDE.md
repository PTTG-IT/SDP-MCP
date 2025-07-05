# Complete OAuth Setup Guide for Service Desk Plus Cloud MCP

## Overview

This guide documents the complete OAuth setup process for Service Desk Plus Cloud MCP Server, including all lessons learned and troubleshooting steps.

## Current Setup Status ✅

As of July 4, 2025, the MCP server is fully configured with:
- **Authentication Type**: Self Client with Refresh Token
- **Access Level**: Full API access to all modules
- **Scopes**: `SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.users.ALL`

## Key Discoveries

### 1. Authentication Types

**Self Client Credentials Support Both:**
- ✅ `client_credentials` grant - BUT limited to `SDPOnDemand.requests.ALL` only
- ✅ `authorization_code` + refresh token - Full access to all scopes

### 2. OAuth Rate Limits
- **Token Generation**: Max 10 tokens per 10 minutes
- **Error Message**: "You have made too many requests continuously"
- **Solution**: Implemented TokenStore singleton to share tokens

### 3. Authorization Header Format
- **Correct**: `Authorization: Bearer {token}`
- **Wrong**: `Authorization: Zoho-oauthtoken {token}`

## Step-by-Step Setup Process

### Prerequisites
1. Service Desk Plus Cloud account
2. Self Client created in Zoho Developer Console
3. Client ID and Client Secret in `.env`

### Step 1: Generate Grant Code

1. Go to Zoho Developer Console:
   - US: https://api-console.zoho.com/
   - EU: https://api-console.zoho.eu/
   - IN: https://api-console.zoho.in/

2. Navigate to your Self Client

3. Click "Generate Code" tab

4. Enter scopes (all on one line):
   ```
   SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.users.ALL
   ```

5. Set Time Duration: **10 minutes**

6. Click Generate and **immediately copy the code**

### Step 2: Exchange for Refresh Token

Run the setup script within 10 minutes:
```bash
node scripts/setup-self-client.js
```

Or manually exchange:
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_GRANT_CODE"
```

### Step 3: Update .env

The script automatically adds the refresh token to `.env`:
```env
# OAuth Refresh Token (added 2025-07-05T01:42:07.602Z)
SDP_REFRESH_TOKEN=1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Restart MCP Server

The MCP server will automatically detect and use the refresh token for full API access.

## Troubleshooting

### "invalid_scope" Error
- **Cause**: Using unsupported scopes
- **Solution**: Use only confirmed valid scopes listed above
- **Note**: Scopes like `SDPOnDemand.solutions.ALL` and `SDPOnDemand.tasks.ALL` are not valid

### "invalid_code" Error
- **Cause**: Grant code expired (>10 minutes) or already used
- **Solution**: Generate a new grant code

### Rate Limit Errors
- **Error**: "You have made too many requests continuously"
- **Wait Time**: 10 minutes
- **Prevention**: TokenStore singleton prevents multiple token requests

### Limited API Access
- **Symptom**: Only requests API works, projects/assets/users return 401
- **Cause**: Using `client_credentials` instead of refresh token
- **Solution**: Complete the Self Client setup with refresh token

## Architecture Details

### Token Lifetimes
- **Grant Code**: 10 minutes (one-time use)
- **Access Token**: 1 hour
- **Refresh Token**: Never expires

### Token Store Implementation
- Singleton pattern ensures one token per application
- Tracks OAuth request count (max 10 per 10 minutes)
- Automatic token refresh before expiration

### Authentication Flow
1. Check for valid access token in TokenStore
2. If expired, use refresh token to get new access token
3. If no refresh token, fall back to client_credentials (limited scope)
4. Rate limit protection at each step

## File Structure

```
/src/api/
├── auth.ts          # Main authentication manager
├── tokenStore.ts    # Singleton token storage
├── authV2.ts        # Enhanced auth with Self Client support
└── client.ts        # API client with auth interceptor

/scripts/
├── setup-self-client.js        # Interactive OAuth setup
├── test-rate-limit-status.js   # Check if rate limited
└── test-api-access.js          # Test API endpoints

/docs/
├── OAUTH_SETUP_COMPLETE_GUIDE.md  # This file
├── AUTH_FINDINGS.md               # Authentication research
├── OAUTH_IMPLEMENTATION_GUIDE.md  # Implementation details
└── SELF_CLIENT_SETUP.md          # Self Client specific guide
```

## Environment Variables

```env
# Required
SDP_CLIENT_ID=your_client_id
SDP_CLIENT_SECRET=your_client_secret
SDP_BASE_URL=https://your-instance.com
SDP_INSTANCE_NAME=your_instance

# Added by setup script
SDP_REFRESH_TOKEN=your_refresh_token

# Optional
SDP_API_VERSION=v3
SDP_RATE_LIMIT_PER_MINUTE=10
```

## Testing Authentication

### Quick Test
```bash
node scripts/test-api-access.js
```

### Check Rate Limit Status
```bash
node scripts/test-rate-limit-status.js
```

### Full Integration Test
```javascript
import { SDPClient } from './dist/api/client.js';

const client = new SDPClient({
  clientId: process.env.SDP_CLIENT_ID,
  clientSecret: process.env.SDP_CLIENT_SECRET,
  baseUrl: process.env.SDP_BASE_URL,
  instanceName: process.env.SDP_INSTANCE_NAME,
});

// Will automatically use refresh token if available
const projects = await client.projects.list();
```

## Best Practices

1. **Never commit `.env` file** - Contains sensitive tokens
2. **Store refresh token securely** - It provides permanent API access
3. **Monitor token expiration** - Access tokens expire after 1 hour
4. **Handle rate limits gracefully** - Implement exponential backoff
5. **Use appropriate scopes** - Only request access you need

## Next Steps

With full OAuth setup complete, the MCP server can:
- ✅ Access all API modules (requests, projects, assets, users)
- ✅ Automatically refresh tokens
- ✅ Handle rate limits
- ✅ Provide reliable service to AI assistants

## Support

For issues:
1. Check error messages against troubleshooting guide
2. Verify refresh token is in `.env`
3. Run test scripts to isolate problems
4. Check Zoho Developer Console for API status

---

Last Updated: July 4, 2025
Setup Completed Successfully ✅