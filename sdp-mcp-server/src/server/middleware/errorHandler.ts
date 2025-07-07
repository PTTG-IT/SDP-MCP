import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../monitoring/logging.js';
import { auditLogger } from '../../monitoring/auditLogger.js';
import { SDPError } from '../../utils/errors.js';
import type { MCPRequest } from '../types.js';

/**
 * Error handler middleware
 * Handles all errors in a consistent way
 */
export function errorHandler() {
  return (
    err: Error | SDPError,
    req: MCPRequest,
    res: Response,
    next: NextFunction
  ): void => {
    // Log error
    logger.error('Request error', {
      error: err,
      path: req.path,
      method: req.method,
      tenantId: req.context?.tenantId,
      clientId: req.context?.clientId,
    });

    // Log to audit if we have context
    if (req.context?.tenantId) {
      auditLogger.log({
        tenantId: req.context.tenantId,
        eventType: 'mcp.request.error',
        eventCategory: 'error',
        actorType: 'client',
        actorId: req.context.clientId,
        action: `${req.method} ${req.path}`,
        result: 'error',
        errorCode: err instanceof SDPError ? err.code : 'UNKNOWN_ERROR',
        errorMessage: err.message,
        metadata: {
          path: req.path,
          method: req.method,
          statusCode: err instanceof SDPError ? err.statusCode : 500,
        },
      }).catch(logError => {
        logger.error('Failed to log error to audit', { error: logError });
      });
    }

    // Handle different error types
    if (err instanceof SDPError) {
      res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
        details: err.details,
        timestamp: err.timestampUTC,
      });
    } else if (err.name === 'ValidationError') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.message,
      });
    } else if (err.name === 'UnauthorizedError') {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    } else {
      // Generic error response
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        // Only include stack trace in development
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    }
  };
}

/**
 * Not found handler
 */
export function notFoundHandler() {
  return (req: Request, res: Response): void => {
    logger.warn('Route not found', {
      path: req.path,
      method: req.method,
    });

    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    });
  };
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.error('Request timeout', {
          path: req.path,
          method: req.method,
          timeout: timeoutMs,
        });

        res.status(504).json({
          error: 'TIMEOUT',
          message: 'Request timed out',
        });
      }
    }, timeoutMs);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Rate limit error handler
 */
export function rateLimitErrorHandler() {
  return (req: Request, res: Response): void => {
    logger.warn('Rate limit exceeded', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryAfter: res.getHeader('Retry-After'),
    });
  };
}

/**
 * CORS error handler
 */
export function corsErrorHandler() {
  return (req: Request, res: Response): void => {
    logger.warn('CORS error', {
      origin: req.get('origin'),
      path: req.path,
    });

    res.status(403).json({
      error: 'CORS_ERROR',
      message: 'Cross-origin request blocked',
    });
  };
}

/**
 * Create error monitoring
 */
export function createErrorMonitoring() {
  const errorCounts = new Map<string, number>();
  const errorRates = new Map<string, number[]>();

  return {
    /**
     * Record error occurrence
     */
    recordError(error: Error | SDPError): void {
      const errorCode = error instanceof SDPError ? error.code : error.name;
      
      // Increment count
      errorCounts.set(errorCode, (errorCounts.get(errorCode) || 0) + 1);
      
      // Track rate (errors per minute)
      const now = Date.now();
      const rates = errorRates.get(errorCode) || [];
      rates.push(now);
      
      // Keep only last 5 minutes
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const recentRates = rates.filter(time => time > fiveMinutesAgo);
      errorRates.set(errorCode, recentRates);
    },

    /**
     * Get error statistics
     */
    getStats(): {
      totalErrors: number;
      errorCounts: Record<string, number>;
      errorRates: Record<string, number>;
    } {
      const stats: Record<string, number> = {};
      const rates: Record<string, number> = {};
      let total = 0;

      for (const [code, count] of errorCounts) {
        stats[code] = count;
        total += count;
        
        // Calculate rate per minute
        const recentErrors = errorRates.get(code) || [];
        rates[code] = recentErrors.length / 5; // Average over 5 minutes
      }

      return {
        totalErrors: total,
        errorCounts: stats,
        errorRates: rates,
      };
    },

    /**
     * Reset statistics
     */
    reset(): void {
      errorCounts.clear();
      errorRates.clear();
    },
  };
}