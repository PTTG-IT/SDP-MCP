# OAuth Implementation: Lessons Learned

## Key Discoveries

### 1. Self Client Supports Limited client_credentials
**Initial Assumption**: Self Client doesn't support client_credentials grant
**Reality**: It does, but with severe limitations
- Only `SDPOnDemand.requests.ALL` scope works
- Other modules (projects, assets, users) return 401
- This confused us initially because partial access worked

### 2. OAuth Rate Limiting is Aggressive
- **Limit**: 10 OAuth token requests per 10 minutes
- **Error**: "You have made too many requests continuously"
- **Not documented clearly** in official docs
- Applied at Zoho account level, not per application

### 3. Authorization Header Format Matters
- **Working**: `Authorization: Bearer {token}`
- **Not Working**: `Authorization: Zoho-oauthtoken {token}`
- Despite some documentation suggesting Zoho-oauthtoken

### 4. Scope Validation is Strict
**Invalid scopes cause immediate rejection:**
- ❌ `SDPOnDemand.solutions.ALL` - Doesn't exist
- ❌ `SDPOnDemand.tasks.ALL` - Doesn't exist  
- ❌ `SDPOnDemand.problems.ALL` - Not available for Cloud
- ❌ `SDPOnDemand.changes.ALL` - Not available for Cloud
- ❌ `SDPOnDemand.admin.ALL` - Should be `setup.ALL`

**Valid scopes we confirmed:**
- ✅ `SDPOnDemand.requests.ALL`
- ✅ `SDPOnDemand.projects.ALL`
- ✅ `SDPOnDemand.assets.ALL`
- ✅ `SDPOnDemand.users.ALL`
- ✅ `SDPOnDemand.setup.ALL`

### 5. Grant Code Time Limit is Real
- 10 minutes is plenty if you're prepared
- Code is single-use only
- If it fails, you must generate a new one

### 6. Refresh Tokens are Permanent
- Never expire (until manually revoked)
- Can be used indefinitely for new access tokens
- Store securely - they're as powerful as passwords

## Architecture Decisions That Worked

### 1. TokenStore Singleton
Prevented multiple instances from requesting tokens simultaneously:
```typescript
class TokenStore {
  private static instance: TokenStore;
  private tokenRequestCount = 0;
  private tokenRequestResetTime: Date;
  
  canRequestToken(): boolean {
    // Rate limit logic
  }
}
```

### 2. Automatic Refresh Token Detection
```typescript
const refreshToken = process.env.SDP_REFRESH_TOKEN;
if (refreshToken) {
  // Use refresh token flow
} else {
  // Fall back to limited client_credentials
}
```

### 3. Clear Error Messages
Instead of generic "auth failed", we provide:
- "OAuth token request limit reached. Please wait X minutes"
- "Refresh token is invalid or expired. Please run setup-self-client.js"

## What We Would Do Differently

1. **Start with Refresh Token Setup**
   - Don't waste time on client_credentials
   - Go straight to Self Client + refresh token

2. **Test Scopes Individually**
   - Add one scope at a time when testing
   - Identifies invalid scopes immediately

3. **Document Rate Limits Prominently**
   - Add to README immediately
   - Include in error messages
   - Add countdown timer in UI

4. **Create Test Suite First**
   - Test each API endpoint
   - Test rate limit handling
   - Test token refresh flow

## Debugging Tips

### When You Get "invalid_scope"
1. You're using an invalid scope name
2. You're using client_credentials with unsupported scope
3. Scope format is wrong (needs commas, no spaces)

### When You Get "invalid_code"
1. Grant code expired (>10 minutes)
2. Grant code already used
3. Wrong data center URL

### When You Get Rate Limited
1. Wait 10 minutes (use a timer)
2. Check if multiple instances are running
3. Implement singleton token management

### When Only Requests API Works
1. You're using client_credentials grant
2. Need to set up refresh token
3. Check Authorization header format

## Scripts That Save Time

1. **setup-self-client.js** - Interactive OAuth setup
2. **test-rate-limit-status.js** - Check if rate limited
3. **test-api-access.js** - Verify which APIs work

## Security Considerations

1. **Never commit refresh tokens** - They're permanent access
2. **Use environment variables** - Not hardcoded values
3. **Implement token encryption** - For production use
4. **Monitor token usage** - Detect unauthorized access
5. **Rotate tokens periodically** - Even though they don't expire

## Final Recommendations

1. **For New Projects**: Start with Self Client + refresh token
2. **For Testing**: Use limited client_credentials temporarily
3. **For Production**: Always use refresh token with proper security
4. **For Documentation**: Include OAuth setup in README
5. **For Troubleshooting**: Create diagnostic scripts

---

*Remember: The confusion often comes from Self Client supporting client_credentials with limited scope - this is not the intended use case!*