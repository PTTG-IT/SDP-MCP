#!/bin/bash

# Start Service Desk Plus MCP Server with Multi-Transport Support

echo "Starting Service Desk Plus MCP Server V4 with Multi-Transport..."
echo "================================================"

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Set multi-transport mode
export SDP_TRANSPORT_MODE=multi

# Start the server
npm run start:v4