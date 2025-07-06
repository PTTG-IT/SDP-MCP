#!/usr/bin/env node

/**
 * Setup script for initial user creation
 * This helps administrators quickly add users to the registry
 */

const { UserRegistry } = require('../dist/services/userRegistry.js');
const { validateEncryptionSetup } = require('../dist/utils/encryption.js');
const { getPool, testConnection } = require('../dist/db/config.js');
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

function hiddenQuestion(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    stdin.on('data', (char) => {
      const charCode = char.charCodeAt(0);

      if (charCode === 3) { // Ctrl+C
        process.exit();
      } else if (charCode === 13) { // Enter
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write('\n');
        resolve(password);
      } else if (charCode === 127) { // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.clearLine();
          stdout.cursorTo(0);
          stdout.write(prompt + '*'.repeat(password.length));
        }
      } else {
        password += char;
        stdout.write('*');
      }
    });
  });
}

async function setupUser(registry) {
  console.log(chalk.bold('\n📝 Adding new user\n'));

  const userName = await question('User name: ');
  const userEmail = await question('User email (optional): ');
  const clientId = await question('SDP Client ID: ');
  const clientSecret = await hiddenQuestion('SDP Client Secret: ');
  const baseUrl = await question('SDP Base URL (e.g., https://sdpondemand.manageengine.com): ');
  const instanceName = await question('SDP Instance Name: ');
  const refreshToken = await hiddenQuestion('SDP Refresh Token: ');
  const defaultTechnicianEmail = await question('Default technician email (optional): ');
  const notes = await question('Admin notes (optional): ');

  try {
    const { user, apiKey } = await registry.createUser({
      userName,
      userEmail: userEmail || undefined,
      credentials: {
        clientId,
        clientSecret,
        refreshToken,
        baseUrl,
        instanceName,
        defaultTechnicianEmail: defaultTechnicianEmail || undefined
      },
      notes: notes || undefined
    });

    console.log(chalk.green('\n✅ User created successfully!'));
    console.log(chalk.bold('\n🔑 API Key for ' + userName + ':'));
    console.log(chalk.yellow(apiKey));
    
    console.log(chalk.bold('\n📋 Configuration for ' + userName + '\'s .mcp.json:'));
    console.log(chalk.gray(JSON.stringify({
      mcpServers: {
        "service-desk-plus": {
          type: "sse",
          url: `http://${process.env.SDP_HTTP_HOST || 'localhost'}:${process.env.SDP_HTTP_PORT || '3456'}/sse`,
          headers: {
            "X-API-Key": apiKey
          }
        }
      }
    }, null, 2)));

    return true;
  } catch (error) {
    console.error(chalk.red('\n❌ Failed to create user:'), error.message);
    return false;
  }
}

async function main() {
  console.log(chalk.bold('🚀 Service Desk Plus MCP - User Setup'));
  console.log(chalk.bold('=====================================\n'));

  // Validate encryption
  if (!validateEncryptionSetup()) {
    console.error(chalk.red('❌ Encryption validation failed.'));
    console.error(chalk.yellow('\nPlease set the SDP_ENCRYPTION_KEY environment variable.'));
    console.error(chalk.yellow('Example: SDP_ENCRYPTION_KEY=your-32-character-encryption-key-here'));
    process.exit(1);
  }

  // Test database connection
  console.log('📊 Connecting to database...');
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error(chalk.red('❌ Database connection failed.'));
    console.error(chalk.yellow('\nPlease ensure the database is running:'));
    console.error(chalk.yellow('  docker-compose up -d'));
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) {
    console.error(chalk.red('❌ Database pool not available'));
    process.exit(1);
  }

  // Initialize schema
  console.log('📋 Initializing database schema...');
  await UserRegistry.initializeSchema(pool);
  
  const registry = new UserRegistry(pool);
  console.log(chalk.green('✅ Ready to add users!\n'));

  // Show current users
  const existingUsers = await registry.listUsers();
  if (existingUsers.length > 0) {
    console.log(chalk.bold('Current users:'));
    existingUsers.forEach(user => {
      console.log(`  - ${user.userName} (${user.userEmail || 'no email'}) - ${user.isActive ? chalk.green('Active') : chalk.red('Inactive')}`);
    });
  } else {
    console.log(chalk.yellow('No users configured yet.'));
  }

  // Setup loop
  let addMore = true;
  while (addMore) {
    await setupUser(registry);
    
    const response = await question('\nAdd another user? (y/N): ');
    addMore = response.toLowerCase() === 'y';
  }

  console.log(chalk.bold('\n✅ Setup complete!'));
  console.log(chalk.gray('\nTo manage users later, use:'));
  console.log(chalk.gray('  npm run user:admin'));
  
  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});