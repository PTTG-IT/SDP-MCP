# OAuth Quick Reference Card

## 🚀 Need to Set Up OAuth Again?

### 1. Generate Grant Code
- Go to: https://api-console.zoho.com/ (or your region)
- Find your Self Client → Generate Code tab
- Scopes: `SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.users.ALL`
- Time: 10 minutes
- Copy code immediately!

### 2. Exchange for Refresh Token
```bash
node scripts/setup-self-client.js
```

### 3. Done! 
Refresh token auto-added to `.env`

## 🔧 Troubleshooting

**"invalid_scope"?** 
- Use exactly: `SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.users.ALL`

**"invalid_code"?**
- Code expired (>10 mins) - generate new one

**"too many requests"?**
- Wait 10 minutes, OAuth rate limit

**Only requests API works?**
- Missing refresh token - complete setup above

## 📋 Current Setup
- Type: Self Client with Refresh Token
- Scopes: Requests, Projects, Assets, Users
- Token in: `.env` → `SDP_REFRESH_TOKEN`

## 🧪 Test Commands
```bash
# Check if rate limited
node scripts/test-rate-limit-status.js

# Test API access
node scripts/test-api-access.js
```

---
*Full guide: `/docs/OAUTH_SETUP_COMPLETE_GUIDE.md`*