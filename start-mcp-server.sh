#!/bin/bash

# Start the MCP SSE Server

echo "🚀 Starting MCP SSE Server for Service Desk Plus"
echo "==============================================="
echo ""

# Change to project directory
cd "$(dirname "$0")"

# Check for package.json
if [ ! -f "package.json" ]; then
    echo "📦 Creating package.json..."
    cat > package.json << 'EOF'
{
  "name": "sdp-mcp-server",
  "version": "1.0.0",
  "description": "MCP SSE server for Service Desk Plus",
  "type": "commonjs",
  "scripts": {
    "start": "node src/mcp-sse-server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0"
  }
}
EOF
fi

# Install dependencies
if [ ! -d "node_modules" ] || [ ! -d "node_modules/@modelcontextprotocol" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found"
    echo "Creating basic .env file..."
    cat > .env << 'EOF'
# Server Configuration
SDP_HTTP_PORT=3456
SDP_HTTP_HOST=0.0.0.0

# Service Desk Plus Configuration
SDP_PORTAL_NAME=your-portal
SDP_DATA_CENTER=US
EOF
    echo "✅ Created .env file"
    echo ""
fi

# Check if port is in use
PORT=${SDP_HTTP_PORT:-3456}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port $PORT is already in use!"
    echo "   Kill the existing process or change SDP_HTTP_PORT in .env"
    exit 1
fi

# Start the server
echo "🔌 Starting server on port $PORT..."
echo ""
node src/mcp-sse-server.js