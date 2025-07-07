#\!/bin/bash

# Replace these with your actual values
CLIENT_ID="1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU"
CLIENT_SECRET="5752f7060c587171f81b21d58c5b8d0019587ca999"
AUTH_CODE="1000.8cbcb7f981f25ec4658b51cc7d445578.a10f179caa1fa4c3ed03a48326016930"

echo "Setting up OAuth for Service Desk Plus MCP Server..."
echo

curl -X POST http://127.0.0.1:3456/oauth/setup \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"clientSecret\": \"$CLIENT_SECRET\",
    \"authCode\": \"$AUTH_CODE\"
  }" | python3 -m json.tool

echo
echo "OAuth setup complete\!"
