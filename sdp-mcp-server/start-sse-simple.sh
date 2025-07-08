#!/bin/bash

# Start the simplified SSE MCP server
# This uses the working patterns from the previous implementation

echo "🚀 Starting SDP MCP Server (Simplified SSE mode)..."

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

# Build TypeScript files
echo "🔨 Building TypeScript files..."
npm run build

# Start the server
echo "🚀 Starting server on port 3456..."
node dist/index-sse-simple.js