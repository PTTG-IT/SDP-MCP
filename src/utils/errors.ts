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
    message += `\nDetails: ${JSON.stringify(error.details, null, 2)}`;
  }
  
  return message;
}