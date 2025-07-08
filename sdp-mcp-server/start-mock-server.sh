#!/bin/bash

# Start Mock SDP API and SSE Server for testing
# This allows testing without affecting real Service Desk Plus data

echo "🧪 Starting Mock Service Desk Plus API Server..."

# Set environment variable to use mock API
export SDP_USE_MOCK_API=true
export SDP_BASE_URL=http://localhost:3457
export MOCK_SDP_PORT=3457

# Start mock API server in background
echo "Starting mock API on port 3457..."
node src/mock-sdp-api-server.cjs &
MOCK_PID=$!

# Wait for mock server to start
sleep 2

# Start SSE server
echo ""
echo "🚀 Starting SSE MCP Server with mock API..."
echo "Mock API: http://localhost:3457/app/itdesk/api/v3"
echo "MCP Server: http://localhost:3456/sse"
echo ""

# Trap to kill both processes on exit
trap "kill $MOCK_PID 2>/dev/null" EXIT

# Start the SSE server (it will use mock API due to env var)
node src/working-sse-server.cjs