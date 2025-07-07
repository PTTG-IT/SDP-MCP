#!/bin/bash

# Start Script for User-Specific SDP MCP Instance
# Usage: ./start-user-instance.sh <username>
# Example: ./start-user-instance.sh alice

set -e

# Check if username is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <username>"
    echo "Example: $0 alice"
    echo ""
    echo "This will look for .env.<username> file and start the server"
    exit 1
fi

USERNAME=$1
ENV_FILE=".env.$USERNAME"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file '$ENV_FILE' not found!"
    echo ""
    echo "Please create '$ENV_FILE' with the user's SDP credentials."
    echo "You can copy .env.claude.example as a template:"
    echo "  cp .env.claude.example $ENV_FILE"
    echo "  nano $ENV_FILE  # Edit with user's credentials"
    exit 1
fi

# Build the project if needed
if [ ! -d "dist" ]; then
    echo "Building project..."
    npm run build
fi

# Load environment variables and start server
echo "Starting SDP MCP server for user: $USERNAME"
echo "Loading configuration from: $ENV_FILE"
echo ""

# Export environment variables and start the SSE server
export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

# Add username to the server name for identification
export MCP_SERVER_NAME="service-desk-plus-$USERNAME"

# Start the server
echo "Server starting on http://${SDP_HTTP_HOST:-127.0.0.1}:${SDP_HTTP_PORT:-3456}"
echo "Press Ctrl+C to stop"
echo ""

exec node dist/indexSSE.js