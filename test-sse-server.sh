#!/bin/bash
cd "$(dirname "$0")"
echo "Starting MCP SSE Server with logging..."
node src/mcp-sse-server.js 2>&1 | tee server-output.log