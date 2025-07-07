import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { isProduction, isDevelopment } from '../utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Custom log levels
 */
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Log colors for console output
 */
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(logColors);

/**
 * Format for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

/**
 * Format for file output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create Winston logger instance
 */
const createLogger = (): winston.Logger => {
  const transports: winston.transport[] = [];
  
  // Console transport
  if (!isProduction() || process.env.LOG_TO_CONSOLE === 'true') {
    transports.push(
      new winston.transports.Console({
        format: isDevelopment() ? consoleFormat : fileFormat,
        level: process.env.LOG_LEVEL || 'info',
      })
    );
  }
  
  // File transport for errors
  if (process.env.LOG_FILE_PATH) {
    transports.push(
      new winston.transports.File({
        filename: path.join(path.dirname(process.env.LOG_FILE_PATH), 'error.log'),
        level: 'error',
        format: fileFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    );
    
    // File transport for all logs
    transports.push(
      new winston.transports.File({
        filename: process.env.LOG_FILE_PATH,
        format: fileFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    );
  }
  
  return winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    transports,
    exitOnError: false,
  });
};

/**
 * Logger instance
 */
export const logger = createLogger();

/**
 * Request logger middleware
 */
export const requestLogger = winston.createLogger({
  levels: logLevels,
  level: 'http',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: isDevelopment() ? consoleFormat : fileFormat,
    }),
  ],
});

/**
 * Log unhandled errors
 */
export function setupErrorLogging(): void {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
  });
}

/**
 * Create a child logger with additional metadata
 */
export function createChildLogger(metadata: Record<string, any>): winston.Logger {
  return logger.child(metadata);
}

/**
 * Performance logging helper
 */
export class PerformanceLogger {
  private startTime: number;
  private metadata: Record<string, any>;
  
  constructor(operation: string, metadata: Record<string, any> = {}) {
    this.startTime = Date.now();
    this.metadata = { operation, ...metadata };
  }
  
  end(additionalMetadata?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    logger.info('Operation completed', {
      ...this.metadata,
      ...additionalMetadata,
      durationMs: duration,
    });
  }
}

/**
 * Structured logging helpers
 */
export const loggers = {
  auth: createChildLogger({ component: 'auth' }),
  api: createChildLogger({ component: 'api' }),
  db: createChildLogger({ component: 'database' }),
  tenant: createChildLogger({ component: 'tenant' }),
  mcp: createChildLogger({ component: 'mcp' }),
  security: createChildLogger({ component: 'security' }),
};

/**
 * Express request logging middleware
 */
export function httpLogger(req: any, res: any, next: any): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    requestLogger.http('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      tenantId: req.tenantId,
    });
  });
  
  next();
}