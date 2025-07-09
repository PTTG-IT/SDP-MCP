/**
 * Error Logger for API Errors
 * Captures and stores API errors with proper status codes
 */

const fs = require('fs').promises;
const path = require('path');

class ErrorLogger {
  constructor() {
    // For now, log to file until database is connected
    this.errorLogFile = path.join(__dirname, '..', '..', 'api-errors.log');
  }

  /**
   * Log an API error with all details
   */
  async logApiError(error, context = {}) {
    try {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        // Error codes
        apiStatusCode: error.code || error.statusCode,
        httpStatusCode: error.httpStatus || error.response?.status,
        
        // Error details
        message: error.message,
        fields: error.fields || [],
        fieldErrors: error.fieldErrors || [],
        
        // Request context
        endpoint: context.endpoint || error.config?.url,
        method: context.method || error.config?.method,
        requestData: this.sanitizeData(context.requestData),
        
        // Response
        responseData: error.details || error.response?.data,
        
        // Additional context
        userId: context.userId,
        tenantId: context.tenantId
      };

      // Log to file (append)
      await this.appendToLog(errorEntry);
      
      // Also log summary to console for immediate visibility
      this.logErrorSummary(errorEntry);
      
      return errorEntry;
    } catch (logError) {
      console.error('Failed to log API error:', logError.message);
    }
  }

  /**
   * Append error to log file
   */
  async appendToLog(errorEntry) {
    const logLine = JSON.stringify(errorEntry) + '\n';
    await fs.appendFile(this.errorLogFile, logLine);
  }

  /**
   * Log error summary to console
   */
  logErrorSummary(error) {
    const { apiStatusCode, httpStatusCode, message, endpoint, fields } = error;
    
    console.error('\n=== API Error Summary ===');
    console.error(`Status Codes: API=${apiStatusCode}, HTTP=${httpStatusCode}`);
    console.error(`Endpoint: ${endpoint}`);
    console.error(`Message: ${message}`);
    
    if (fields && fields.length > 0) {
      console.error(`Missing Fields: ${fields.join(', ')}`);
    }
    
    // Log specific guidance based on status code
    this.logStatusCodeGuidance(apiStatusCode);
    console.error('========================\n');
  }

  /**
   * Provide guidance based on status code
   */
  logStatusCodeGuidance(statusCode) {
    const guidance = {
      4001: '→ Check that email/ID exists in SDP system',
      4002: '→ Operation forbidden - check permissions or business rules',
      4007: '→ Endpoint not found - verify API path',
      4012: '→ Missing mandatory fields - check instance configuration',
      4022: '→ Invalid token - will attempt refresh',
      4015: '→ Rate limit hit - wait before retrying'
    };
    
    if (guidance[statusCode]) {
      console.error(`Guidance: ${guidance[statusCode]}`);
    }
  }

  /**
   * Sanitize sensitive data from requests
   */
  sanitizeData(data) {
    if (!data) return null;
    
    // Clone the data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    const removeSensitive = (obj) => {
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          removeSensitive(obj[key]);
        }
      }
    };
    
    removeSensitive(sanitized);
    return sanitized;
  }

  /**
   * Get error statistics from log
   */
  async getErrorStats() {
    try {
      const logContent = await fs.readFile(this.errorLogFile, 'utf8');
      const lines = logContent.trim().split('\n');
      const errors = lines.map(line => JSON.parse(line));
      
      // Group by status code
      const stats = {};
      errors.forEach(error => {
        const code = error.apiStatusCode || 'UNKNOWN';
        if (!stats[code]) {
          stats[code] = {
            count: 0,
            endpoints: new Set(),
            messages: new Set(),
            lastSeen: null
          };
        }
        
        stats[code].count++;
        stats[code].endpoints.add(error.endpoint);
        stats[code].messages.add(error.message);
        stats[code].lastSeen = error.timestamp;
      });
      
      // Convert sets to arrays
      Object.keys(stats).forEach(code => {
        stats[code].endpoints = Array.from(stats[code].endpoints);
        stats[code].messages = Array.from(stats[code].messages);
      });
      
      return stats;
    } catch (error) {
      return {};
    }
  }
}

// Export singleton instance
module.exports = new ErrorLogger();