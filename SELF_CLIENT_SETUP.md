# Self Client Setup - IMPORTANT

## Current Situation

The credentials in `.env` are Self Client credentials, but we're missing the refresh token. This is why we've been having issues:

1. **Self Client credentials cannot use `client_credentials` grant type**
2. **Self Client requires a refresh token** obtained through the authorization code flow
3. Without a refresh token, we cannot authenticate properly

## How to Fix This

### Step 1: Generate Grant Token

1. Go to Zoho Developer Console for your region:
   - US: https://api-console.zoho.com/
   - EU: https://api-console.zoho.eu/
   - IN: https://api-console.zoho.in/

2. Find your Self Client application

3. Click on "Generate Code" tab

4. Enter these scopes (all on one line, comma-separated):
   ```
   SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.users.ALL,SDPOnDemand.setup.ALL
   ```

5. Set time duration to 10 minutes

6. Click Generate and copy the code immediately

### Step 2: Exchange for Refresh Token

Run our setup script:
```bash
node scripts/setup-self-client.js
```

Or manually exchange using curl:
```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_GRANT_CODE"
```

### Step 3: Update .env

Add the refresh token to your `.env`:
```
SDP_REFRESH_TOKEN=1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Update Code

The application will automatically detect the refresh token and use the proper authentication flow.

## Why This Happened

When using Self Client:
- The `client_credentials` grant type is not supported
- You must use the authorization code flow to get an initial refresh token
- The refresh token is permanent and can be used to get new access tokens
- This is a one-time setup process

## Benefits After Setup

Once you have the refresh token:
- Full access to all API modules (not just requests)
- No more "invalid_scope" errors
- Automatic token refresh when access tokens expire
- No manual intervention required