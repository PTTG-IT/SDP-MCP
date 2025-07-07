import crypto from 'crypto';
import { logger } from '../monitoring/logging.js';

/**
 * Encryption configuration
 */
interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  saltLength: number;
  tagLength: number;
  ivLength: number;
  iterations: number;
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  saltLength: 32,
  tagLength: 16,
  ivLength: 16,
  iterations: 100000,
};

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encrypted: string;
  salt: string;
  iv: string;
  tag: string;
  version: number;
}

export class EncryptionService {
  private readonly masterKey: Buffer;
  private readonly config: EncryptionConfig;
  private readonly version = 1;

  constructor(masterKey: string, config: Partial<EncryptionConfig> = {}) {
    if (!masterKey || masterKey.length < 32) {
      throw new Error('Master key must be at least 32 characters long');
    }
    
    this.masterKey = Buffer.from(masterKey.substring(0, 32));
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Derive a key from the master key for a specific tenant
   */
  private deriveKey(tenantId: string, salt: Buffer): Buffer {
    const context = Buffer.concat([
      Buffer.from(tenantId),
      Buffer.from('sdp-mcp-encryption'),
    ]);
    
    return crypto.pbkdf2Sync(
      this.masterKey,
      Buffer.concat([salt, context]),
      this.config.iterations,
      this.config.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt data for a specific tenant
   */
  encrypt(data: string, tenantId: string): EncryptedData {
    try {
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);
      const key = this.deriveKey(tenantId, salt);
      
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final(),
      ]);
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted.toString('base64'),
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        version: this.version,
      };
    } catch (error) {
      logger.error('Encryption failed', { error, tenantId });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data for a specific tenant
   */
  decrypt(encryptedData: EncryptedData, tenantId: string): string {
    try {
      if (encryptedData.version !== this.version) {
        throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
      }
      
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
      
      const key = this.deriveKey(tenantId, salt);
      
      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('Decryption failed', { error, tenantId });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt a simple string (returns combined format)
   */
  encryptString(data: string, tenantId: string): string {
    const encrypted = this.encrypt(data, tenantId);
    return `${encrypted.version}:${encrypted.salt}:${encrypted.iv}:${encrypted.tag}:${encrypted.encrypted}`;
  }

  /**
   * Decrypt a simple string (from combined format)
   */
  decryptString(encryptedString: string, tenantId: string): string {
    const parts = encryptedString.split(':');
    if (parts.length !== 5) {
      throw new Error('Invalid encrypted string format');
    }
    
    const [version, salt, iv, tag, encrypted] = parts;
    
    return this.decrypt({
      version: parseInt(version!, 10),
      salt: salt!,
      iv: iv!,
      tag: tag!,
      encrypted: encrypted!,
    }, tenantId);
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 12);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcrypt');
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Generate a cryptographically secure UUID
   */
  generateSecureId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a hash of data (for integrity checks)
   */
  createHash(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('base64');
  }

  /**
   * Verify data integrity
   */
  verifyHash(data: string, hash: string): boolean {
    const computedHash = this.createHash(data);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(hash)
    );
  }
}