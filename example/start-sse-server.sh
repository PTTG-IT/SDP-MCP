#!/bin/bash

# Start the SSE server for Service Desk Plus MCP

echo "🚀 Starting Service Desk Plus MCP Server (SSE mode)"
echo "================================================"

# Check if oldproject is built
if [ -d "oldproject/dist" ]; then
    echo "✅ Using compiled modules from oldproject/dist"
else
    echo "⚠️  No compiled modules found, will use fallback implementation"
    echo "   To use full functionality, build oldproject first:"
    echo "   cd oldproject && npm run build"
fi

# Make sure we have required packages
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install express cors dotenv @modelcontextprotocol/sdk
fi

# Start the server
echo ""
echo "🔌 Starting SSE server on port 3456..."
node src/index-sse.js