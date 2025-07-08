#!/usr/bin/env node

/**
 * OAuth flow to get refresh token from Service Desk Plus
 * This opens a browser for user authorization
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { parse } from 'url';
import open from 'open';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const config = {
  clientId: process.env.SDP_OAUTH_CLIENT_ID || '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU',
  clientSecret: process.env.SDP_OAUTH_CLIENT_SECRET || '5752f7060c587171f81b21d58c5b8d0019587ca999',
  portalName: process.env.SDP_PORTAL_NAME || 'kaltentech',
  dataCenter: process.env.SDP_DATA_CENTER || 'US',
  redirectUri: 'http://localhost:8080/callback' // Local callback
};

// Data center to domain mapping
const dataCenterDomains = {
  US: 'com',
  EU: 'eu',
  IN: 'in',
  AU: 'com.au',
  JP: 'jp',
  UK: 'uk',
  CA: 'ca',
  CN: 'com.cn'
};

const domain = dataCenterDomains[config.dataCenter] || 'com';

// OAuth URLs
const authorizationUrl = `https://accounts.zoho.${domain}/oauth/v2/auth`;
const tokenUrl = `https://accounts.zoho.${domain}/oauth/v2/token`;

// Required scopes for Service Desk Plus
const scopes = [
  'SDPOnDemand.requests.ALL',
  'SDPOnDemand.problems.ALL',
  'SDPOnDemand.changes.ALL',
  'SDPOnDemand.projects.ALL',
  'SDPOnDemand.assets.ALL',
  'SDPOnDemand.solutions.ALL',
  'SDPOnDemand.setup.READ',
  'SDPOnDemand.general.ALL'
].join(',');

console.log('🔐 Service Desk Plus OAuth Setup');
console.log('================================\n');
console.log('Configuration:');
console.log(`- Portal: ${config.portalName}`);
console.log(`- Data Center: ${config.dataCenter}`);
console.log(`- Domain: ${domain}`);
console.log(`- Client ID: ${config.clientId.substring(0, 20)}...`);
console.log('\n');

// Create a local server to handle the OAuth callback
function createCallbackServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const urlParts = parse(req.url, true);
      
      if (urlParts.pathname === '/callback') {
        const code = urlParts.query.code;
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>✅ Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>❌ Authorization Failed</h1>
                <p>No authorization code received.</p>
              </body>
            </html>
          `);
          
          server.close();
          reject(new Error('No authorization code received'));
        }
      }
    });
    
    server.listen(8080, () => {
      console.log('📡 Local callback server listening on http://localhost:8080');
    });
  });
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code) {
  try {
    console.log('\n📡 Exchanging authorization code for tokens...');
    
    const response = await axios.post(tokenUrl, new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code: code
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('✅ Tokens obtained successfully');
    return response.data;
  } catch (error) {
    console.error('❌ Error exchanging code:', error.response?.data || error.message);
    throw error;
  }
}

// Update .env file with refresh token
async function updateEnvFile(refreshToken) {
  const envPath = path.join(__dirname, '..', '.env');
  
  try {
    let envContent = await fs.readFile(envPath, 'utf-8');
    
    // Check if refresh token already exists
    if (envContent.includes('SDP_OAUTH_REFRESH_TOKEN=')) {
      // Update existing token
      envContent = envContent.replace(
        /SDP_OAUTH_REFRESH_TOKEN=.*/,
        `SDP_OAUTH_REFRESH_TOKEN=${refreshToken}`
      );
    } else {
      // Add new token after client secret
      envContent = envContent.replace(
        /(SDP_OAUTH_CLIENT_SECRET=.*)/,
        `$1\nSDP_OAUTH_REFRESH_TOKEN=${refreshToken}`
      );
    }
    
    await fs.writeFile(envPath, envContent);
    console.log('✅ Refresh token saved to .env file');
  } catch (error) {
    console.error('❌ Error updating .env file:', error.message);
    console.log(`\n📝 Please add this to your .env file manually:`);
    console.log(`SDP_OAUTH_REFRESH_TOKEN=${refreshToken}`);
  }
}

// Main OAuth flow
async function main() {
  try {
    // Start callback server
    const codePromise = createCallbackServer();
    
    // Build authorization URL
    const authUrl = new URL(authorizationUrl);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', config.clientId);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('redirect_uri', config.redirectUri);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    
    console.log('\n🌐 Opening browser for authorization...');
    console.log('If the browser doesn\'t open, visit this URL manually:');
    console.log(authUrl.toString());
    console.log('\n');
    
    // Open browser
    await open(authUrl.toString());
    
    // Wait for authorization code
    const code = await codePromise;
    
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    console.log('\n📋 Token Information:');
    console.log(`- Access Token: ${tokens.access_token.substring(0, 20)}...`);
    console.log(`- Refresh Token: ${tokens.refresh_token.substring(0, 20)}...`);
    console.log(`- Expires In: ${tokens.expires_in} seconds`);
    console.log(`- Token Type: ${tokens.token_type}`);
    console.log(`- Scope: ${tokens.scope}`);
    
    // Save refresh token to .env
    await updateEnvFile(tokens.refresh_token);
    
    console.log('\n✅ OAuth setup completed successfully!');
    console.log('You can now run API tests with: node scripts/test-api-direct.js');
    
  } catch (error) {
    console.error('\n❌ OAuth setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}