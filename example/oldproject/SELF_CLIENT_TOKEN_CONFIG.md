# Self Client Token Configuration Guide

## When Generating Code in Zoho Developer Console

### 1. Scope Configuration

Enter ALL these scopes in a single line, separated by commas:

```
SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.users.ALL,SDPOnDemand.setup.ALL,SDPOnDemand.solutions.ALL,SDPOnDemand.tasks.ALL
```

**Why these scopes?**
- `requests.ALL` - Create, read, update service requests
- `projects.ALL` - Manage projects and milestones
- `assets.ALL` - Asset management operations
- `problems.ALL` - Problem tracking
- `changes.ALL` - Change management
- `users.ALL` - User and technician operations
- `setup.ALL` - Admin configurations
- `solutions.ALL` - Knowledge base access
- `tasks.ALL` - Task management

### 2. Time Duration Configuration

**Select: 10 minutes**

**Why 10 minutes?**
- Grant tokens are ONE-TIME use only
- You need time to copy the code and run the exchange script
- 10 minutes gives you buffer for any issues
- Once you get the refresh token, it never expires

## Important Notes

### Token Lifetimes
- **Grant Token**: Valid for your selected duration (10 mins)
- **Access Token**: Valid for 1 hour
- **Refresh Token**: Never expires (until revoked)

### Rate Limits
- Maximum 5 refresh tokens per minute
- Maximum 10 access tokens per 10 minutes

### One-Time Process
- The grant token can only be used ONCE
- After exchanging for refresh token, you're set forever
- Store the refresh token securely - it's your permanent key

## Quick Setup Steps

1. **In Zoho Developer Console:**
   - Click "Generate Code" tab
   - Paste the scopes (all on one line)
   - Select "10 minutes" for time duration
   - Enter description: "MCP Server Full Access"
   - Click Generate
   - **IMMEDIATELY copy the code**

2. **In your terminal:**
   ```bash
   # Run within 10 minutes!
   node scripts/setup-self-client.js
   ```

3. **Follow prompts:**
   - Enter your Client ID
   - Enter your Client Secret
   - Enter the Grant Code you just copied
   - Select your data center

4. **Save the refresh token:**
   - Add to your `.env` file
   - Keep it secure
   - This is your permanent API access

## Troubleshooting

**"invalid_code" error?**
- Grant token expired (over 10 minutes)
- Grant token already used
- Solution: Generate a new code

**"invalid_scope" error?**
- Scope format is wrong
- Missing commas between scopes
- Solution: Copy the exact scope string above

**Can't see Generate Code tab?**
- Make sure you're in Self Client settings
- Not in regular OAuth app settings