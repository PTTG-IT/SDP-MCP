/**
 * Simple configuration for SSE server
 * Minimal requirements for getting started
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface SimpleConfig {
  server: {
    port: number;
    host: string;
  };
  sdp: {
    baseUrl: string;
    instanceName: string;
    dataCenter: string;
  };
}

/**
 * Get simple configuration for SSE server
 */
export function getSimpleConfig(): SimpleConfig {
  // Check required environment variables
  const required = [
    'SDP_BASE_URL',
    'SDP_INSTANCE_NAME',
    'SDP_OAUTH_CLIENT_ID',
    'SDP_OAUTH_CLIENT_SECRET',
    'SDP_OAUTH_REFRESH_TOKEN',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  return {
    server: {
      port: parseInt(process.env.SDP_HTTP_PORT || '3456', 10),
      host: process.env.SDP_HTTP_HOST || '0.0.0.0',
    },
    sdp: {
      baseUrl: process.env.SDP_BASE_URL!,
      instanceName: process.env.SDP_INSTANCE_NAME!,
      dataCenter: process.env.SDP_DATA_CENTER || 'US',
    },
  };
}