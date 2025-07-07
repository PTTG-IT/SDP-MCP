/**
 * Encryption utilities for secure credential storage
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get or generate encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.SDP_ENCRYPTION_KEY;
  
  if (!keyString) {
    throw new Error('SDP_ENCRYPTION_KEY environment variable is required for credential encryption');
  }
  
  // Ensure key is 32 bytes for AES-256
  if (keyString.length < 32) {
    throw new Error('SDP_ENCRYPTION_KEY must be at least 32 characters long');
  }
  
  // Use first 32 bytes of the key
  return Buffer.from(keyString.substring(0, 32), 'utf-8');
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * Decrypt data encrypted with encrypt()
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract components
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

/**
 * Hash API keys for secure storage and lookup
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a secure random API key
 */
export function generateApiKey(prefix: string = 'usr'): string {
  const randomPart = randomBytes(24).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${prefix}_${randomPart}`;
}

/**
 * Generic data encryption/decryption
 */
export function encryptData(data: string): string {
  return encrypt(data);
}

export function decryptData(encryptedData: string): string {
  return decrypt(encryptedData);
}

/**
 * Encrypt SDP credentials for storage
 */
export interface SDPCredentialsToEncrypt {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  baseUrl: string;
  instanceName: string;
  defaultTechnicianEmail?: string;
}

export function encryptCredentials(credentials: SDPCredentialsToEncrypt): string {
  const json = JSON.stringify(credentials);
  return encrypt(json);
}

/**
 * Decrypt SDP credentials from storage
 */
export function decryptCredentials(encryptedCredentials: string): SDPCredentialsToEncrypt {
  const json = decrypt(encryptedCredentials);
  return JSON.parse(json);
}

/**
 * Validate encryption key on startup
 */
export function validateEncryptionSetup(): boolean {
  try {
    const testData = 'test-encryption';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return decrypted === testData;
  } catch (error) {
    console.error('❌ Encryption validation failed:', error);
    return false;
  }
}