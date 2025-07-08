#!/usr/bin/env node

/**
 * Setup OAuth tokens for Service Desk Plus
 * Use this script immediately after generating your authorization code
 */

import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { encrypt } from '../src/auth/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(authCode, config) {
  const { clientId, clientSecret, redirectUri, dataCenter } = config;
  
  // Determine the token endpoint based on data center
  const tokenEndpoints = {
    US: 'https://accounts.zoho.com/oauth/v2/token',
    EU: 'https://accounts.zoho.eu/oauth/v2/token',
    IN: 'https://accounts.zoho.in/oauth/v2/token',
    AU: 'https://accounts.zoho.com.au/oauth/v2/token',
    JP: 'https://accounts.zoho.jp/oauth/v2/token',
    UK: 'https://accounts.zoho.uk/oauth/v2/token',
    CA: 'https://accounts.zohocloud.ca/oauth/v2/token',
    CN: 'https://accounts.zoho.com.cn/oauth/v2/token',
  };
  
  const tokenUrl = tokenEndpoints[dataCenter] || tokenEndpoints.US;
  
  try {
    console.log(`\n🔄 Exchanging authorization code for tokens...`);
    console.log(`   Data Center: ${dataCenter}`);
    console.log(`   Token URL: ${tokenUrl}`);
    
    const response = await axios.post(tokenUrl, null, {
      params: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: authCode,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('❌ Token exchange failed:', error.response.data);
      if (error.response.data.error === 'invalid_code') {
        console.error('\n⚠️  The authorization code has expired or is invalid.');
        console.error('   Please generate a new code from your self-client and try again.');
      }
    } else {
      console.error('❌ Network error:', error.message);
    }
    throw error;
  }
}

/**
 * Save tokens to database
 */
async function saveTokensToDatabase(tokens, tenantId) {
  // Import database connection
  const { getDatabase } = await import('../src/database/connection.js');
  
  try {
    const db = await getDatabase();
    
    // Encrypt tokens
    const encryptedAccess = encrypt(tokens.access_token);
    const encryptedRefresh = encrypt(tokens.refresh_token);
    
    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600));
    
    // Upsert tokens
    await db.query(
      `INSERT INTO oauth_tokens (
        tenant_id, 
        access_token, 
        refresh_token, 
        expires_at, 
        scopes,
        last_refreshed
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id) 
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        scopes = EXCLUDED.scopes,
        last_refreshed = CURRENT_TIMESTAMP`,
      [
        tenantId,
        encryptedAccess,
        encryptedRefresh,
        expiresAt,
        tokens.scope ? tokens.scope.split(' ') : [],
      ]
    );
    
    console.log('✅ Tokens saved to database');
  } catch (error) {
    console.error('❌ Failed to save tokens to database:', error);
    throw error;
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log('🔧 Service Desk Plus OAuth Token Setup');
  console.log('=====================================\n');
  
  // Check for authorization code in command line args
  const authCode = process.argv[2];
  
  if (!authCode) {
    console.error('❌ Please provide the authorization code as an argument');
    console.error('\nUsage: npm run setup-oauth <authorization-code>');
    console.error('\nExample:');
    console.error('npm run setup-oauth 1000.abc123def456...');
    console.error('\n📝 Steps to get authorization code:');
    console.error('1. Go to Service Desk Plus Developer Console');
    console.error('2. Select your self-client application');
    console.error('3. Go to "Generate Code" tab');
    console.error('4. Enter required scopes and generate code');
    console.error('5. Copy the code and run this script immediately (code expires in 10 minutes)');
    process.exit(1);
  }
  
  // Get configuration from environment
  const config = {
    clientId: process.env.SDP_OAUTH_CLIENT_ID,
    clientSecret: process.env.SDP_OAUTH_CLIENT_SECRET,
    redirectUri: process.env.SDP_OAUTH_REDIRECT_URI || 'https://localhost:3000/callback',
    dataCenter: process.env.SDP_DATA_CENTER || 'US',
    tenantId: process.env.SDP_TENANT_ID || 'default',
  };
  
  // Validate configuration
  if (!config.clientId || !config.clientSecret) {
    console.error('❌ Missing OAuth configuration in .env file');
    console.error('\nRequired environment variables:');
    console.error('- SDP_OAUTH_CLIENT_ID');
    console.error('- SDP_OAUTH_CLIENT_SECRET');
    console.error('- SDP_DATA_CENTER (US, EU, IN, AU, JP, UK, CA, CN)');
    console.error('- SDP_TENANT_ID (optional, defaults to "default")');
    process.exit(1);
  }
  
  console.log('📋 Configuration:');
  console.log(`   Client ID: ${config.clientId.substring(0, 10)}...`);
  console.log(`   Data Center: ${config.dataCenter}`);
  console.log(`   Tenant ID: ${config.tenantId}`);
  console.log(`   Auth Code: ${authCode.substring(0, 20)}...`);
  
  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(authCode, config);
    
    console.log('\n✅ Successfully obtained tokens!');
    console.log(`   Access Token: ${tokens.access_token.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${tokens.refresh_token.substring(0, 20)}...`);
    console.log(`   Expires In: ${tokens.expires_in} seconds`);
    console.log(`   Scopes: ${tokens.scope || 'Not specified'}`);
    
    // Save to database
    await saveTokensToDatabase(tokens, config.tenantId);
    
    // Also save to a local file for backup
    const tokenFile = path.join(__dirname, '..', '.tokens.json');
    await fs.writeFile(
      tokenFile,
      JSON.stringify({
        tenantId: config.tenantId,
        tokens: {
          ...tokens,
          obtained_at: new Date().toISOString(),
        },
      }, null, 2),
      'utf8'
    );
    
    console.log(`\n📁 Backup saved to: ${tokenFile}`);
    console.log('\n🎉 OAuth setup complete! Your MCP server is ready to use.');
    console.log('\n📝 Next steps:');
    console.log('1. Start the MCP server: npm run start');
    console.log('2. Configure your MCP client to connect to the server');
    console.log('3. The server will automatically refresh tokens as needed');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
main().catch(console.error);