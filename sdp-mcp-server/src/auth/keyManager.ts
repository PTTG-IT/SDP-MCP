import crypto from 'crypto';
import { logger } from '../monitoring/logging.js';
import { EncryptionService } from './encryption.js';

/**
 * Key rotation metadata
 */
interface KeyMetadata {
  version: number;
  createdAt: Date;
  rotatedAt?: Date;
  algorithm: string;
  purpose: string;
}

/**
 * Key manager for handling encryption keys and rotation
 */
export class KeyManager {
  private readonly encryptionService: EncryptionService;
  private keyCache: Map<string, { key: Buffer; metadata: KeyMetadata }> = new Map();
  
  constructor(masterKey: string) {
    this.encryptionService = new EncryptionService(masterKey);
  }

  /**
   * Generate a new encryption key for a specific purpose
   */
  generateKey(purpose: string, length: number = 32): { key: string; metadata: KeyMetadata } {
    const key = crypto.randomBytes(length);
    const metadata: KeyMetadata = {
      version: 1,
      createdAt: new Date(),
      algorithm: 'aes-256-gcm',
      purpose,
    };
    
    logger.info('Generated new encryption key', { purpose, version: metadata.version });
    
    return {
      key: key.toString('base64'),
      metadata,
    };
  }

  /**
   * Derive a tenant-specific key
   */
  deriveTenantKey(tenantId: string, purpose: string = 'general'): Buffer {
    const cacheKey = `${tenantId}:${purpose}`;
    
    // Check cache first
    const cached = this.keyCache.get(cacheKey);
    if (cached) {
      return cached.key;
    }
    
    // Derive new key
    const salt = Buffer.from(`${purpose}:${tenantId}`, 'utf8');
    const key = crypto.pbkdf2Sync(
      this.encryptionService.generateSecureToken(),
      salt,
      100000,
      32,
      'sha256'
    );
    
    // Cache the key
    this.keyCache.set(cacheKey, {
      key,
      metadata: {
        version: 1,
        createdAt: new Date(),
        algorithm: 'aes-256-gcm',
        purpose: `tenant:${purpose}`,
      },
    });
    
    return key;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(): Promise<void> {
    logger.info('Starting key rotation process');
    
    // Clear key cache to force regeneration
    this.keyCache.clear();
    
    // In a real implementation, this would:
    // 1. Generate new keys
    // 2. Re-encrypt all data with new keys
    // 3. Update key version in database
    // 4. Keep old keys for decryption during transition
    
    logger.info('Key rotation completed');
  }

  /**
   * Get key metadata
   */
  getKeyMetadata(tenantId: string, purpose: string = 'general'): KeyMetadata | null {
    const cacheKey = `${tenantId}:${purpose}`;
    const cached = this.keyCache.get(cacheKey);
    return cached?.metadata || null;
  }

  /**
   * Clear cached keys for a specific tenant
   */
  clearTenantKeys(tenantId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.keyCache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.keyCache.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.info('Cleared tenant keys from cache', { 
        tenantId, 
        keysCleared: keysToDelete.length 
      });
    }
  }

  /**
   * Create a key derivation function for specific use cases
   */
  createKDF(
    secret: string,
    salt: string,
    iterations: number = 100000,
    keyLength: number = 32
  ): Buffer {
    return crypto.pbkdf2Sync(secret, salt, iterations, keyLength, 'sha256');
  }

  /**
   * Generate a key pair for asymmetric encryption
   */
  async generateKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            logger.error('Failed to generate key pair', { error: err });
            reject(err);
          } else {
            resolve({ publicKey, privateKey });
          }
        }
      );
    });
  }

  /**
   * Sign data with a private key
   */
  signData(data: string, privateKey: string): string {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'base64');
  }

  /**
   * Verify signed data with a public key
   */
  verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      logger.error('Signature verification failed', { error });
      return false;
    }
  }
}