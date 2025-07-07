import dotenv from 'dotenv';
import { createServer } from './server/index.js';
import { logger } from './monitoring/logging.js';
import { validateEnvironment } from './utils/config.js';
import { connectDatabase } from './database/connection.js';
import { connectRedis } from './utils/redis.js';

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
    
    // Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis(config.redis);
    
    // Create and start the MCP server
    logger.info('Starting MCP server...');
    const server = await createServer(config);
    
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