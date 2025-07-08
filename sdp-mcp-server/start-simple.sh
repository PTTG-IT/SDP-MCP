#!/bin/bash

# Start the simple JavaScript SSE MCP server
# This version works immediately without TypeScript compilation

echo "🚀 Starting SDP MCP Server (Simple JavaScript version)..."

# Change to the server directory
cd "$(dirname "$0")"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found. Creating from example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "📝 Created .env file. Please update it with your credentials."
    else
        echo "❌ Error: No .env.example file found."
        exit 1
    fi
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the JavaScript server directly
echo "🚀 Starting server on port 3456..."
node src/simple-sse-server.cjs