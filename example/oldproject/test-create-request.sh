#!/bin/bash

echo "Testing Self-Client Authentication - Create Request"
echo "=================================================="

# Test health endpoint first
echo -e "\n1. Testing health endpoint..."
curl -s http://localhost:3456/health | jq

# Test OAuth status
echo -e "\n2. Checking OAuth status..."
curl -s -X POST http://localhost:3456/oauth/initialize \
  -H "Content-Type: application/json" \
  -d '{"clientId": "1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU"}' | jq '.needsSetup'

# Connect to SSE endpoint and send create_request command
echo -e "\n3. Creating test request via SSE..."

# Create a test using curl with SSE headers
(
echo -e "GET /sse HTTP/1.1\r"
echo -e "Host: localhost:3456\r"
echo -e "Accept: text/event-stream\r"
echo -e "Cache-Control: no-cache\r"
echo -e "x-sdp-client-id: 1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU\r"
echo -e "x-sdp-client-secret: 5752f7060c587171f81b21d58c5b8d0019587ca999\r"
echo -e "Connection: keep-alive\r"
echo -e "\r"
) | nc localhost 3456

echo -e "\n\nTest completed!"