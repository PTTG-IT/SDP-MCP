/**
 * Factory for creating SDPClient instances dynamically
 */

import { SDPClient, SDPClientConfig } from '../api/client.js';
import { SDPCredentials } from '../types/session.js';
import { SDPError } from '../utils/errors.js';

/**
 * Creates an SDPClient instance from credentials
 */
export async function createSDPClient(credentials: SDPCredentials): Promise<SDPClient> {
  // Validate credentials
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    throw new SDPError(
      'Missing required credentials: clientId, clientSecret, and refreshToken are required',
      'INVALID_CREDENTIALS'
    );
  }

  if (!credentials.baseUrl || !credentials.instanceName) {
    throw new SDPError(
      'Missing required configuration: baseUrl and instanceName are required',
      'INVALID_CONFIGURATION'
    );
  }

  // Create config from credentials
  const config: SDPClientConfig = {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    baseUrl: credentials.baseUrl,
    instanceName: credentials.instanceName
  };

  // Create client instance
  const client = new SDPClient(config);

  // The client doesn't expose auth directly, but we need to set the refresh token
  // This is a limitation - we'd need to modify SDPClient to support this
  // For now, throw an error indicating this approach won't work
  throw new SDPError(
    'Multi-tenant support requires SDPClient modifications. See MULTI_TENANT_SETUP.md for alternatives.',
    'NOT_IMPLEMENTED'
  );

  // Set default technician email if provided
  if (credentials.defaultTechnicianEmail) {
    // Store in client context for handlers to use
    (client as any).defaultTechnicianEmail = credentials.defaultTechnicianEmail;
  }

  return client;
}

/**
 * Validates SDP credentials without creating a client
 */
export function validateCredentials(credentials: SDPCredentials): { valid: boolean; error?: string } {
  if (!credentials.clientId) {
    return { valid: false, error: 'Client ID is required' };
  }
  
  if (!credentials.clientSecret) {
    return { valid: false, error: 'Client secret is required' };
  }
  
  if (!credentials.refreshToken) {
    return { valid: false, error: 'Refresh token is required' };
  }
  
  if (!credentials.baseUrl) {
    return { valid: false, error: 'Base URL is required' };
  }
  
  if (!credentials.instanceName) {
    return { valid: false, error: 'Instance name is required' };
  }
  
  // Validate URL format
  try {
    new URL(credentials.baseUrl);
  } catch {
    return { valid: false, error: 'Invalid base URL format' };
  }
  
  return { valid: true };
}