export class SDPError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SDPError';
  }
}

export class SDPAuthError extends SDPError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED');
    this.name = 'SDPAuthError';
  }
}

export class SDPRateLimitError extends SDPError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'SDPRateLimitError';
  }
}

export class SDPValidationError extends SDPError {
  constructor(message: string, public validationErrors: any) {
    super(message, 'VALIDATION_ERROR', validationErrors);
    this.name = 'SDPValidationError';
  }
}

export class SDPNotFoundError extends SDPError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'SDPNotFoundError';
  }
}

export class SDPPermissionError extends SDPError {
  constructor(message: string) {
    super(message, 'PERMISSION_DENIED');
    this.name = 'SDPPermissionError';
  }
}

export function formatSDPError(error: SDPError): string {
  let message = `Service Desk Plus Error: ${error.message}`;
  
  if (error.code) {
    message += `\nError Code: ${error.code}`;
  }
  
  if (error instanceof SDPRateLimitError && error.retryAfter) {
    message += `\nRetry after: ${error.retryAfter} seconds`;
  }
  
  if (error instanceof SDPValidationError && error.validationErrors) {
    message += '\nValidation Errors:';
    if (Array.isArray(error.validationErrors)) {
      error.validationErrors.forEach((err: any) => {
        message += `\n  - ${err.field || 'Field'}: ${err.message}`;
      });
    } else if (typeof error.validationErrors === 'object') {
      Object.entries(error.validationErrors).forEach(([field, errors]) => {
        message += `\n  - ${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`;
      });
    }
  }
  
  if (error.details) {
    // Sanitize details to avoid exposing sensitive information
    const sanitizedDetails = sanitizeErrorDetails(error.details);
    if (sanitizedDetails) {
      message += `\nDetails: ${JSON.stringify(sanitizedDetails, null, 2)}`;
    }
  }
  
  return message;
}

// Helper function to sanitize error details
function sanitizeErrorDetails(details: any): any {
  if (!details) return null;
  
  // List of sensitive keys to redact
  const sensitiveKeys = [
    'password', 'secret', 'token', 'api_key', 'apikey',
    'authorization', 'auth', 'client_secret', 'client_id',
    'refresh_token', 'access_token', 'private_key'
  ];
  
  // Deep clone the object to avoid modifying the original
  const sanitized = JSON.parse(JSON.stringify(details));
  
  // Recursively sanitize the object
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      
      // Check if the key contains sensitive information
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    }
    
    return obj;
  };
  
  return sanitizeObject(sanitized);
}