#!/usr/bin/env node

/**
 * User Registry Admin CLI
 * Tool for managing user API key mappings
 */

import { Command } from 'commander';
import { UserRegistry } from '../services/userRegistry.js';
import { validateEncryptionSetup } from '../utils/encryption.js';
import { getPool, testConnection } from '../db/config.js';
import { SDPCredentialsToEncrypt } from '../utils/encryption.js';
import { table } from 'table';
import chalk from 'chalk';
import inquirer from 'inquirer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

/**
 * Initialize database and user registry
 */
async function initializeRegistry(): Promise<UserRegistry> {
  // Validate encryption
  if (!validateEncryptionSetup()) {
    console.error(chalk.red('❌ Encryption validation failed. Check SDP_ENCRYPTION_KEY environment variable.'));
    process.exit(1);
  }

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error(chalk.red('❌ Database connection failed. Check your database configuration.'));
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) {
    console.error(chalk.red('❌ Database pool not available'));
    process.exit(1);
  }

  // Initialize schema
  await UserRegistry.initializeSchema(pool);
  
  return new UserRegistry(pool);
}

/**
 * Format user data for display
 */
function formatUserTable(users: any[]): string {
  if (users.length === 0) {
    return chalk.yellow('No users found');
  }

  const data = [
    ['ID', 'Name', 'Email', 'API Key', 'Active', 'Last Used', 'Usage Count'],
    ...users.map(user => [
      user.id.toString(),
      user.userName,
      user.userEmail || '-',
      user.apiKey.substring(0, 16) + '...',
      user.isActive ? chalk.green('✓') : chalk.red('✗'),
      user.lastUsedAt ? new Date(user.lastUsedAt).toLocaleDateString() : 'Never',
      user.usageCount.toString()
    ])
  ];

  return table(data);
}

// Main CLI configuration
program
  .name('sdp-user-admin')
  .description('Service Desk Plus MCP User Registry Administration')
  .version('1.0.0');

// List users command
program
  .command('list')
  .description('List all users')
  .option('-a, --all', 'Include inactive users')
  .action(async (options) => {
    try {
      const registry = await initializeRegistry();
      const users = await registry.listUsers(options.all);
      
      console.log(chalk.bold('\n📋 User Registry\n'));
      console.log(formatUserTable(users));
      console.log(chalk.gray(`\nTotal: ${users.length} user(s)`));
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Create user command
program
  .command('create')
  .description('Create a new user')
  .option('-n, --name <name>', 'User name')
  .option('-e, --email <email>', 'User email')
  .option('--notes <notes>', 'Admin notes')
  .action(async (options) => {
    try {
      const registry = await initializeRegistry();
      
      // Prompt for user details
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'userName',
          message: 'User name:',
          default: options.name,
          validate: (input) => input.length > 0 || 'Name is required'
        },
        {
          type: 'input',
          name: 'userEmail',
          message: 'User email (optional):',
          default: options.email
        },
        {
          type: 'input',
          name: 'clientId',
          message: 'SDP Client ID:',
          validate: (input) => input.length > 0 || 'Client ID is required'
        },
        {
          type: 'password',
          name: 'clientSecret',
          message: 'SDP Client Secret:',
          mask: '*',
          validate: (input) => input.length > 0 || 'Client Secret is required'
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: 'SDP Base URL (e.g., https://sdpondemand.manageengine.com):',
          validate: (input) => input.length > 0 || 'Base URL is required'
        },
        {
          type: 'input',
          name: 'instanceName',
          message: 'SDP Instance Name:',
          validate: (input) => input.length > 0 || 'Instance name is required'
        },
        {
          type: 'password',
          name: 'refreshToken',
          message: 'SDP Refresh Token:',
          mask: '*',
          validate: (input) => input.length > 0 || 'Refresh token is required'
        },
        {
          type: 'input',
          name: 'defaultTechnicianEmail',
          message: 'Default technician email (optional):'
        },
        {
          type: 'input',
          name: 'notes',
          message: 'Admin notes (optional):',
          default: options.notes
        }
      ]);

      // Create credentials object
      const credentials: SDPCredentialsToEncrypt = {
        clientId: answers.clientId,
        clientSecret: answers.clientSecret,
        refreshToken: answers.refreshToken,
        baseUrl: answers.baseUrl,
        instanceName: answers.instanceName,
        defaultTechnicianEmail: answers.defaultTechnicianEmail || undefined
      };

      // Create user
      const { user, apiKey } = await registry.createUser({
        userName: answers.userName,
        userEmail: answers.userEmail || undefined,
        credentials,
        notes: answers.notes || undefined
      });

      console.log(chalk.green('\n✅ User created successfully!\n'));
      console.log(chalk.bold('User Details:'));
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.userName}`);
      console.log(`  Email: ${user.userEmail || 'Not provided'}`);
      console.log(`  Instance: ${answers.instanceName}`);
      
      console.log(chalk.bold('\n🔑 API Key (save this securely):'));
      console.log(chalk.yellow(`  ${apiKey}`));
      
      console.log(chalk.bold('\n📋 User Configuration for .mcp.json:'));
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
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Update user credentials command
program
  .command('update-credentials <userId>')
  .description('Update user SDP credentials')
  .action(async (userId) => {
    try {
      const registry = await initializeRegistry();
      
      // Get existing user
      const user = await registry.getUser(parseInt(userId));
      if (!user) {
        console.error(chalk.red(`User with ID ${userId} not found`));
        process.exit(1);
      }

      console.log(chalk.bold(`\nUpdating credentials for: ${user.userName}\n`));

      // Prompt for new credentials
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'clientId',
          message: 'New SDP Client ID:',
          validate: (input) => input.length > 0 || 'Client ID is required'
        },
        {
          type: 'password',
          name: 'clientSecret',
          message: 'New SDP Client Secret:',
          mask: '*',
          validate: (input) => input.length > 0 || 'Client Secret is required'
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: 'New SDP Base URL:',
          validate: (input) => input.length > 0 || 'Base URL is required'
        },
        {
          type: 'input',
          name: 'instanceName',
          message: 'New SDP Instance Name:',
          validate: (input) => input.length > 0 || 'Instance name is required'
        },
        {
          type: 'password',
          name: 'refreshToken',
          message: 'New SDP Refresh Token:',
          mask: '*',
          validate: (input) => input.length > 0 || 'Refresh token is required'
        },
        {
          type: 'input',
          name: 'defaultTechnicianEmail',
          message: 'New default technician email (optional):'
        }
      ]);

      // Update credentials
      const credentials: SDPCredentialsToEncrypt = {
        clientId: answers.clientId,
        clientSecret: answers.clientSecret,
        refreshToken: answers.refreshToken,
        baseUrl: answers.baseUrl,
        instanceName: answers.instanceName,
        defaultTechnicianEmail: answers.defaultTechnicianEmail || undefined
      };

      await registry.updateUserCredentials(parseInt(userId), credentials);
      
      console.log(chalk.green('\n✅ Credentials updated successfully!'));
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Deactivate user command
program
  .command('deactivate <userId>')
  .description('Deactivate a user')
  .action(async (userId) => {
    try {
      const registry = await initializeRegistry();
      
      // Get user details
      const user = await registry.getUser(parseInt(userId));
      if (!user) {
        console.error(chalk.red(`User with ID ${userId} not found`));
        process.exit(1);
      }

      // Confirm deactivation
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to deactivate user "${user.userName}"?`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log('Deactivation cancelled');
        process.exit(0);
      }

      await registry.deactivateUser(parseInt(userId));
      
      console.log(chalk.green(`\n✅ User "${user.userName}" deactivated successfully!`));
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Show user details command
program
  .command('show <userId>')
  .description('Show detailed information for a user')
  .action(async (userId) => {
    try {
      const registry = await initializeRegistry();
      
      const user = await registry.getUser(parseInt(userId));
      if (!user) {
        console.error(chalk.red(`User with ID ${userId} not found`));
        process.exit(1);
      }

      console.log(chalk.bold('\n👤 User Details\n'));
      console.log(`ID: ${user.id}`);
      console.log(`Name: ${user.userName}`);
      console.log(`Email: ${user.userEmail || '-'}`);
      console.log(`Active: ${user.isActive ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`API Key: ${user.apiKey.substring(0, 20)}...`);
      console.log(`Created: ${new Date(user.createdAt).toLocaleString()}`);
      console.log(`Updated: ${new Date(user.updatedAt).toLocaleString()}`);
      console.log(`Last Used: ${user.lastUsedAt ? new Date(user.lastUsedAt).toLocaleString() : 'Never'}`);
      console.log(`Usage Count: ${user.usageCount}`);
      console.log(`Rate Limit Override: ${user.rateLimitOverride || 'None'}`);
      console.log(`Notes: ${user.notes || '-'}`);
      
      if (Object.keys(user.metadata).length > 0) {
        console.log(`Metadata: ${JSON.stringify(user.metadata, null, 2)}`);
      }
      
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}