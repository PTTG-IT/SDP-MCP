#!/bin/bash

# Replace these with your actual values
CLIENT_ID="YOUR_CLIENT_ID_HERE"
CLIENT_SECRET="YOUR_CLIENT_SECRET_HERE"
AUTH_CODE="YOUR_AUTH_CODE_HERE"

echo "Exchanging authorization code for tokens..."

curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "code=$AUTH_CODE" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  | python3 -m json.tool

echo -e "\n\nCopy the refresh_token value from above"