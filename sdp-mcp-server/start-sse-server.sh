#!/bin/bash

# Start the SDP MCP SSE Server

# Kill any existing process
pkill -f "node src/working-sse-server.cjs" 2>/dev/null

# Start the server
echo "Starting SDP MCP SSE Server..."
node src/working-sse-server.cjs

# If the server exits, show the last few lines of output
echo "Server stopped. Check server.log for details."