#!/bin/bash

# Service Desk Plus MCP - Personal Instance Launcher
# This script helps you run your own instance with your credentials

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Service Desk Plus MCP - Personal Instance Setup"
echo "=================================================="
echo ""

# Check if .env.personal exists
if [ ! -f .env.personal ]; then
    echo -e "${YELLOW}No .env.personal file found. Creating from template...${NC}"
    
    if [ -f .env.sse.example ]; then
        cp .env.sse.example .env.personal
        echo -e "${GREEN}✅ Created .env.personal from template${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.personal with your Service Desk Plus credentials:${NC}"
        echo "   - SDP_CLIENT_ID"
        echo "   - SDP_CLIENT_SECRET"
        echo "   - SDP_REFRESH_TOKEN"
        echo "   - SDP_BASE_URL"
        echo "   - SDP_INSTANCE_NAME"
        echo "   - SDP_DEFAULT_TECHNICIAN_EMAIL"
        echo ""
        echo "Then run this script again."
        exit 1
    else
        echo -e "${RED}❌ Error: .env.sse.example not found${NC}"
        exit 1
    fi
fi

# Load environment variables
echo "📋 Loading credentials from .env.personal..."
set -a
source .env.personal
set +a

# Validate required variables
MISSING_VARS=()
[ -z "$SDP_CLIENT_ID" ] && MISSING_VARS+=("SDP_CLIENT_ID")
[ -z "$SDP_CLIENT_SECRET" ] && MISSING_VARS+=("SDP_CLIENT_SECRET")
[ -z "$SDP_REFRESH_TOKEN" ] && MISSING_VARS+=("SDP_REFRESH_TOKEN")
[ -z "$SDP_BASE_URL" ] && MISSING_VARS+=("SDP_BASE_URL")
[ -z "$SDP_INSTANCE_NAME" ] && MISSING_VARS+=("SDP_INSTANCE_NAME")

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    printf '%s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "Please edit .env.personal and set these values."
    exit 1
fi

# Set default port if not specified
SDP_HTTP_PORT=${SDP_HTTP_PORT:-3456}

# Generate API key if not set
if [ -z "$SDP_API_KEYS" ] || [ "$SDP_API_KEYS" == "test-key-123456789" ]; then
    echo -e "${YELLOW}⚠️  Generating secure API key...${NC}"
    SDP_API_KEYS=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | head -c 32 | base64)
    echo "SDP_API_KEYS=$SDP_API_KEYS" >> .env.personal
    echo -e "${GREEN}✅ Generated and saved new API key${NC}"
fi

# Check if build is needed
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "🔨 Building project..."
    npm run build
fi

# Update .mcp.json with the API key and port
if [ -f .mcp.json ]; then
    echo "📝 Updating .mcp.json with your configuration..."
    # Create a temporary file with updated config
    cat > .mcp.json.tmp << EOF
{
  "mcpServers": {
    "service-desk-plus": {
      "type": "sse",
      "url": "http://localhost:${SDP_HTTP_PORT}/sse",
      "headers": {
        "X-API-Key": "${SDP_API_KEYS%%,*}"
      }
    }
  }
}
EOF
    mv .mcp.json.tmp .mcp.json
    echo -e "${GREEN}✅ Updated .mcp.json${NC}"
fi

echo ""
echo "🌟 Starting your personal Service Desk Plus MCP server..."
echo "   Instance: $SDP_INSTANCE_NAME"
echo "   Port: $SDP_HTTP_PORT"
echo "   API Key: ${SDP_API_KEYS:0:12}..."
echo ""

# Start the server
exec npm run start:sse