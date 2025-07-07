#!/bin/bash

echo "Getting new refresh token..."
echo "Enter the authorization code from Zoho API Console:"
read -r AUTH_CODE

CLIENT_ID="YOUR_CLIENT_ID_HERE"
CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"

echo "Exchanging authorization code for tokens..."

RESPONSE=$(curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "code=$AUTH_CODE" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET")

echo "$RESPONSE" | python3 -m json.tool

REFRESH_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('refresh_token', 'NOT_FOUND'))" 2>/dev/null)

if [ "$REFRESH_TOKEN" != "NOT_FOUND" ] && [ "$REFRESH_TOKEN" != "" ]; then
    echo -e "\n✅ New refresh token:"
    echo "$REFRESH_TOKEN"
    echo -e "\nUpdating .mcp.json..."
    
    # Update the .mcp.json file
    python3 -c "
import json
with open('.mcp.json', 'r') as f:
    config = json.load(f)
config['mcpServers']['service-desk-plus']['env']['SDP_REFRESH_TOKEN'] = '$REFRESH_TOKEN'
with open('.mcp.json', 'w') as f:
    json.dump(config, f, indent=2)
print('✅ Updated .mcp.json with new refresh token')
"
    
    echo -e "\nRestart Claude to use the new token."
else
    echo -e "\n❌ Failed to get refresh token. Check the authorization code."
fi