# Service Desk Plus OAuth 2.0 Complete Documentation

## Overview

ManageEngine ServiceDesk Plus Cloud API uses OAuth 2.0 protocol with Authorization Code Grant Type for secure authentication.

## Key Concepts

### OAuth Terminology
- **Protected Resources**: ManageEngine ServiceDesk Plus Cloud resources
- **Resource Server**: Server hosting protected resources
- **Resource Owner**: End user who grants access to protected resources
- **Client**: Application requesting access to resources
- **Authentication Server**: Zoho Accounts server that provides credentials
- **Access Token**: Short-lived token for API access (1 hour validity)
- **Refresh Token**: Long-lived token to obtain new access tokens (unlimited lifetime)
- **Grant Token**: One-time authorization code (valid for 1 minute in Self-Client)
- **Scope**: Defines specific permissions granted to the application

## Token Management

### Access Token
- **Validity**: 1 hour from issuance
- **Usage**: Include in Authorization header as `Zoho-oauthtoken {access_token}`
- **Format**: `Authorization: Zoho-oauthtoken {access_token}` (NOT Bearer)
- **Refresh**: Use refresh token when access token expires (401 response)

### Refresh Token
- **Validity**: UNLIMITED lifetime until manually revoked by user
- **Limits**: 
  - Maximum 20 refresh tokens per Zoho account
  - Maximum 5 token refresh requests per minute
  - Exceeding rate limits results in "Access Denied" errors
- **Storage**: Must be stored securely, never exposed in logs or client-side code
- **Usage**: Exchange for new access token when current token expires

### Grant Token (Self-Client)
- **Validity**: Only 1 minute
- **Usage**: Must be exchanged for access/refresh tokens immediately
- **One-time use**: Cannot be reused

## Rate Limits

- **Token Generation**: Maximum 5 refresh tokens per minute
- **Exceeding Limits**: Results in error: "You have made too many requests continuously. Please try again after some time."
- **Account Limit**: Maximum 20 refresh tokens per account

## OAuth Scopes

### Scope Format
`SDPOnDemand.<module>.<operation>`

### Available Operations
- `ALL` - Full access to the module
- `CREATE` - Create operations only
- `READ` - Read operations only
- `UPDATE` - Update operations only
- `DELETE` - Delete operations only

### Complete Module List

#### Core Modules
- `SDPOnDemand.requests.{operation}` - Service requests/tickets
- `SDPOnDemand.problems.{operation}` - Problem management
- `SDPOnDemand.changes.{operation}` - Change management
- `SDPOnDemand.projects.{operation}` - Project management
- `SDPOnDemand.releases.{operation}` - Release management
- `SDPOnDemand.assets.{operation}` - Asset management
- `SDPOnDemand.cmdb.{operation}` - Configuration management database
- `SDPOnDemand.solutions.{operation}` - Knowledge base solutions
- `SDPOnDemand.setup.{operation}` - Setup and configuration
- `SDPOnDemand.general.{operation}` - General operations
- `SDPOnDemand.contracts.{operation}` - Contract management
- `SDPOnDemand.purchase.{operation}` - Purchase management
- `SDPOnDemand.users.{operation}` - User management
- `SDPOnDemand.custommodule.{operation}` - Custom modules (note: not customModule)

### Scope Examples
- `SDPOnDemand.requests.ALL` - Full access to requests
- `SDPOnDemand.requests.READ,SDPOnDemand.problems.READ` - Read-only access to requests and problems
- `SDPOnDemand.users.READ` - Read user/technician information

## Registration Process

### 1. Regular Client Registration
1. Navigate to Zoho Developer Console for your data center
2. Click "Add Client" or "Get Started"
3. Choose client type:
   - Server-Based Applications
   - Mobile Applications
   - Single Page Applications (SPA)
   - Self Client
4. Provide:
   - Client Name
   - Client Domain
   - Authorized Redirect URIs
5. Receive:
   - Client ID
   - Client Secret

### 2. Self-Client Registration (Recommended for Single User)
1. Go to Zoho Developer Console
2. Click "Add Client"
3. Choose "Self Client"
4. Click OK
5. Generate grant token:
   - Select required scopes
   - Set time duration (grant token valid for 1 minute only)
   - Click "Generate"
6. Copy grant token immediately
7. Exchange for access/refresh tokens within 1 minute

## OAuth Flow

### Step 1: Authorization Request
```
https://accounts.zoho.{dc}/oauth/v2/auth?response_type=code&client_id={client_id}&scope={scopes}&redirect_uri={redirect_uri}&access_type=offline&prompt=consent
```

#### Parameters:
- `response_type`: Always `code`
- `client_id`: Your application's client ID
- `scope`: Comma-separated list of required scopes (no spaces)
- `redirect_uri`: Must match registered URI exactly
- `access_type`: Use `offline` to get refresh token
- `prompt`: Use `consent` to ensure user sees permission screen

### Step 2: Token Exchange
```
POST https://accounts.zoho.{dc}/oauth/v2/token
Content-Type: application/x-www-form-urlencoded

code={authorization_code}&
grant_type=authorization_code&
client_id={client_id}&
client_secret={client_secret}&
redirect_uri={redirect_uri}
```

#### Response:
```json
{
  "access_token": "1000.8cb194a6e2c91a1cf7b83d3b4c69a0c4.4638936dfef26dd8cbbc8658c6dd3e9f",
  "refresh_token": "1000.a41e5f3d1c73f6f7f82c2b16c2f19c27.ae821cb52f3c541e2a84f65e5d8634d2",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "SDPOnDemand.requests.ALL SDPOnDemand.problems.READ",
  "api_domain": "https://sdpondemand.manageengine.com"
}
```

### Step 3: Refresh Access Token
```
POST https://accounts.zoho.{dc}/oauth/v2/token
Content-Type: application/x-www-form-urlencoded

refresh_token={refresh_token}&
grant_type=refresh_token&
client_id={client_id}&
client_secret={client_secret}
```

### Step 4: API Calls
```
GET https://sdpondemand.manageengine.{dc}/api/v3/requests
Authorization: Zoho-oauthtoken {access_token}
Accept: application/vnd.manageengine.sdp.v3+json
```

**CRITICAL**: Use `Zoho-oauthtoken` prefix, NOT `Bearer`

### Step 5: Token Revocation (Optional)
```
POST https://accounts.zoho.{dc}/oauth/v2/token/revoke
Content-Type: application/x-www-form-urlencoded

token={refresh_token_or_access_token}
```

## Data Center URLs

### United States (US)
- Accounts Server: `https://accounts.zoho.com`
- API Domain: `https://sdpondemand.manageengine.com`
- Developer Console: `https://api-console.zoho.com/`
- Authorization: `https://accounts.zoho.com/oauth/v2/auth`
- Token: `https://accounts.zoho.com/oauth/v2/token`

### Europe (EU)
- Accounts Server: `https://accounts.zoho.eu`
- API Domain: `https://sdpondemand.manageengine.eu`
- Developer Console: `https://api-console.zoho.eu/`
- Authorization: `https://accounts.zoho.eu/oauth/v2/auth`
- Token: `https://accounts.zoho.eu/oauth/v2/token`

### India (IN)
- Accounts Server: `https://accounts.zoho.in`
- API Domain: `https://sdpondemand.manageengine.in`
- Developer Console: `https://api-console.zoho.in/`
- Authorization: `https://accounts.zoho.in/oauth/v2/auth`
- Token: `https://accounts.zoho.in/oauth/v2/token`

### Australia (AU)
- Accounts Server: `https://accounts.zoho.com.au`
- API Domain: `https://servicedeskplus.net.au`
- Developer Console: `https://api-console.zoho.com.au/`
- Authorization: `https://accounts.zoho.com.au/oauth/v2/auth`
- Token: `https://accounts.zoho.com.au/oauth/v2/token`

### China (CN)
- Accounts Server: `https://accounts.zoho.com.cn`
- API Domain: `https://servicedeskplus.cn`
- Developer Console: `https://api-console.zoho.com.cn/`
- Authorization: `https://accounts.zoho.com.cn/oauth/v2/auth`
- Token: `https://accounts.zoho.com.cn/oauth/v2/token`

### Japan (JP)
- Accounts Server: `https://accounts.zoho.jp`
- API Domain: `https://servicedeskplus.jp`
- Developer Console: `https://api-console.zoho.jp/`
- Authorization: `https://accounts.zoho.jp/oauth/v2/auth`
- Token: `https://accounts.zoho.jp/oauth/v2/token`

### Canada (CA)
- Accounts Server: `https://accounts.zohocloud.ca`
- API Domain: `https://servicedeskplus.ca`
- Developer Console: `https://api-console.zohocloud.ca/`
- Authorization: `https://accounts.zohocloud.ca/oauth/v2/auth`
- Token: `https://accounts.zohocloud.ca/oauth/v2/token`

### United Kingdom (UK)
- Accounts Server: `https://accounts.zoho.uk`
- API Domain: `https://servicedeskplus.uk`
- Developer Console: `https://api-console.zoho.uk/`
- Authorization: `https://accounts.zoho.uk/oauth/v2/auth`
- Token: `https://accounts.zoho.uk/oauth/v2/token`

### Saudi Arabia (SA)
- Accounts Server: `https://accounts.zoho.sa`
- API Domain: `https://servicedeskplus.sa`
- Developer Console: `https://api-console.zoho.sa/`
- Authorization: `https://accounts.zoho.sa/oauth/v2/auth`
- Token: `https://accounts.zoho.sa/oauth/v2/token`

## Code Examples

### cURL

#### Authorization Request
```bash
curl "https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=1000.15S25B602CISR5WO9RUZ8UT39O3RIH&scope=SDPOnDemand.requests.ALL,SDPOnDemand.problems.READ&redirect_uri=https://www.zoho.com&access_type=offline&prompt=consent"
```

#### Token Generation
```bash
curl https://accounts.zoho.com/oauth/v2/token \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=1000.cdeffbc4xxxx2dd1aaae83531662a22.0f8bbxxxx753ac2776d4f1dffed2xab" \
  -d "grant_type=authorization_code" \
  -d "client_id=1000.QMxxxxMEG7SJMPYU6xxxKDR79IGBC" \
  -d "client_secret=27db6a8xxxxx60c2f5655dcc16xx9d19cb5a8860" \
  -d "redirect_uri=https://www.zoho.com"
```

#### Token Refresh
```bash
curl https://accounts.zoho.com/oauth/v2/token \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "refresh_token=1000.cdeffbc4xxxx2dd1aaae83531662a22.0f8bbxxxx753ac2776d4f1dffed2xab" \
  -d "grant_type=refresh_token" \
  -d "client_id=1000.QMxxxxMEG7SJMPYU6xxxKDR79IGBC" \
  -d "client_secret=27db6a8xxxxx60c2f5655dcc16xx9d19cb5a8860"
```

#### API Call
```bash
curl https://sdpondemand.manageengine.com/api/v3/requests \
  -H "Authorization: Zoho-oauthtoken 1000.8cb194a6e2c91a1cf7b83d3b4c69a0c4.4638936dfef26dd8cbbc8658c6dd3e9f" \
  -H "Accept: application/vnd.manageengine.sdp.v3+json"
```

#### Token Revocation
```bash
curl https://accounts.zoho.com/oauth/v2/token/revoke \
  -X POST \
  -d "token=1000.cdeffbc4xxxx2dd1aaae83531662a22.0f8bbxxxx753ac2776d4f1dffed2xab"
```

### Python

```python
import requests
import json

class SDPOAuthClient:
    def __init__(self, client_id, client_secret, redirect_uri, dc='com'):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.dc = dc
        self.base_url = f'https://accounts.zoho.{dc}'
        
    def get_authorization_url(self, scopes):
        """Generate authorization URL"""
        params = {
            'response_type': 'code',
            'client_id': self.client_id,
            'scope': ','.join(scopes),
            'redirect_uri': self.redirect_uri,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        return f"{self.base_url}/oauth/v2/auth?" + "&".join([f"{k}={v}" for k, v in params.items()])
    
    def exchange_code_for_tokens(self, code):
        """Exchange authorization code for access and refresh tokens"""
        url = f"{self.base_url}/oauth/v2/token"
        data = {
            'code': code,
            'grant_type': 'authorization_code',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri
        }
        response = requests.post(url, data=data)
        return response.json()
    
    def refresh_access_token(self, refresh_token):
        """Refresh access token using refresh token"""
        url = f"{self.base_url}/oauth/v2/token"
        data = {
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token',
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }
        response = requests.post(url, data=data)
        return response.json()
    
    def make_api_request(self, access_token, endpoint):
        """Make API request with access token"""
        headers = {
            'Authorization': f'Zoho-oauthtoken {access_token}',
            'Accept': 'application/vnd.manageengine.sdp.v3+json'
        }
        response = requests.get(endpoint, headers=headers)
        return response.json()
```

### Node.js

```javascript
const axios = require('axios');

class SDPOAuthClient {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.dc = config.dc || 'com';
    this.baseUrl = `https://accounts.zoho.${this.dc}`;
  }
  
  getAuthorizationUrl(scopes) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: scopes.join(','),
      redirect_uri: this.redirectUri,
      access_type: 'offline',
      prompt: 'consent'
    });
    return `${this.baseUrl}/oauth/v2/auth?${params}`;
  }
  
  async exchangeCodeForTokens(code) {
    const params = new URLSearchParams({
      code: code,
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri
    });
    
    const response = await axios.post(
      `${this.baseUrl}/oauth/v2/token`,
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  }
  
  async refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    
    const response = await axios.post(
      `${this.baseUrl}/oauth/v2/token`,
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  }
  
  async makeApiRequest(accessToken, endpoint) {
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Accept': 'application/vnd.manageengine.sdp.v3+json'
      }
    });
    return response.data;
  }
}
```

## Important Notes

### Security Best Practices
1. **Token Storage**: Never store tokens in:
   - Client-side code (JavaScript, HTML)
   - Public repositories
   - Log files
   - URLs or query parameters
2. **Use HTTPS**: Always use HTTPS for OAuth flows and API calls
3. **Revoke Unused Tokens**: Revoke tokens when no longer needed
4. **Minimum Scopes**: Request only the scopes you need

### Common Pitfalls
1. **Wrong Authorization Header**: Use `Zoho-oauthtoken`, not `Bearer`
2. **Redirect URI Mismatch**: Must match exactly, including trailing slashes
3. **Grant Token Expiry**: Self-client grant tokens expire in 1 minute
4. **Rate Limiting**: Max 5 refresh requests per minute
5. **Scope Format**: No spaces between comma-separated scopes
6. **Custom Domains**: OAuth tokens from Zoho work with custom SDP domains

### Error Handling
- **401 Unauthorized**: Token expired or invalid
- **403 Forbidden**: Insufficient scopes
- **"Access Denied"**: Rate limit exceeded
- **"Invalid refresh token"**: Token revoked or corrupted
- **"Token expired"**: Access token needs refresh

### Token Validation Best Practices
```javascript
// Check if token is valid before use
isTokenValid() {
  if (!this.accessToken || !this.tokenExpiry) return false;
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes
  return new Date().getTime() < (this.tokenExpiry.getTime() - expiryBuffer);
}

// Implement refresh lock to prevent concurrent refreshes
async refreshAccessToken() {
  if (this.refreshPromise) {
    return await this.refreshPromise;
  }
  this.refreshPromise = this._doRefresh();
  try {
    return await this.refreshPromise;
  } finally {
    this.refreshPromise = null;
  }
}

// Only refresh on actual 401 errors
if (error.response?.status === 401) {
  await refreshAccessToken();
} else {
  // Don't refresh on 400, 404, or other errors
  throw error;
}
```

## Custom Domain Support

OAuth tokens obtained from Zoho accounts work seamlessly with custom Service Desk Plus domains. For example:
- OAuth from: `accounts.zoho.com`
- Works with: `https://helpdesk.yourcompany.com`

No additional configuration needed for custom domains.