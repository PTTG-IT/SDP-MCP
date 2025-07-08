#!/bin/bash

# Start the SSE server for Service Desk Plus MCP

echo "🚀 Starting Service Desk Plus MCP Server (SSE mode)"
echo "=================================================="
echo ""

# Change to script directory
cd "$(dirname "$0")"

# Check for required dependencies
echo "📦 Checking dependencies..."

# Check if package.json exists, if not create a minimal one
if [ ! -f "package.json" ]; then
    echo "Creating package.json..."
    cat > package.json << 'EOF'
{
  "name": "sdp-mcp-sse-server",
  "version": "1.0.0",
  "description": "SSE server for Service Desk Plus MCP",
  "type": "commonjs",
  "dependencies": {
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
EOF
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install express cors dotenv @modelcontextprotocol/sdk
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env from .env.example"
        echo "   Please edit .env with your configuration"
    else
        echo "Creating minimal .env file..."
        cat > .env << 'EOF'
# Server Configuration
SDP_HTTP_PORT=3456
SDP_HTTP_HOST=0.0.0.0

# Service Desk Plus Configuration
SDP_PORTAL_NAME=your-portal-name
SDP_DATA_CENTER=US
EOF
        echo "✅ Created minimal .env file"
    fi
    echo ""
fi

# Start the server
echo "🔌 Starting SSE server..."
echo ""
node src/server-sse.js