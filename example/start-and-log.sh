#!/bin/bash
# Start MCP SSE server with logging
node ../src/mcp-sse-server.js 2>&1 | tee mcp-server.log