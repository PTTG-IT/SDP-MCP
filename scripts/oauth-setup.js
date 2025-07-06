#!/usr/bin/env node

/**
 * OAuth Setup Script for Self Client Authentication
 * Helps administrators complete the initial OAuth flow for each client
 */

const axios = require('axios');
const readline = require('readline');
const chalk = require('chalk');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log(chalk.bold('🔐 Service Desk Plus - OAuth Self Client Setup'));
  console.log(chalk.bold('===========================================\n'));

  // Check server configuration
  if (!process.env.SDP_BASE_URL || !process.env.SDP_INSTANCE_NAME) {
    console.error(chalk.red('❌ Missing required environment variables:'));
    console.error(chalk.yellow('   SDP_BASE_URL and SDP_INSTANCE_NAME must be set in .env'));
    process.exit(1);
  }

  console.log(chalk.green('✅ Server configured for:'));
  console.log(`   Instance: ${chalk.bold(process.env.SDP_INSTANCE_NAME)}`);
  console.log(`   Base URL: ${chalk.bold(process.env.SDP_BASE_URL)}\n`);

  console.log(chalk.yellow('📋 Before you begin:'));
  console.log('1. Go to https://api-console.zoho.com/');
  console.log('2. Create a Self Client (if not already done)');
  console.log('3. Generate an authorization code with these scopes:');
  console.log(chalk.cyan('   SDPOnDemand.requests.ALL,SDPOnDemand.users.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.tasks.ALL,SDPOnDemand.setup.READ'));
  console.log('4. Set access_type to "offline" to get refresh token');
  console.log('5. Copy the authorization code (valid for 1 minute)\n');

  // Get client details
  const clientId = await question('Enter Client ID: ');
  const clientSecret = await question('Enter Client Secret: ');
  const authCode = await question('Enter Authorization Code: ');

  console.log('\n🔄 Exchanging authorization code for tokens...');

  try {
    // First, exchange the code for tokens directly
    const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode.trim(),
      client_id: clientId.trim(),
      client_secret: clientSecret.trim()
    });

    const tokenResponse = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log(chalk.green('✅ Token exchange successful!'));
    console.log(`   Access Token: ${tokenResponse.data.access_token.substring(0, 20)}...`);
    console.log(`   Refresh Token: ${tokenResponse.data.refresh_token ? tokenResponse.data.refresh_token.substring(0, 20) + '...' : 'Not received'}`);
    console.log(`   Expires In: ${tokenResponse.data.expires_in} seconds`);

    if (!tokenResponse.data.refresh_token) {
      console.error(chalk.red('\n❌ No refresh token received!'));
      console.error(chalk.yellow('   Make sure you set access_type to "offline" when generating the code'));
      process.exit(1);
    }

    // Now store in the MCP server
    console.log('\n📡 Storing tokens in MCP server...');
    
    const serverUrl = `http://localhost:${process.env.SDP_HTTP_PORT || '3456'}/oauth/setup`;
    
    try {
      const setupResponse = await axios.post(serverUrl, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        authCode: authCode.trim()
      });

      console.log(chalk.green('✅ Tokens stored successfully in MCP server!'));
      console.log(`   Token expires at: ${new Date(setupResponse.data.expiresAt).toLocaleString()}`);
    } catch (serverError) {
      console.error(chalk.red('\n❌ Failed to store tokens in MCP server:'));
      console.error(chalk.yellow(`   ${serverError.response?.data?.message || serverError.message}`));
      console.error(chalk.yellow('\n   Make sure the MCP server is running with:'));
      console.error(chalk.cyan('   npm run start:self-client'));
    }

    console.log(chalk.bold('\n✅ Setup Complete!'));
    console.log('\nThe user can now configure their .mcp.json as follows:');
    console.log(chalk.gray(JSON.stringify({
      mcpServers: {
        "service-desk-plus": {
          type: "sse",
          url: `http://localhost:${process.env.SDP_HTTP_PORT || '3456'}/sse`,
          env: {
            SDP_CLIENT_ID: clientId.trim(),
            SDP_CLIENT_SECRET: clientSecret.trim()
          }
        }
      }
    }, null, 2)));

  } catch (error) {
    console.error(chalk.red('\n❌ OAuth setup failed:'));
    if (error.response?.data) {
      console.error(chalk.yellow(`   ${error.response.data.error || 'Unknown error'}`));
      console.error(chalk.yellow(`   ${error.response.data.error_description || ''}`));
    } else {
      console.error(chalk.yellow(`   ${error.message}`));
    }
    
    console.log(chalk.yellow('\n💡 Common issues:'));
    console.log('   - Authorization code expired (regenerate it)');
    console.log('   - Invalid Client ID or Secret');
    console.log('   - Wrong scopes or access_type');
  }

  rl.close();
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});