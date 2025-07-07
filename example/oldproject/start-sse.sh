#!/bin/bash

# Start Service Desk Plus MCP Server - SSE Only Mode
# Production-ready SSE server with enhanced security

echo "Starting Service Desk Plus MCP Server (SSE-Only)..."
echo "================================================"

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.sse.example to .env and configure it."
    exit 1
fi

# Verify required environment variables
source .env

if [ -z "$SDP_CLIENT_ID" ] || [ -z "$SDP_CLIENT_SECRET" ] || [ -z "$SDP_INSTANCE_NAME" ]; then
    echo "ERROR: Missing required configuration in .env file"
    echo "Required: SDP_CLIENT_ID, SDP_CLIENT_SECRET, SDP_INSTANCE_NAME"
    exit 1
fi

if [ -z "$SDP_API_KEYS" ]; then
    echo "WARNING: No API keys configured (SDP_API_KEYS)"
    echo "SSE connections will not be authenticated!"
fi

# Build if needed
if [ ! -d "dist" ]; then
    echo "Building project..."
    npm run build
fi

# Start the SSE server
npm run start:sse