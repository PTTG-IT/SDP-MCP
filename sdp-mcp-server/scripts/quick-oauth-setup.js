#!/usr/bin/env node

/**
 * Quick OAuth setup script - standalone version
 * This doesn't depend on other project files
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Simple encryption for tokens
function encrypt(text, key) {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(64);
  const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha256');
  
  const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  });
}

async function main() {
  console.log('🔧 Quick OAuth Token Setup for Service Desk Plus');
  console.log('===============================================\n');
  
  const authCode = process.argv[2];
  
  if (!authCode) {
    console.error('❌ Please provide the authorization code as an argument');
    console.error('\nUsage: node scripts/quick-oauth-setup.js <authorization-code>');
    console.error('\nExample:');
    console.error('node scripts/quick-oauth-setup.js 1000.abc123def456...');
    process.exit(1);
  }
  
  // Load .env file manually
  const envPath = path.join(__dirname, '..', '.env');
  let env = {};
  
  try {
    const envContent = await fs.readFile(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    });
  } catch (error) {
    console.error('❌ Could not read .env file. Please create it from .env.example');
    process.exit(1);
  }
  
  const config = {
    clientId: env.SDP_OAUTH_CLIENT_ID,
    clientSecret: env.SDP_OAUTH_CLIENT_SECRET,
    redirectUri: env.SDP_OAUTH_REDIRECT_URI || 'https://localhost:3000/callback',
    dataCenter: env.SDP_DATA_CENTER || 'US',
    tenantId: env.SDP_TENANT_ID || 'default',
    encryptionKey: env.ENCRYPTION_KEY || 'default-encryption-key-change-this',
  };
  
  if (!config.clientId || !config.clientSecret) {
    console.error('❌ Missing OAuth configuration in .env file');
    console.error('\nRequired:');
    console.error('- SDP_OAUTH_CLIENT_ID');
    console.error('- SDP_OAUTH_CLIENT_SECRET');
    process.exit(1);
  }
  
  // Token endpoints by data center
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
  
  const tokenUrl = tokenEndpoints[config.dataCenter] || tokenEndpoints.US;
  
  console.log('📋 Configuration:');
  console.log(`   Client ID: ${config.clientId.substring(0, 10)}...`);
  console.log(`   Data Center: ${config.dataCenter}`);
  console.log(`   Token URL: ${tokenUrl}`);
  console.log(`   Auth Code: ${authCode.substring(0, 20)}...`);
  
  try {
    console.log('\n🔄 Exchanging authorization code for tokens...');
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', config.clientId);
    params.append('client_secret', config.clientSecret);
    params.append('redirect_uri', config.redirectUri);
    params.append('code', authCode);
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    const tokens = response.data;
    
    console.log('\n✅ Successfully obtained tokens!');
    console.log(`   Access Token: ${tokens.access_token.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${tokens.refresh_token.substring(0, 20)}...`);
    console.log(`   Expires In: ${tokens.expires_in} seconds`);
    console.log(`   Scopes: ${tokens.scope || 'Not specified'}`);
    
    // Save tokens to file
    const tokenData = {
      tenantId: config.tenantId,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        obtained_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      encrypted: {
        access_token: encrypt(tokens.access_token, config.encryptionKey),
        refresh_token: encrypt(tokens.refresh_token, config.encryptionKey),
      },
    };
    
    const tokenFile = path.join(__dirname, '..', '.tokens.json');
    await fs.writeFile(tokenFile, JSON.stringify(tokenData, null, 2), 'utf8');
    
    console.log(`\n📁 Tokens saved to: ${tokenFile}`);
    console.log('\n🎉 OAuth setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Test the connection: node scripts/test-oauth-connection.js');
    console.log('2. Fix TypeScript errors and build the project');
    console.log('3. Start the MCP server');
    
    // Also create a simple SQL file for manual database insertion if needed
    const sqlFile = path.join(__dirname, '..', 'insert-tokens.sql');
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    
    const sql = `-- Manual token insertion for PostgreSQL
-- Run this if automatic insertion fails

INSERT INTO oauth_tokens (
  tenant_id,
  access_token,
  refresh_token,
  expires_at,
  scopes,
  last_refreshed
) VALUES (
  '${config.tenantId}',
  '${encrypt(tokens.access_token, config.encryptionKey)}',
  '${encrypt(tokens.refresh_token, config.encryptionKey)}',
  '${expiresAt}',
  ARRAY[${tokens.scope ? tokens.scope.split(' ').map(s => `'${s}'`).join(', ') : ''}],
  CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id) 
DO UPDATE SET
  access_token = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  expires_at = EXCLUDED.expires_at,
  scopes = EXCLUDED.scopes,
  last_refreshed = CURRENT_TIMESTAMP;
`;
    
    await fs.writeFile(sqlFile, sql, 'utf8');
    console.log(`\n💾 SQL backup created: ${sqlFile}`);
    
  } catch (error) {
    console.error('\n❌ Token exchange failed:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.data.error === 'invalid_code') {
        console.error('\n⚠️  The authorization code has expired or is invalid.');
        console.error('   Please generate a new code and try again.');
      }
    } else {
      console.error(`   Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);