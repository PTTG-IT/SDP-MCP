import { z } from 'zod';
import { SDPError, SDPValidationError, SDPAuthError, SDPRateLimitError } from '../../utils/errors.js';
import { logger } from '../../monitoring/logging.js';
import { auditLogger } from '../../monitoring/auditLogger.js';
import type { ToolContext, ToolResult } from '../types.js';

/**
 * Error context for enhanced error handling
 */
interface ErrorContext {
  toolName: string;
  operation: string;
  module: string;
  tenantId: string;
  clientId?: string;
  args?: any;
}

/**
 * Enhanced error handler for MCP tools
 */
export class ToolErrorHandler {
  /**
   * Wrap tool handler with error handling
   */
  static wrapHandler<T extends (...args: any[]) => Promise<ToolResult>>(
    handler: T,
    errorContext: Omit<ErrorContext, 'tenantId' | 'clientId'>
  ): T {
    return (async (...args: Parameters<T>): Promise<ToolResult> => {
      const [toolArgs, context] = args as [any, ToolContext];
      const fullContext: ErrorContext = {
        ...errorContext,
        tenantId: context.tenantId,
        clientId: context.clientId,
        args: toolArgs,
      };

      try {
        // Execute the handler
        const result = await handler(...args);
        
        // Log successful execution
        await this.logSuccess(fullContext);
        
        return result;
      } catch (error) {
        // Handle and transform the error
        return await this.handleError(error, fullContext);
      }
    }) as T;
  }

  /**
   * Handle errors with appropriate formatting and logging
   */
  private static async handleError(
    error: unknown,
    context: ErrorContext
  ): Promise<ToolResult> {
    let errorResult: ToolResult;
    let errorCode: string;
    let errorMessage: string;
    let statusCode: number;

    if (error instanceof SDPValidationError) {
      errorCode = error.code;
      errorMessage = `Validation Error: ${error.message}`;
      statusCode = error.statusCode;
      errorResult = this.createValidationErrorResult(error, context);
    } else if (error instanceof SDPAuthError) {
      errorCode = error.code;
      errorMessage = `Authentication Error: ${error.message}`;
      statusCode = error.statusCode;
      errorResult = this.createAuthErrorResult(error, context);
    } else if (error instanceof SDPRateLimitError) {
      errorCode = error.code;
      errorMessage = `Rate Limit Error: ${error.message}`;
      statusCode = error.statusCode;
      errorResult = this.createRateLimitErrorResult(error, context);
    } else if (error instanceof SDPError) {
      errorCode = error.code;
      errorMessage = error.message;
      statusCode = error.statusCode;
      errorResult = this.createGenericErrorResult(error, context);
    } else if (error instanceof Error) {
      errorCode = 'UNKNOWN_ERROR';
      errorMessage = error.message;
      statusCode = 500;
      errorResult = this.createUnknownErrorResult(error, context);
    } else {
      errorCode = 'UNKNOWN_ERROR';
      errorMessage = 'An unexpected error occurred';
      statusCode = 500;
      errorResult = this.createUnknownErrorResult(new Error(errorMessage), context);
    }

    // Log the error
    await this.logError(error, context, errorCode, statusCode);

    return errorResult;
  }

  /**
   * Create validation error result with helpful details
   */
  private static createValidationErrorResult(
    error: SDPValidationError,
    context: ErrorContext
  ): ToolResult {
    const content = [
      `❌ Validation Error in ${context.toolName}`,
      '',
      `**Error:** ${error.message}`,
      '',
      '**Details:**',
    ];

    if (error.details && typeof error.details === 'object') {
      for (const [field, issue] of Object.entries(error.details)) {
        content.push(`- ${field}: ${issue}`);
      }
    }

    content.push(
      '',
      '**Suggestion:** Please check the input parameters and ensure they meet the required format.',
      '',
      `**Error Code:** ${error.code}`,
      `**Timestamp:** ${error.timestampUTC} UTC / ${error.timestampCST} CST`
    );

    return {
      content: [{
        type: 'text',
        text: content.join('\n'),
      }],
      isError: true,
    };
  }

  /**
   * Create auth error result with guidance
   */
  private static createAuthErrorResult(
    error: SDPAuthError,
    context: ErrorContext
  ): ToolResult {
    const content = [
      `🔐 Authentication Error in ${context.toolName}`,
      '',
      `**Error:** ${error.message}`,
      '',
      '**Possible Causes:**',
      '- OAuth token has expired',
      '- Insufficient permissions for this operation',
      '- Invalid or revoked credentials',
      '',
      '**Suggestions:**',
      '- Check if your OAuth scopes include the required permissions',
      '- Verify your self-client certificate is still valid',
      '- Try refreshing your authentication token',
      '',
      `**Required Scope:** ${this.getRequiredScope(context.module, context.operation)}`,
      `**Error Code:** ${error.code}`,
      `**Timestamp:** ${error.timestampUTC} UTC / ${error.timestampCST} CST`
    ];

    return {
      content: [{
        type: 'text',
        text: content.join('\n'),
      }],
      isError: true,
    };
  }

  /**
   * Create rate limit error result with retry guidance
   */
  private static createRateLimitErrorResult(
    error: SDPRateLimitError,
    context: ErrorContext
  ): ToolResult {
    const retryAfter = error.retryAfter || 60;
    const content = [
      `⏳ Rate Limit Exceeded in ${context.toolName}`,
      '',
      `**Error:** ${error.message}`,
      '',
      `**Retry After:** ${retryAfter} seconds`,
      '',
      '**Why this happens:**',
      '- Service Desk Plus has API rate limits to ensure fair usage',
      '- Your tenant has exceeded the allowed number of requests',
      '',
      '**Suggestions:**',
      `- Wait ${retryAfter} seconds before retrying`,
      '- Consider using batch operations for bulk actions',
      '- Spread operations over time to avoid hitting limits',
      '',
      `**Error Code:** ${error.code}`,
      `**Timestamp:** ${error.timestampUTC} UTC / ${error.timestampCST} CST`
    ];

    return {
      content: [{
        type: 'text',
        text: content.join('\n'),
      }],
      isError: true,
    };
  }

  /**
   * Create generic SDP error result
   */
  private static createGenericErrorResult(
    error: SDPError,
    context: ErrorContext
  ): ToolResult {
    const content = [
      `❌ Error in ${context.toolName}`,
      '',
      `**Error:** ${error.message}`,
      '',
    ];

    if (error.details) {
      content.push('**Additional Details:**');
      content.push(JSON.stringify(error.details, null, 2));
      content.push('');
    }

    content.push(
      `**Error Code:** ${error.code}`,
      `**Status Code:** ${error.statusCode}`,
      `**Timestamp:** ${error.timestampUTC} UTC / ${error.timestampCST} CST`
    );

    return {
      content: [{
        type: 'text',
        text: content.join('\n'),
      }],
      isError: true,
    };
  }

  /**
   * Create unknown error result
   */
  private static createUnknownErrorResult(
    error: Error,
    context: ErrorContext
  ): ToolResult {
    const content = [
      `⚠️ Unexpected Error in ${context.toolName}`,
      '',
      `**Error:** ${error.message}`,
      '',
      '**What to do:**',
      '1. Check if the Service Desk Plus service is available',
      '2. Verify your network connectivity',
      '3. Review the error message for clues',
      '4. Contact support if the issue persists',
      '',
      '**Debug Information:**',
      `- Tool: ${context.toolName}`,
      `- Module: ${context.module}`,
      `- Operation: ${context.operation}`,
      `- Tenant: ${context.tenantId}`,
    ];

    if (process.env.NODE_ENV === 'development' && error.stack) {
      content.push('', '**Stack Trace:**', '```', error.stack, '```');
    }

    return {
      content: [{
        type: 'text',
        text: content.join('\n'),
      }],
      isError: true,
    };
  }

  /**
   * Log successful tool execution
   */
  private static async logSuccess(context: ErrorContext): Promise<void> {
    try {
      await auditLogger.log({
        tenantId: context.tenantId,
        eventType: 'mcp.tool.success',
        eventCategory: 'tool',
        actorType: 'client',
        actorId: context.clientId || 'unknown',
        action: `${context.module}.${context.operation}`,
        result: 'success',
        metadata: {
          tool: context.toolName,
          module: context.module,
          operation: context.operation,
        },
      });
    } catch (error) {
      logger.error('Failed to log tool success', { error, context });
    }
  }

  /**
   * Log tool execution error
   */
  private static async logError(
    error: unknown,
    context: ErrorContext,
    errorCode: string,
    statusCode: number
  ): Promise<void> {
    // Log to application logger
    logger.error('Tool execution failed', {
      error,
      context,
      errorCode,
      statusCode,
    });

    // Log to audit logger
    try {
      await auditLogger.log({
        tenantId: context.tenantId,
        eventType: 'mcp.tool.error',
        eventCategory: 'tool',
        actorType: 'client',
        actorId: context.clientId || 'unknown',
        action: `${context.module}.${context.operation}`,
        result: 'error',
        errorCode,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          tool: context.toolName,
          module: context.module,
          operation: context.operation,
          statusCode,
          args: context.args,
        },
      });
    } catch (auditError) {
      logger.error('Failed to log tool error to audit', { error: auditError, context });
    }
  }

  /**
   * Get required OAuth scope for operation
   */
  private static getRequiredScope(module: string, operation: string): string {
    const scopeMap: Record<string, Record<string, string>> = {
      requests: {
        create: 'SDPOnDemand.requests.CREATE',
        update: 'SDPOnDemand.requests.UPDATE',
        delete: 'SDPOnDemand.requests.DELETE',
        read: 'SDPOnDemand.requests.READ',
        close: 'SDPOnDemand.requests.UPDATE',
        pickup: 'SDPOnDemand.requests.UPDATE',
      },
      problems: {
        create: 'SDPOnDemand.problems.CREATE',
        update: 'SDPOnDemand.problems.UPDATE',
        delete: 'SDPOnDemand.problems.DELETE',
        read: 'SDPOnDemand.problems.READ',
        analyze: 'SDPOnDemand.problems.UPDATE',
      },
      changes: {
        create: 'SDPOnDemand.changes.CREATE',
        update: 'SDPOnDemand.changes.UPDATE',
        delete: 'SDPOnDemand.changes.DELETE',
        read: 'SDPOnDemand.changes.READ',
        approve: 'SDPOnDemand.changes.APPROVE',
      },
      projects: {
        create: 'SDPOnDemand.projects.CREATE',
        update: 'SDPOnDemand.projects.UPDATE',
        delete: 'SDPOnDemand.projects.DELETE',
        read: 'SDPOnDemand.projects.READ',
      },
      assets: {
        create: 'SDPOnDemand.assets.CREATE',
        update: 'SDPOnDemand.assets.UPDATE',
        delete: 'SDPOnDemand.assets.DELETE',
        read: 'SDPOnDemand.assets.READ',
      },
    };

    return scopeMap[module]?.[operation] || 'Unknown scope';
  }
}

/**
 * Create error recovery suggestions based on error type
 */
export function getErrorRecoverySuggestions(error: SDPError): string[] {
  const suggestions: string[] = [];

  if (error instanceof SDPValidationError) {
    suggestions.push(
      'Review the API documentation for correct field formats',
      'Ensure all required fields are provided',
      'Check that ID references are valid',
      'Verify date formats are ISO 8601 compliant'
    );
  } else if (error instanceof SDPAuthError) {
    suggestions.push(
      'Verify your OAuth client has the necessary scopes',
      'Check if your token needs to be refreshed',
      'Ensure your self-client certificate is properly configured',
      'Contact your Service Desk Plus administrator for permissions'
    );
  } else if (error instanceof SDPRateLimitError) {
    suggestions.push(
      'Implement exponential backoff for retries',
      'Use batch operations to reduce API calls',
      'Consider caching frequently accessed data',
      'Distribute operations across time periods'
    );
  } else if (error.code === 'NETWORK_ERROR') {
    suggestions.push(
      'Check your internet connection',
      'Verify the Service Desk Plus URL is correct',
      'Ensure firewall rules allow HTTPS connections',
      'Try again in a few moments'
    );
  } else if (error.code === 'NOT_FOUND') {
    suggestions.push(
      'Verify the resource ID is correct',
      'Check if the resource was recently deleted',
      'Ensure you have permission to view the resource',
      'Try searching for the resource by name'
    );
  }

  return suggestions;
}