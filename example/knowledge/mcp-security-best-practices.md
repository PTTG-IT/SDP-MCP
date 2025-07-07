# MCP Server Security Best Practices

*Last Updated: July 2025*

## Executive Summary

Model Context Protocol (MCP) servers handle sensitive operations including authentication tokens, API access, and tool execution. This document outlines comprehensive security best practices for building penetration-test-ready MCP servers in 2025.

## Core Security Principles

### 1. Zero Trust Architecture
- Never trust any input, even from authenticated clients
- Validate and sanitize all data at every boundary
- Implement defense in depth with multiple security layers
- Assume breach and design for containment

### 2. Least Privilege
- Grant minimum necessary permissions
- Implement granular access controls
- Use separate service accounts for different operations
- Regular permission audits

### 3. Secure by Default
- All features disabled unless explicitly enabled
- Encryption enabled for all data transmission and storage
- Strict validation on all inputs
- Comprehensive logging and monitoring

## Authentication & Authorization

### Client Authentication

#### Modern Approach (2025 Standards)
```typescript
// Use JWT with short expiration for client sessions
interface ClientToken {
  clientId: string;
  permissions: string[];
  exp: number;
  iat: number;
  jti: string; // Unique token ID for revocation
}

// Implement token rotation
class ClientAuthenticator {
  async authenticate(credentials: ClientCredentials): Promise<AuthResult> {
    // Validate credentials against secure store
    const client = await this.validateClient(credentials);
    
    // Generate short-lived access token (15 minutes)
    const accessToken = await this.generateAccessToken(client);
    
    // Generate longer-lived refresh token (7 days)
    const refreshToken = await this.generateRefreshToken(client);
    
    // Store refresh token hash for validation
    await this.storeRefreshTokenHash(client.id, refreshToken);
    
    return { accessToken, refreshToken };
  }
  
  async refresh(refreshToken: string): Promise<AuthResult> {
    // Validate refresh token
    const payload = await this.validateRefreshToken(refreshToken);
    
    // Check if token has been revoked
    if (await this.isRevoked(payload.jti)) {
      throw new UnauthorizedError('Token has been revoked');
    }
    
    // Issue new tokens
    return this.authenticate({ clientId: payload.clientId });
  }
}
```

#### Secure Credential Storage
```typescript
// Never store plain text credentials
import { scrypt, randomBytes } from 'crypto';

class CredentialManager {
  private readonly SALT_LENGTH = 32;
  private readonly KEY_LENGTH = 64;
  
  async hashClientSecret(secret: string): Promise<HashedCredential> {
    const salt = randomBytes(this.SALT_LENGTH);
    const hash = await this.deriveKey(secret, salt);
    
    return {
      hash: hash.toString('base64'),
      salt: salt.toString('base64'),
      algorithm: 'scrypt',
      params: {
        N: 16384,
        r: 8,
        p: 1,
      },
    };
  }
  
  private async deriveKey(secret: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(secret, salt, this.KEY_LENGTH, { N: 16384, r: 8, p: 1 }, 
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }
}
```

### OAuth Token Security

#### Encryption at Rest
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class TokenEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationSalt: Buffer;
  
  constructor(private masterKey: Buffer) {
    this.keyDerivationSalt = randomBytes(32);
  }
  
  async encryptToken(token: string, clientId: string): Promise<EncryptedToken> {
    // Derive client-specific key
    const clientKey = await this.deriveClientKey(clientId);
    
    // Generate IV for this encryption
    const iv = randomBytes(16);
    
    // Create cipher
    const cipher = createCipheriv(this.algorithm, clientKey, iv);
    
    // Encrypt token
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: this.algorithm,
    };
  }
  
  async decryptToken(encryptedToken: EncryptedToken, clientId: string): Promise<string> {
    const clientKey = await this.deriveClientKey(clientId);
    
    const decipher = createDecipheriv(
      this.algorithm,
      clientKey,
      Buffer.from(encryptedToken.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedToken.authTag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedToken.encrypted, 'base64')),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  }
  
  private async deriveClientKey(clientId: string): Promise<Buffer> {
    // Use HKDF to derive client-specific key
    const info = Buffer.from(`mcp-client-${clientId}`);
    return await this.hkdf(this.masterKey, this.keyDerivationSalt, info, 32);
  }
}
```

#### Token Rotation Strategy
```typescript
class TokenRotationManager {
  private readonly TOKEN_EXPIRY_MINUTES = 55; // Refresh at 55 minutes
  private readonly GRACE_PERIOD_MINUTES = 5;
  
  async shouldRefresh(token: OAuthToken): boolean {
    const expiresAt = new Date(token.expiresAt);
    const refreshAt = new Date(expiresAt.getTime() - this.GRACE_PERIOD_MINUTES * 60000);
    
    return new Date() >= refreshAt;
  }
  
  async refreshToken(clientId: string): Promise<OAuthToken> {
    const currentToken = await this.tokenStore.getToken(clientId);
    
    if (!currentToken?.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // Implement exponential backoff for refresh attempts
    return await this.withRetry(async () => {
      const newToken = await this.sdpClient.refreshOAuthToken(
        currentToken.refreshToken
      );
      
      // Store new encrypted token
      await this.tokenStore.storeToken(clientId, newToken);
      
      // Audit log
      await this.auditLogger.log({
        event: 'token_refreshed',
        clientId,
        timestamp: new Date(),
      });
      
      return newToken;
    });
  }
}
```

## Input Validation & Sanitization

### Schema-Based Validation
```typescript
import { z } from 'zod';

// Define strict schemas for all inputs
const createRequestSchema = z.object({
  subject: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  requester_email: z.string().email(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category: z.string().regex(/^[a-zA-Z0-9_-]+$/), // Alphanumeric only
  custom_fields: z.record(
    z.string().regex(/^[a-zA-Z0-9_]+$/), // Field names
    z.union([z.string(), z.number(), z.boolean()]) // Field values
  ).optional(),
});

// Validate with context
async function validateCreateRequest(input: unknown, context: RequestContext) {
  // Parse and validate structure
  const parsed = createRequestSchema.parse(input);
  
  // Additional business logic validation
  if (context.userRole !== 'admin' && parsed.priority === 'urgent') {
    throw new ValidationError('Only admins can create urgent requests');
  }
  
  // Sanitize HTML/scripts from text fields
  parsed.subject = sanitizeHtml(parsed.subject, { allowedTags: [] });
  parsed.description = sanitizeHtml(parsed.description, { 
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'li'] 
  });
  
  return parsed;
}
```

### Command Injection Prevention
```typescript
// NEVER use string concatenation for commands
class SafeCommandExecutor {
  // Bad - vulnerable to injection
  async unsafeExecute(userInput: string) {
    // DON'T DO THIS
    exec(`convert ${userInput} output.png`);
  }
  
  // Good - parameterized execution
  async safeExecute(inputFile: string, outputFile: string) {
    // Validate file paths
    if (!this.isValidPath(inputFile) || !this.isValidPath(outputFile)) {
      throw new ValidationError('Invalid file path');
    }
    
    // Use parameterized execution
    const { stdout, stderr } = await execFile('convert', [
      inputFile,
      outputFile
    ], {
      timeout: 30000, // 30 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB max output
    });
    
    return { stdout, stderr };
  }
  
  private isValidPath(path: string): boolean {
    // Prevent path traversal
    const normalized = path.normalize(path);
    return !normalized.includes('..') && 
           !normalized.includes('~') &&
           /^[a-zA-Z0-9/_.-]+$/.test(normalized);
  }
}
```

### SQL Injection Prevention
```typescript
// Always use parameterized queries
class SecureDatabase {
  async getRequestById(requestId: string, clientId: string) {
    // Validate input types
    if (!this.isValidUUID(requestId) || !this.isValidUUID(clientId)) {
      throw new ValidationError('Invalid ID format');
    }
    
    // Use parameterized query
    const query = `
      SELECT r.* 
      FROM requests r
      JOIN client_permissions cp ON r.id = cp.resource_id
      WHERE r.id = $1 
        AND cp.client_id = $2
        AND cp.resource_type = 'request'
        AND cp.permission = 'read'
    `;
    
    const result = await this.db.query(query, [requestId, clientId]);
    return result.rows[0];
  }
  
  private isValidUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
  }
}
```

## Transport Security

### TLS Configuration
```typescript
import { createServer } from 'https';
import { readFileSync } from 'fs';

const tlsOptions = {
  // Use TLS 1.3 minimum
  minVersion: 'TLSv1.3',
  
  // Strong cipher suites only
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
  ].join(':'),
  
  // Certificate configuration
  cert: readFileSync('path/to/cert.pem'),
  key: readFileSync('path/to/key.pem'),
  
  // Enable OCSP stapling
  honorCipherOrder: true,
  
  // Reject unauthorized connections
  rejectUnauthorized: true,
};

const server = createServer(tlsOptions, app);
```

### Security Headers
```typescript
import helmet from 'helmet';

app.use(helmet({
  // Strict Transport Security
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Additional security headers
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' },
  permittedCrossDomainPolicies: false,
}));

// Custom headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});
```

## Rate Limiting & DDoS Protection

### Intelligent Rate Limiting
```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

class AdaptiveRateLimiter {
  private limiters: Map<string, RateLimiterRedis> = new Map();
  
  constructor(private redisClient: Redis) {
    // Different limits for different operations
    this.limiters.set('auth', new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:auth',
      points: 5, // 5 attempts
      duration: 900, // per 15 minutes
      blockDuration: 900, // block for 15 minutes
    }));
    
    this.limiters.set('api:read', new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:api:read',
      points: 100, // 100 requests
      duration: 60, // per minute
    }));
    
    this.limiters.set('api:write', new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rl:api:write',
      points: 20, // 20 requests
      duration: 60, // per minute
    }));
  }
  
  async checkLimit(
    operation: string, 
    identifier: string, 
    cost: number = 1
  ): Promise<void> {
    const limiter = this.limiters.get(operation);
    if (!limiter) {
      throw new Error(`Unknown operation: ${operation}`);
    }
    
    try {
      await limiter.consume(identifier, cost);
    } catch (rejRes) {
      // Log rate limit violation
      await this.auditLogger.warn('Rate limit exceeded', {
        operation,
        identifier,
        retryAfter: rejRes.msBeforeNext,
      });
      
      throw new RateLimitError(
        'Too many requests',
        Math.round(rejRes.msBeforeNext / 1000)
      );
    }
  }
}
```

### Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime!.getTime() > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    if (this.state === 'half-open') {
      this.reset();
    }
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      
      // Schedule automatic retry
      setTimeout(() => {
        this.state = 'half-open';
      }, this.resetTimeout);
    }
  }
  
  private reset() {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = undefined;
  }
}
```

## Audit Logging & Monitoring

### Comprehensive Audit Trail
```typescript
interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  clientId: string;
  userId?: string;
  action: string;
  resource?: string;
  result: 'success' | 'failure';
  errorCode?: string;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  correlationId: string;
}

class AuditLogger {
  async log(event: Partial<AuditEvent>): Promise<void> {
    const fullEvent: AuditEvent = {
      id: generateUUID(),
      timestamp: new Date(),
      correlationId: getCorrelationId(),
      ...event,
    } as AuditEvent;
    
    // Store in database
    await this.storeEvent(fullEvent);
    
    // Send to SIEM if configured
    if (this.siemEnabled) {
      await this.sendToSIEM(fullEvent);
    }
    
    // Alert on security events
    if (this.isSecurityEvent(fullEvent)) {
      await this.alertSecurityTeam(fullEvent);
    }
  }
  
  private isSecurityEvent(event: AuditEvent): boolean {
    const securityEvents = [
      'authentication_failed',
      'authorization_failed',
      'rate_limit_exceeded',
      'invalid_token',
      'suspicious_activity',
    ];
    
    return securityEvents.includes(event.eventType) ||
           event.result === 'failure';
  }
}
```

### Security Metrics
```typescript
class SecurityMetrics {
  private metrics = new Map<string, number>();
  
  increment(metric: string, labels?: Record<string, string>): void {
    const key = this.buildKey(metric, labels);
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }
  
  // Track security-relevant metrics
  trackAuthenticationAttempt(success: boolean, method: string): void {
    this.increment('auth_attempts_total', { 
      success: String(success), 
      method 
    });
  }
  
  trackApiCall(endpoint: string, method: string, status: number): void {
    this.increment('api_calls_total', { 
      endpoint, 
      method, 
      status: String(status) 
    });
  }
  
  trackSecurityEvent(eventType: string): void {
    this.increment('security_events_total', { type: eventType });
  }
  
  // Export for Prometheus
  async export(): Promise<string> {
    let output = '';
    
    for (const [key, value] of this.metrics) {
      output += `${key} ${value}\n`;
    }
    
    return output;
  }
}
```

## Error Handling

### Secure Error Responses
```typescript
class ErrorHandler {
  handle(error: Error, req: Request, res: Response): void {
    // Log full error internally
    logger.error('Request error', {
      error: error.stack,
      request: {
        method: req.method,
        path: req.path,
        headers: this.sanitizeHeaders(req.headers),
      },
      correlationId: req.correlationId,
    });
    
    // Send safe error to client
    const safeError = this.getSafeError(error);
    
    res.status(safeError.status).json({
      error: {
        code: safeError.code,
        message: safeError.message,
        correlationId: req.correlationId,
      },
    });
  }
  
  private getSafeError(error: Error): SafeError {
    // Map internal errors to safe external errors
    if (error instanceof ValidationError) {
      return {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
      };
    }
    
    if (error instanceof UnauthorizedError) {
      return {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      };
    }
    
    if (error instanceof ForbiddenError) {
      return {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      };
    }
    
    // Default - don't leak internal errors
    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'An error occurred processing your request',
    };
  }
  
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sensitive = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };
    
    for (const key of sensitive) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
}
```

## Dependency Security

### Package Security Scanning
```json
{
  "scripts": {
    "audit": "npm audit --production",
    "audit:fix": "npm audit fix --production",
    "check:licenses": "license-checker --production --onlyAllow 'MIT;Apache-2.0;BSD-3-Clause;BSD-2-Clause;ISC'",
    "check:outdated": "npm outdated",
    "check:security": "snyk test"
  },
  "devDependencies": {
    "@snyk/protect": "latest",
    "license-checker": "latest"
  }
}
```

### Secure Dependency Management
```typescript
// package-lock.json integrity check
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

class DependencyValidator {
  private knownHashes = new Map<string, string>();
  
  async validateLockFile(): Promise<void> {
    const lockFile = readFileSync('package-lock.json', 'utf8');
    const hash = createHash('sha256').update(lockFile).digest('hex');
    
    const knownHash = this.knownHashes.get('package-lock.json');
    
    if (knownHash && hash !== knownHash) {
      throw new Error('Package lock file has been tampered with');
    }
    
    this.knownHashes.set('package-lock.json', hash);
  }
}
```

## Container Security

### Dockerfile Best Practices
```dockerfile
# Use specific version tags, not latest
FROM node:20.5.0-alpine3.18 AS builder

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set secure workdir
WORKDIR /app

# Copy dependency files first for layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Copy source code
COPY --chown=nodejs:nodejs . .

# Build application
RUN npm run build

# Production stage
FROM node:20.5.0-alpine3.18

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Use non-root user
USER nodejs

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Run application
CMD ["node", "dist/index.js"]
```

## Secrets Management

### Environment Variable Security
```typescript
import { config } from 'dotenv';
import { z } from 'zod';

// Define expected environment schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  MCP_SERVER_PORT: z.string().regex(/^\d+$/).transform(Number),
  MCP_ENCRYPTION_KEY: z.string().min(64), // 32 bytes hex
  DATABASE_URL: z.string().url(),
  SDP_OAUTH_CLIENT_ID: z.string().min(1),
  SDP_OAUTH_CLIENT_SECRET: z.string().min(1),
});

// Validate environment on startup
export function loadEnvironment(): ValidatedEnv {
  config(); // Load .env file
  
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Invalid environment configuration:', error);
    process.exit(1);
  }
}

// Use validated environment
const env = loadEnvironment();
```

### Key Rotation
```typescript
class KeyRotationManager {
  async rotateEncryptionKeys(): Promise<void> {
    // Generate new key
    const newKey = randomBytes(32);
    
    // Re-encrypt all tokens with new key
    const clients = await this.getActiveClients();
    
    for (const client of clients) {
      const token = await this.decryptWithOldKey(client.encryptedToken);
      const reencrypted = await this.encryptWithNewKey(token);
      
      await this.updateClientToken(client.id, reencrypted);
    }
    
    // Update key in secure storage
    await this.secureStorage.updateKey('encryption_key', newKey);
    
    // Audit log
    await this.auditLogger.log({
      event: 'key_rotation_completed',
      timestamp: new Date(),
    });
  }
}
```

## Testing Security

### Security Test Suite
```typescript
describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should reject SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      await expect(
        api.createRequest({ subject: maliciousInput })
      ).rejects.toThrow(ValidationError);
    });
    
    it('should reject command injection attempts', async () => {
      const maliciousInput = 'test.txt; rm -rf /';
      
      await expect(
        api.processFile({ filename: maliciousInput })
      ).rejects.toThrow(ValidationError);
    });
    
    it('should reject XXE attacks', async () => {
      const xxePayload = `<?xml version="1.0"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <data>&xxe;</data>`;
      
      await expect(
        api.parseXML({ data: xxePayload })
      ).rejects.toThrow(SecurityError);
    });
  });
  
  describe('Authentication', () => {
    it('should rate limit failed auth attempts', async () => {
      for (let i = 0; i < 6; i++) {
        await api.authenticate({ 
          clientId: 'test', 
          clientSecret: 'wrong' 
        }).catch(() => {});
      }
      
      await expect(
        api.authenticate({ clientId: 'test', clientSecret: 'wrong' })
      ).rejects.toThrow(RateLimitError);
    });
  });
});
```

## Incident Response

### Security Incident Handling
```typescript
class IncidentResponseManager {
  async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // 1. Immediate containment
    await this.containIncident(incident);
    
    // 2. Preserve evidence
    await this.preserveEvidence(incident);
    
    // 3. Notify security team
    await this.notifySecurityTeam(incident);
    
    // 4. Begin investigation
    await this.investigateIncident(incident);
  }
  
  private async containIncident(incident: SecurityIncident): Promise<void> {
    switch (incident.type) {
      case 'compromised_token':
        await this.revokeClientTokens(incident.clientId);
        break;
      
      case 'brute_force':
        await this.blockIpAddress(incident.sourceIp);
        break;
      
      case 'data_breach':
        await this.disableAffectedEndpoints(incident.endpoints);
        break;
    }
  }
}
```

## Compliance Considerations

### GDPR Compliance
```typescript
class GDPRCompliance {
  // Right to be forgotten
  async deleteUserData(userId: string): Promise<void> {
    // Delete from primary storage
    await this.db.query('DELETE FROM user_data WHERE user_id = $1', [userId]);
    
    // Delete from audit logs (anonymize)
    await this.anonymizeAuditLogs(userId);
    
    // Delete from backups (mark for deletion)
    await this.markBackupsForDeletion(userId);
    
    // Generate compliance report
    await this.generateDeletionReport(userId);
  }
  
  // Data portability
  async exportUserData(userId: string): Promise<UserDataExport> {
    const data = await this.collectUserData(userId);
    
    return {
      format: 'json',
      data: data,
      exportedAt: new Date(),
      signature: await this.signData(data),
    };
  }
}
```

## References

- [OWASP Top 10 (2021)](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls v8](https://www.cisecurity.org/controls/v8)
- [MCP Security Specification](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [OAuth 2.1 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)