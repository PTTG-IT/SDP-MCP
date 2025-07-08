# Service Desk Plus MCP Implementation Roadmap

## ✅ Completed
- MCP SSE server with proper protocol handling
- Claude Desktop connection via mcp-remote
- Basic tool structure with mock responses
- Proper notification vs request handling

## 📋 Phase 1: OAuth Authentication & API Client

### 1.1 OAuth Token Management
```javascript
// src/sdp-auth.js
class SDPAuthManager {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokens = null;
  }
  
  async getAccessToken() {
    // Exchange OAuth credentials for access token
    // Implement token refresh logic
    // Cache tokens appropriately
  }
}
```

### 1.2 SDP API Client
```javascript
// src/sdp-client.js
class SDPClient {
  constructor(authManager, portalName) {
    this.auth = authManager;
    this.baseURL = `https://sdpondemand.manageengine.com/app/${portalName}/api/v3`;
  }
  
  async request(method, endpoint, data) {
    // Make authenticated API calls
    // Handle rate limiting
    // Retry logic
  }
}
```

## 📋 Phase 2: Core Tool Implementation

### 2.1 List Requests
```javascript
async function list_requests({ limit = 10, status, priority }) {
  const params = {
    list_info: {
      row_count: limit,
      start_index: 0
    }
  };
  
  if (status) {
    params.list_info.search_fields = {
      status: { name: status }
    };
  }
  
  const response = await sdpClient.request('GET', '/requests', { input_data: JSON.stringify(params) });
  return formatRequestList(response.data.requests);
}
```

### 2.2 Get Request Details
```javascript
async function get_request({ request_id }) {
  const response = await sdpClient.request('GET', `/requests/${request_id}`);
  return formatRequestDetails(response.data.request);
}
```

### 2.3 Create Request
```javascript
async function create_request({ subject, description, priority = 'medium', category }) {
  const data = {
    request: {
      subject,
      description,
      priority: { name: priority },
      category: category ? { name: category } : undefined
    }
  };
  
  const response = await sdpClient.request('POST', '/requests', { input_data: JSON.stringify(data) });
  return formatRequestDetails(response.data.request);
}
```

## 📋 Phase 3: Advanced Tools

### 3.1 Update Request
- Support partial updates
- Handle status transitions
- Update custom fields

### 3.2 Close Request
- Add resolution/closure notes
- Set closure codes
- Handle approval workflows

### 3.3 Search Requests
- Full-text search
- Advanced filters
- Date range queries

### 3.4 Bulk Operations
- Batch updates
- Mass assignment
- Bulk status changes

## 📋 Phase 4: Error Handling & Reliability

### 4.1 Comprehensive Error Handling
```javascript
class SDPError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Handle specific SDP errors
function handleSDPError(error) {
  if (error.response?.status === 401) {
    return new SDPError('Authentication failed', 'AUTH_FAILED', error.response.data);
  }
  if (error.response?.status === 429) {
    return new SDPError('Rate limit exceeded', 'RATE_LIMIT', error.response.data);
  }
  // ... more error cases
}
```

### 4.2 Rate Limiting
- Implement exponential backoff
- Track API quota usage
- Queue requests when hitting limits

### 4.3 Caching Strategy
- Cache frequently accessed data
- Implement TTL for different data types
- Invalidation strategies

## 📋 Phase 5: Enhanced Features

### 5.1 Real-time Updates
- Webhook integration for ticket updates
- Push notifications via SSE
- Status change alerts

### 5.2 File Attachments
- Upload attachments to requests
- Download and preview attachments
- Handle large files

### 5.3 Reporting Tools
- Generate ticket summaries
- Export data in various formats
- Dashboard metrics

## 🔧 Technical Requirements

### Environment Variables
```env
# OAuth Configuration
SDP_CLIENT_ID=your-client-id
SDP_CLIENT_SECRET=your-client-secret
SDP_REFRESH_TOKEN=your-refresh-token

# SDP Configuration  
SDP_PORTAL_NAME=your-portal
SDP_DATA_CENTER=US

# Optional
SDP_API_TIMEOUT=30000
SDP_MAX_RETRIES=3
SDP_CACHE_TTL=300
```

### Required OAuth Scopes
- SDPOnDemand.requests.READ
- SDPOnDemand.requests.CREATE
- SDPOnDemand.requests.UPDATE
- SDPOnDemand.requests.DELETE
- SDPOnDemand.problems.ALL
- SDPOnDemand.changes.ALL
- SDPOnDemand.projects.ALL

## 🚀 Quick Start Implementation

1. **Install dependencies**:
   ```bash
   npm install axios dotenv node-cache
   ```

2. **Create OAuth setup script**:
   ```bash
   node scripts/setup-oauth.js
   ```

3. **Test API connection**:
   ```bash
   node scripts/test-sdp-connection.js
   ```

4. **Update MCP server** to use real API client

## 📊 Success Metrics

- [ ] All CRUD operations for requests
- [ ] < 2s response time for list operations
- [ ] Proper error messages for all failure cases
- [ ] 99.9% uptime for MCP server
- [ ] Support for 1000+ requests/hour
- [ ] Comprehensive audit logging

## 🔗 References

- [SDP API Documentation](https://www.manageengine.com/products/service-desk/sdpod-v3-api/index.html)
- [OAuth Setup Guide](https://www.manageengine.com/products/service-desk/sdpod-v3-api/getting-started/oauth-2.0.html)
- [MCP Protocol Spec](https://modelcontextprotocol.io/specification)

---

Ready to start with Phase 1? The OAuth implementation is the foundation for everything else.