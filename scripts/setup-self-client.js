#!/usr/bin/env node
/**
 * Setup script for Zoho Self Client OAuth
 * This helps exchange a grant token for refresh and access tokens
 */

import axios from 'axios';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupSelfClient() {
  console.log('=== Zoho Self Client OAuth Setup ===\n');
  console.log('This script will help you exchange your grant token for refresh and access tokens.\n');
  
  console.log('Prerequisites:');
  console.log('1. You have created a Self Client in Zoho Developer Console');
  console.log('2. You have generated a grant token with the required scopes');
  console.log('3. The grant token is still valid (not expired)\n');

  try {
    // Get user inputs
    const clientId = await question('Enter your Client ID: ');
    const clientSecret = await question('Enter your Client Secret: ');
    const grantToken = await question('Enter your Grant Token: ');
    
    console.log('\nSelect your data center:');
    console.log('1. US (accounts.zoho.com)');
    console.log('2. EU (accounts.zoho.eu)');
    console.log('3. IN (accounts.zoho.in)');
    console.log('4. AU (accounts.zoho.com.au)');
    console.log('5. CN (accounts.zoho.com.cn)');
    
    const dcChoice = await question('Enter choice (1-5): ');
    
    const dataCenters = {
      '1': 'https://accounts.zoho.com',
      '2': 'https://accounts.zoho.eu',
      '3': 'https://accounts.zoho.in',
      '4': 'https://accounts.zoho.com.au',
      '5': 'https://accounts.zoho.com.cn'
    };
    
    const baseAuthUrl = dataCenters[dcChoice] || dataCenters['1'];
    
    console.log('\nExchanging grant token for access and refresh tokens...');
    
    // Exchange grant token
    const tokenUrl = `${baseAuthUrl}/oauth/v2/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: grantToken
    });

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data.access_token && response.data.refresh_token) {
      console.log('\n✅ Success! Tokens obtained.');
      console.log('Access Token expires in:', response.data.expires_in, 'seconds');
      
      // Create .env.oauth file
      const envContent = `# Zoho Self Client OAuth Configuration
# Generated on ${new Date().toISOString()}

# OAuth Credentials
SDP_CLIENT_ID=${clientId}
SDP_CLIENT_SECRET=${clientSecret}
SDP_REFRESH_TOKEN=${response.data.refresh_token}

# OAuth URLs
SDP_AUTH_BASE_URL=${baseAuthUrl}
SDP_TOKEN_URL=${baseAuthUrl}/oauth/v2/token

# Token Info (for reference only - do not use directly)
# Access tokens expire after 1 hour and should be refreshed programmatically
# INITIAL_ACCESS_TOKEN=${response.data.access_token}
# TOKEN_TYPE=${response.data.token_type}
# EXPIRES_IN=${response.data.expires_in}
${response.data.scope ? `# SCOPE=${response.data.scope}` : ''}
`;

      const envPath = path.join(__dirname, '..', '.env.oauth');
      fs.writeFileSync(envPath, envContent);
      
      console.log('\n📁 Configuration saved to .env.oauth');
      console.log('\nNext steps:');
      console.log('1. Copy the OAuth variables from .env.oauth to your .env file');
      console.log('2. Update your code to use the refresh token for authentication');
      console.log('3. The refresh token can be used indefinitely to get new access tokens');
      
      // Test the refresh token
      const testRefresh = await question('\nWould you like to test the refresh token? (y/n): ');
      
      if (testRefresh.toLowerCase() === 'y') {
        console.log('\nTesting refresh token...');
        
        const refreshParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: response.data.refresh_token,
          client_id: clientId,
          client_secret: clientSecret
        });
        
        const refreshResponse = await axios.post(tokenUrl, refreshParams, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        if (refreshResponse.data.access_token) {
          console.log('✅ Refresh token works! New access token obtained.');
          console.log('New token expires in:', refreshResponse.data.expires_in, 'seconds');
        }
      }
      
    } else {
      console.error('❌ Error: No tokens received in response');
      console.error('Response:', response.data);
    }
    
  } catch (error) {
    console.error('\n❌ Error during setup:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
      
      if (error.response.data?.error === 'invalid_code') {
        console.error('\nThe grant token is invalid or expired.');
        console.error('Please generate a new grant token and try again.');
      }
    } else {
      console.error(error.message);
    }
  } finally {
    rl.close();
  }
}

// Run the setup
setupSelfClient().catch(console.error);