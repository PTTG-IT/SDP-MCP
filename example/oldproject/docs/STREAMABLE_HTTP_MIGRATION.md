# SSE to Streamable HTTP Migration Guide

## Overview

This document describes the migration from the deprecated SSE (Server-Sent Events) transport to the modern Streamable HTTP transport for the Service Desk Plus MCP Server with Self-Client Authentication.

## Why the Migration?

### SSE Transport Issues Discovered

1. **EventSource Not Available in Node.js**
   - The MCP SDK's SSE client transport relies on the browser-only `EventSource` API
   - This caused `ReferenceError: EventSource is not defined` in Node.js environments

2. **Header Timing Conflicts**
   - SSE requires headers to be set before any response body is written
   - Our implementation had timing issues causing "Cannot write headers after they are sent" errors

3. **Protocol Deprecation**
   - SSE transport was deprecated as of MCP protocol version 2024-11-05
   - Replaced by Streamable HTTP transport in version 2025-03-26

## Benefits of Streamable HTTP

1. **True Bidirectional Communication**
   - Unlike SSE's one-way server-to-client streaming
   - Servers can send notifications and request information from clients

2. **Better Infrastructure Compatibility**
   - Works with standard HTTP infrastructure
   - No special event stream handling required

3. **Stateless or Stateful Options**
   - Can implement stateless servers for better scalability
   - Or maintain sessions for complex interactions

4. **Single Endpoint**
   - Uses `/mcp` endpoint instead of separate `/sse` and `/message` endpoints

## Implementation Changes

### Server Changes

1. **Transport Import**
   ```typescript
   // Old (SSE)
   import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
   
   // New (Streamable HTTP)
   import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
   ```

2. **Endpoint Configuration**
   ```typescript
   // Old (SSE) - Multiple endpoints
   app.get('/sse', ...);     // SSE connection
   app.post('/message', ...); // Message handling
   
   // New (Streamable HTTP) - Single endpoint
   app.post('/mcp', ...);     // All communication
   ```

3. **Transport Creation**
   ```typescript
   // Old (SSE)
   const transport = new SSEServerTransport('/message', res);
   
   // New (Streamable HTTP)
   const transport = new StreamableHTTPServerTransport({
     sessionIdGenerator: () => sessionId,
   });
   ```

### Client Configuration

1. **MCP Configuration (.mcp.json)**
   ```json
   // Old (SSE)
   {
     "mcpServers": {
       "service-desk-plus": {
         "type": "sse",
         "url": "http://localhost:3456/sse",
         "env": {
           "SDP_CLIENT_ID": "...",
           "SDP_CLIENT_SECRET": "..."
         }
       }
     }
   }
   
   // New (Streamable HTTP)
   {
     "mcpServers": {
       "service-desk-plus": {
         "type": "http",
         "url": "http://localhost:3456/mcp",
         "headers": {
           "x-sdp-client-id": "...",
           "x-sdp-client-secret": "..."
         }
       }
     }
   }
   ```

2. **Client Code**
   ```javascript
   // Old (SSE)
   import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
   const transport = new SSEClientTransport(new URL(url));
   
   // New (Streamable HTTP)
   import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
   const transport = new StreamableHTTPClientTransport(new URL(url), { headers });
   ```

## Running the New Server

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Start the Streamable HTTP server**
   ```bash
   npm run start:self-client-http
   ```

3. **Test with the new client**
   ```bash
   node test-streamable-http-client.js
   ```

## Backward Compatibility

For servers that need to support both old SSE clients and new Streamable HTTP clients:

1. Keep both server implementations running on different ports
2. Or implement a dual-transport server that handles both protocols
3. Gradually migrate clients to the new transport

## Migration Checklist

- [ ] Update MCP SDK to version 1.10.0 or later
- [ ] Replace SSE imports with Streamable HTTP imports
- [ ] Update server endpoints from `/sse` to `/mcp`
- [ ] Update client configuration from `type: "sse"` to `type: "http"`
- [ ] Move credentials from `env` to `headers` in client config
- [ ] Test all MCP tools with the new transport
- [ ] Update documentation and client instructions

## Troubleshooting

### "Cannot find module" errors
- Ensure MCP SDK is updated to latest version: `npm install @modelcontextprotocol/sdk@latest`

### Authentication failures
- Check that headers are properly configured in client
- Verify credentials are in `headers` not `env` section

### Connection timeouts
- Streamable HTTP uses POST requests, ensure firewall allows POST to `/mcp`
- Check that the server is listening on the correct port

## Conclusion

The migration to Streamable HTTP transport resolves the Node.js compatibility issues with SSE and provides a more robust, modern transport mechanism for MCP communication. The new implementation maintains all the self-client authentication features while improving reliability and compatibility.

## Implementation Success

### Port Binding Fix
During implementation, we encountered a port binding issue where the server wouldn't listen on port 3456. Research revealed this was due to Express async handling. The fix involved:

1. **Changed host binding** from '0.0.0.0' to '127.0.0.1'
2. **Used event listeners** instead of callback in `app.listen()`
3. **Added error handling** for EADDRINUSE and EADDRNOTAVAIL

```typescript
// Fixed implementation
httpServer = app.listen(port, host);

httpServer.on('listening', () => {
  console.log('✨ Service Desk Plus MCP Server Ready');
});

httpServer.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
  }
  process.exit(1);
});
```

### Test Results
- ✅ Server starts and binds to port 3456 successfully  
- ✅ Health check endpoint responds: `{"status":"healthy","transport":"streamable-http"}`
- ✅ OAuth initialization endpoint works correctly
- ✅ All Self-Client Authentication features preserved
- ✅ Session management and isolation maintained