#!/bin/bash
echo "Debugging mcp-remote connection..."
echo ""

# Test the MCP server is running
echo "1. Testing server health:"
curl -s http://localhost:3456/health || echo "Server not running"
echo ""

# Test mcp-remote with debug output
echo "2. Testing mcp-remote with debug:"
npx mcp-remote@latest --debug http://localhost:3456/sse 2>&1 | head -20

# Try the test client
echo ""
echo "3. Testing with mcp-remote-client:"
timeout 10 npx -p mcp-remote@latest mcp-remote-client http://localhost:3456/sse 2>&1