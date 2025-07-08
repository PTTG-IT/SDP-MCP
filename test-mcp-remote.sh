#!/bin/bash
echo "Testing mcp-remote connection to SSE server..."
echo "This simulates what Claude Desktop does"
echo ""

# Test if server is reachable
echo "1. Testing server health..."
curl -s http://localhost:3456/health || echo "Server not reachable"
echo ""

# Test SSE endpoint
echo "2. Testing SSE endpoint..."
curl -s -N http://localhost:3456/sse 2>&1 | head -5
echo ""

# Test with npx mcp-remote
echo "3. Testing with mcp-remote..."
timeout 5 npx mcp-remote http://localhost:3456/sse 2>&1 || echo "mcp-remote failed"