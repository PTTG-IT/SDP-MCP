# Service Desk Plus Authentication Documentation

## Overview

ManageEngine ServiceDesk Plus supports two primary authentication methods for API access:

1. **API Key/Authtoken** - Traditional authentication method
2. **OAuth 2.0** - Modern authentication protocol (Cloud version only)

## OAuth 2.0 Authentication

### Introduction

ServiceDesk Plus Cloud (SDPOnDemand) API v3 uses OAuth 2.0 protocol for secure authentication. OAuth 2.0 provides:
- Secure access without sharing user credentials
- Granular permission control through scopes
- Revocable access tokens
- Temporary access with automatic expiration

### Key Concepts

#### OAuth Terminology
- **Resource Owner**: End user who grants access to protected resources
- **Client**: Application requesting access to resources  
- **Authorization Server**: Zoho Accounts server that authenticates and issues tokens
- **Resource Server**: ServiceDesk Plus API server
- **Access Token**: Short-lived token for API access (1 hour validity)
- **Refresh Token**: Long-lived token to obtain new access tokens
- **Scope**: Defines specific permissions granted to the application

### OAuth Flow

ServiceDesk Plus uses the **Authorization Code Grant Type** flow:

1. **Application Registration**
   - Register your application in Zoho Developer Console
   - Obtain Client ID and Client Secret
   - Configure Authorized Redirect URIs

2. **Authorization Request**
   - Redirect user to authorization endpoint
   - User authenticates and approves permissions
   - Authorization server redirects back with authorization code

3. **Token Exchange**
   - Exchange authorization code for access/refresh tokens
   - Store tokens securely

4. **API Access**
   - Use access token in Authorization header
   - Format: `Authorization: Bearer {access_token}`

5. **Token Refresh**
   - Use refresh token to obtain new access token when expired
   - Refresh tokens have longer validity

### Data Center Specific Endpoints

OAuth endpoints vary by geographic location. Select the appropriate endpoints based on your ServiceDesk Plus instance location:

#### United States
- **API Domain**: `https://sdpondemand.manageengine.com`
- **Accounts Server**: `https://accounts.zoho.com`
- **Developer Console**: `https://api-console.zoho.com/`
- **Authorization Endpoint**: `https://accounts.zoho.com/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.com/oauth/v2/token`

#### Europe
- **API Domain**: `https://sdpondemand.manageengine.eu`
- **Accounts Server**: `https://accounts.zoho.eu`
- **Developer Console**: `https://api-console.zoho.eu/`
- **Authorization Endpoint**: `https://accounts.zoho.eu/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.eu/oauth/v2/token`

#### India
- **API Domain**: `https://sdpondemand.manageengine.in`
- **Accounts Server**: `https://accounts.zoho.in`
- **Developer Console**: `https://api-console.zoho.in/`
- **Authorization Endpoint**: `https://accounts.zoho.in/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.in/oauth/v2/token`

#### China
- **API Domain**: `https://servicedeskplus.cn`
- **Accounts Server**: `https://accounts.zoho.com.cn`
- **Developer Console**: `https://api-console.zoho.com.cn/`
- **Authorization Endpoint**: `https://accounts.zoho.com.cn/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.com.cn/oauth/v2/token`

#### Australia
- **API Domain**: `https://servicedeskplus.net.au`
- **Accounts Server**: `https://accounts.zoho.com.au`
- **Developer Console**: `https://api-console.zoho.com.au/`
- **Authorization Endpoint**: `https://accounts.zoho.com.au/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.com.au/oauth/v2/token`

#### Japan
- **API Domain**: `https://servicedeskplus.jp`
- **Accounts Server**: `https://accounts.zoho.jp`
- **Developer Console**: `https://api-console.zoho.jp/`
- **Authorization Endpoint**: `https://accounts.zoho.jp/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.jp/oauth/v2/token`

#### Canada
- **API Domain**: `https://servicedeskplus.ca`
- **Accounts Server**: `https://accounts.zohocloud.ca`
- **Developer Console**: `https://api-console.zohocloud.ca/`
- **Authorization Endpoint**: `https://accounts.zohocloud.ca/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zohocloud.ca/oauth/v2/token`

#### United Kingdom
- **API Domain**: `https://servicedeskplus.uk`
- **Accounts Server**: `https://accounts.zoho.uk`
- **Developer Console**: `https://api-console.zoho.uk/`
- **Authorization Endpoint**: `https://accounts.zoho.uk/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.uk/oauth/v2/token`

#### Saudi Arabia
- **API Domain**: `https://servicedeskplus.sa`
- **Accounts Server**: `https://accounts.zoho.sa`
- **Developer Console**: `https://api-console.zoho.sa/`
- **Authorization Endpoint**: `https://accounts.zoho.sa/oauth/v2/auth`
- **Token Endpoint**: `https://accounts.zoho.sa/oauth/v2/token`

### OAuth Scopes

Scopes control the level of access granted to your application. Common scopes include:

- `SDPOnDemand.requests.ALL` - Full access to requests
- `SDPOnDemand.requests.READ` - Read-only access to requests
- `SDPOnDemand.requests.CREATE` - Create requests
- `SDPOnDemand.requests.UPDATE` - Update requests
- `SDPOnDemand.requests.DELETE` - Delete requests

Similar patterns apply for other modules:
- `SDPOnDemand.problems.ALL`
- `SDPOnDemand.changes.ALL`
- `SDPOnDemand.projects.ALL`
- `SDPOnDemand.assets.ALL`
- `SDPOnDemand.solutions.ALL`
- `SDPOnDemand.setup.ALL`

Multiple scopes can be combined using comma separation.

### Implementation Steps

#### 1. Register Application

1. Navigate to your region's Developer Console
2. Create a new client
3. Select "Server-based Applications" client type
4. Configure application details:
   - Client Name
   - Homepage URL
   - Authorized Redirect URIs
5. Note the generated Client ID and Client Secret

#### 2. Authorization Request

Construct authorization URL with required parameters:

```
https://accounts.zoho.{dc}/oauth/v2/auth?
  response_type=code&
  client_id={client_id}&
  scope={required_scopes}&
  redirect_uri={redirect_uri}&
  access_type=offline&
  prompt=consent
```

Parameters:
- `response_type`: Always "code" for authorization code flow
- `client_id`: Your application's client ID
- `scope`: Comma-separated list of required scopes
- `redirect_uri`: Must match registered redirect URI
- `access_type`: "offline" to receive refresh token
- `prompt`: "consent" to show consent screen

#### 3. Handle Authorization Response

After user approval, Zoho redirects to your redirect URI:

Success: `https://your-redirect-uri?code={authorization_code}&location={dc}`

Error: `https://your-redirect-uri?error={error_code}`

#### 4. Exchange Code for Tokens

POST request to token endpoint:

```http
POST /oauth/v2/token
Host: accounts.zoho.{dc}
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code={authorization_code}&
client_id={client_id}&
client_secret={client_secret}&
redirect_uri={redirect_uri}
```

Response:
```json
{
  "access_token": "1000.xxxxxx",
  "refresh_token": "1000.xxxxxx",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### 5. Use Access Token

Include access token in API requests:

```http
GET /api/v3/requests
Host: sdpondemand.manageengine.{dc}
Authorization: Zoho-oauthtoken {access_token}
Accept: application/vnd.manageengine.sdp.v3+json
```

**Important**: Use `Zoho-oauthtoken` prefix, not `Bearer`

#### 6. Refresh Access Token

When access token expires, use refresh token:

```http
POST /oauth/v2/token
Host: accounts.zoho.{dc}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token={refresh_token}&
client_id={client_id}&
client_secret={client_secret}
```

### Code Examples

#### Python Example

```python
import requests
import json

class SDPOAuthClient:
    def __init__(self, client_id, client_secret, redirect_uri, dc='com'):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.dc = dc
        self.base_auth_url = f"https://accounts.zoho.{dc}"
        self.base_api_url = f"https://sdpondemand.manageengine.{dc if dc != 'com' else 'com'}"
        
    def get_authorization_url(self, scopes):
        """Generate authorization URL for user consent"""
        params = {
            'response_type': 'code',
            'client_id': self.client_id,
            'scope': ','.join(scopes),
            'redirect_uri': self.redirect_uri,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        auth_url = f"{self.base_auth_url}/oauth/v2/auth"
        return f"{auth_url}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
    
    def exchange_code_for_token(self, code):
        """Exchange authorization code for access and refresh tokens"""
        token_url = f"{self.base_auth_url}/oauth/v2/token"
        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'redirect_uri': self.redirect_uri
        }
        response = requests.post(token_url, data=data)
        return response.json()
    
    def refresh_access_token(self, refresh_token):
        """Get new access token using refresh token"""
        token_url = f"{self.base_auth_url}/oauth/v2/token"
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }
        response = requests.post(token_url, data=data)
        return response.json()
    
    def make_api_request(self, access_token, endpoint, method='GET', data=None):
        """Make authenticated API request"""
        url = f"{self.base_api_url}/api/v3/{endpoint}"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        if method == 'GET':
            response = requests.get(url, headers=headers)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data)
        elif method == 'PUT':
            response = requests.put(url, headers=headers, json=data)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers)
            
        return response.json()
```

#### Node.js Example

```javascript
const axios = require('axios');

class SDPOAuthClient {
    constructor(clientId, clientSecret, redirectUri, dc = 'com') {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.dc = dc;
        this.baseAuthUrl = `https://accounts.zoho.${dc}`;
        this.baseApiUrl = `https://sdpondemand.manageengine.${dc === 'com' ? 'com' : dc}`;
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
        return `${this.baseAuthUrl}/oauth/v2/auth?${params}`;
    }

    async exchangeCodeForToken(code) {
        const tokenUrl = `${this.baseAuthUrl}/oauth/v2/token`;
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: this.redirectUri
        });

        const response = await axios.post(tokenUrl, params);
        return response.data;
    }

    async refreshAccessToken(refreshToken) {
        const tokenUrl = `${this.baseAuthUrl}/oauth/v2/token`;
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret
        });

        const response = await axios.post(tokenUrl, params);
        return response.data;
    }

    async makeApiRequest(accessToken, endpoint, method = 'GET', data = null) {
        const url = `${this.baseApiUrl}/api/v3/${endpoint}`;
        const config = {
            method: method,
            url: url,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    }
}
```

### Security Best Practices

1. **Token Storage**
   - Never store tokens in plain text
   - Use secure storage mechanisms (encrypted database, secure key vault)
   - Implement proper access controls

2. **Token Transmission**
   - Always use HTTPS for all OAuth flows
   - Never include tokens in URLs or query parameters
   - Use Authorization header for API requests

3. **Token Lifecycle**
   - Implement automatic token refresh before expiration
   - Handle token revocation gracefully
   - Monitor token usage for anomalies

4. **Client Credentials**
   - Keep Client Secret confidential
   - Never expose Client Secret in client-side code
   - Rotate Client Secret periodically

5. **Scope Management**
   - Request minimum required scopes
   - Implement proper scope validation
   - Review and audit scope usage regularly

### Error Handling

Common OAuth errors and their handling:

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `invalid_client` | Invalid client ID or secret | Verify credentials in Developer Console |
| `invalid_grant` | Invalid authorization code or refresh token | Request new authorization |
| `invalid_scope` | Requested scope is invalid | Check available scopes |
| `access_denied` | User denied access | Handle gracefully, inform user |
| `unauthorized_client` | Client not authorized for grant type | Check application configuration |

### Token Expiration and Refresh Strategy

1. **Access Token Management**
   - Default validity: 1 hour
   - Check token expiration before each request
   - Refresh proactively (e.g., 5 minutes before expiration)

2. **Refresh Token Management**
   - Longer validity period (varies by configuration)
   - Store securely with encryption
   - Handle refresh token expiration by re-authorization

3. **Implementation Pattern**
   ```python
   def make_authenticated_request(self, endpoint):
       if self.is_token_expired():
           self.refresh_access_token()
       
       try:
           response = self.make_api_request(self.access_token, endpoint)
       except UnauthorizedException:
           # Token might have been revoked
           self.refresh_access_token()
           response = self.make_api_request(self.access_token, endpoint)
       
       return response
   ```

## API Key Authentication (Legacy)

For on-premises ServiceDesk Plus installations or when OAuth is not available:

### Obtaining API Key

1. Login to ServiceDesk Plus as administrator
2. Navigate to Admin → Technicians
3. Click on technician profile
4. Generate or view API key

### Using API Key

Include the API key in request headers:

```http
GET /api/v3/requests
Host: your-sdp-instance.com
authtoken: your-api-key
```

Or as query parameter:
```
https://your-sdp-instance.com/api/v3/requests?authtoken=your-api-key
```

### API Key Best Practices

1. **Key Management**
   - Rotate API keys regularly
   - Use separate keys for different applications
   - Monitor key usage

2. **Security**
   - Never expose API keys in client-side code
   - Use environment variables for storage
   - Implement IP whitelisting when possible

3. **Access Control**
   - Create dedicated technician accounts for API access
   - Assign minimal required permissions
   - Audit API key usage regularly

## Comparison: OAuth vs API Key

| Feature | OAuth 2.0 | API Key |
|---------|-----------|---------|
| Security | High (token-based, temporary) | Medium (static key) |
| Granularity | Scope-based permissions | Role-based permissions |
| Token Expiration | Yes (1 hour default) | No expiration |
| Token Refresh | Automatic with refresh token | Manual rotation |
| User Context | Yes (delegated access) | No (service account) |
| Revocation | Instant token revocation | Key deletion |
| Audit Trail | Detailed OAuth logs | Basic access logs |
| Availability | Cloud only | Cloud and On-premises |

## Troubleshooting

### Common Issues

1. **Invalid redirect URI**
   - Ensure exact match with registered URI
   - Check for trailing slashes
   - Verify protocol (http vs https)

2. **Scope errors**
   - Verify scope syntax (SDPOnDemand.module.permission)
   - Check scope availability for your instance
   - Ensure proper comma separation for multiple scopes

3. **Token expiration**
   - Implement proper refresh logic
   - Handle clock skew between servers
   - Monitor token validity periods

4. **Data center mismatch**
   - Verify correct endpoints for your region
   - Check instance URL to determine data center
   - Use consistent endpoints throughout flow

### Debug Checklist

- [ ] Correct data center endpoints
- [ ] Valid Client ID and Secret
- [ ] Registered redirect URI matches exactly
- [ ] Proper scope format and permissions
- [ ] HTTPS used for all requests
- [ ] Token included in Authorization header
- [ ] Refresh token stored and used correctly
- [ ] Error responses properly handled

## References

- [ServiceDesk Plus Cloud API Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [Zoho Developer Console](https://api-console.zoho.com/)
- [API Best Practices](https://www.manageengine.com/products/service-desk/sdpod-v3-api/best-practices.html)