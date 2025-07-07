#!/usr/bin/env node

import dotenv from 'dotenv';
import { createSDPMCPServer } from './server/index.js';
import { logger } from './monitoring/logging.js';
import { validateEnvironment } from './utils/config.js';
import { connectDatabase } from './database/connection.js';
import { connectRedis } from './utils/redis.js';
import { runMigrations } from './database/migrations.js';

// Load environment variables
dotenv.config();

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  try {
    // Validate environment configuration
    logger.info('Validating environment configuration...');
    const config = validateEnvironment();
    
    // Connect to PostgreSQL
    logger.info('Connecting to PostgreSQL...');
    await connectDatabase(config.database);
    
    // Run database migrations
    logger.info('Running database migrations...');
    await runMigrations();
    
    // Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis(config.redis);
    
    // Create and start the MCP server
    logger.info('Starting MCP server...');
    const server = createSDPMCPServer({
      port: config.server.port || 3000,
      path: config.server.path || '/mcp',
      cors: config.server.cors,
      maxConnections: config.server.maxConnections || 100,
      heartbeatInterval: config.server.heartbeatInterval || 30000,
    });
    
    // Start server with specified transport
    const transport = config.server.transport as 'stdio' | 'sse' || 'sse';
    await server.start(transport);
    
    // Setup graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      
      try {
        await server.stop();
        logger.info('Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Register shutdown handlers
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      void shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      void shutdown('unhandledRejection');
    });
    
    logger.info('SDP MCP Server started successfully');
    logger.info(`Server endpoints: ${config.server.endpoints.join(', ')}`);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
void main();