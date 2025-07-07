# Migration Guide: Multi-Transport to SSE-Only

This guide helps you migrate from the multi-transport Service Desk Plus MCP server (V4) to the streamlined SSE-only version.

## Why Migrate?

### Benefits of SSE-Only
- **Simplified Architecture** - No transport manager complexity
- **Better Security** - Built-in authentication and rate limiting
- **Production Ready** - Connection limits, monitoring, keep-alive
- **Resource Efficient** - Lower memory footprint
- **Easier Maintenance** - Single transport to support

### What You Lose
- Local stdio connections (must use SSE for all clients)
- Transport mode switching
- Legacy compatibility

## Pre-Migration Checklist

- [ ] All clients support SSE transport
- [ ] API keys generated for all clients
- [ ] Network connectivity between clients and server
- [ ] Backup of current configuration
- [ ] Database backup (if using persistent tokens)

## Migration Steps

### 1. Prepare New Configuration

Create new `.env` file based on SSE example:

```bash
# Backup existing config
cp .env .env.backup

# Create new config
cp .env.sse.example .env
```

Key changes:
- Remove `SDP_TRANSPORT_MODE`
- Add `SDP_API_KEYS` (required)
- Update `SDP_HTTP_HOST` if needed
- Configure production limits

### 2. Update Client Configurations

#### Claude Desktop

Update `~/.claude/claude_desktop_config.json`:

**Before (stdio):**
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

**After (SSE):**
```json
{
  "mcpServers": {
    "service-desk-plus": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3000/sse",
        "headers": {
          "X-API-Key": "your-api-key-here"
        }
      }
    }
  }
}
```

### 3. Build and Deploy

```bash
# Stop old server
pm2 stop sdp-mcp-server

# Update and build
git pull
npm install
npm run build

# Start SSE server
pm2 start dist/indexSSE.js --name sdp-mcp-sse
```

### 4. Verify Migration

```bash
# Check health
curl http://localhost:3000/health

# Test authentication
curl -H "X-API-Key: your-api-key" http://localhost:3000/sessions

# Monitor logs
pm2 logs sdp-mcp-sse
```

## Configuration Mapping

| Old Variable | New Variable | Notes |
|-------------|--------------|-------|
| `SDP_TRANSPORT_MODE` | (removed) | SSE-only, no modes |
| `SDP_HTTP_PORT` | `SDP_HTTP_PORT` | Same |
| `SDP_HTTP_HOST` | `SDP_HTTP_HOST` | Default changed to 127.0.0.1 |
| N/A | `SDP_API_KEYS` | Required for authentication |
| N/A | `SSE_MAX_CONNECTIONS_PER_IP` | New production feature |
| N/A | `SSE_SESSION_TIMEOUT` | New production feature |

## Common Issues

### "API key required" Error

**Problem:** Clients can't connect
**Solution:** Add API keys to `.env`:
```env
SDP_API_KEYS=key1,key2,key3
```

### Connection Refused

**Problem:** Server not accessible
**Solution:** Check host binding:
```env
# For local only
SDP_HTTP_HOST=127.0.0.1

# For network access
SDP_HTTP_HOST=0.0.0.0
```

### Rate Limit Errors

**Problem:** Too many requests
**Solution:** Adjust limits:
```env
SSE_RATE_LIMIT_PER_MIN=120
SSE_MAX_CONNECTIONS_PER_IP=20
```

### Session Timeouts

**Problem:** Connections dropping
**Solution:** Increase timeout:
```env
SSE_SESSION_TIMEOUT=3600000  # 1 hour
```

## Rollback Plan

If you need to rollback:

```bash
# Stop SSE server
pm2 stop sdp-mcp-sse

# Restore old config
cp .env.backup .env

# Start old server
pm2 start dist/indexV4.js --name sdp-mcp-server
```

## Performance Comparison

| Metric | Multi-Transport | SSE-Only |
|--------|----------------|----------|
| Memory Usage | ~150MB | ~100MB |
| Startup Time | ~3s | ~2s |
| Connection Overhead | High | Low |
| Code Complexity | High | Low |

## Security Improvements

### New in SSE-Only
1. **Mandatory API Keys** - No unauthenticated access
2. **Per-Connection Rate Limiting** - Prevent abuse
3. **IP-Based Connection Limits** - DDoS protection
4. **Session Tracking** - Better monitoring

### Best Practices
- Use unique API keys per client
- Implement IP allowlists for production
- Monitor connection statistics
- Regular key rotation

## Monitoring Changes

### New Endpoints

```bash
# Connection statistics
GET /sessions

# Health with connection info
GET /health

# Rate limit status (if enabled)
GET /rate-limit-status
```

### Logs to Watch

```bash
# Connection events
[timestamp] New SSE connection: session-id
[timestamp] SSE disconnection: session-id

# Security events
[timestamp] Invalid API key attempt from IP
[timestamp] Connection limit exceeded for IP

# Rate limiting
[timestamp] Rate limit exceeded for session
```

## FAQ

**Q: Can I run both versions simultaneously?**
A: Yes, use different ports:
```env
# Old server
SDP_HTTP_PORT=3000

# New SSE server
SDP_HTTP_PORT=3001
```

**Q: Do I need to update the SDK?**
A: No, the MCP SDK already supports SSE transport.

**Q: Will my tools still work?**
A: Yes, all tools remain the same. Only the transport changes.

**Q: How do I generate secure API keys?**
A: Use: `openssl rand -hex 32`

## Next Steps

After migration:
1. Remove old index files to save space
2. Update documentation for your team
3. Set up monitoring alerts
4. Plan API key rotation schedule

## Support

For issues or questions:
1. Check logs: `pm2 logs sdp-mcp-sse`
2. Test with: `node scripts/test-sse-server.js`
3. Review configuration in `.env`
4. Check production guide: `SSE_PRODUCTION_GUIDE.md`