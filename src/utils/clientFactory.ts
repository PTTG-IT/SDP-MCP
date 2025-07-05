import { SDPClient } from '../api/client.js';
import { loadConfig } from './config.js';

let client: SDPClient | null = null;

/**
 * Get or create the SDP client instance
 */
export function getClient(): SDPClient {
  if (!client) {
    const config = loadConfig();
    client = new SDPClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      baseUrl: config.baseUrl,
      instanceName: config.instanceName,
      rateLimitPerMinute: config.rateLimitPerMinute,
    });
  }
  return client;
}