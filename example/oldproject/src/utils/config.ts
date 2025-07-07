import { SDPError } from './errors.js';

export interface Config {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  instanceName: string;
  apiVersion: string;
  rateLimitPerMinute: number;
  serverName: string;
  logLevel: string;
}

// Alias for backward compatibility
export type SDPConfig = Config;

export function loadConfig(): Config {
  const requiredEnvVars = [
    'SDP_CLIENT_ID',
    'SDP_CLIENT_SECRET',
    'SDP_BASE_URL',
    'SDP_INSTANCE_NAME',
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new SDPError(
      `Missing required environment variables: ${missing.join(', ')}. Please check your .env file.`,
      'CONFIG_ERROR'
    );
  }

  return {
    clientId: process.env.SDP_CLIENT_ID!,
    clientSecret: process.env.SDP_CLIENT_SECRET!,
    baseUrl: process.env.SDP_BASE_URL!,
    instanceName: process.env.SDP_INSTANCE_NAME!,
    apiVersion: process.env.SDP_API_VERSION || 'v3',
    rateLimitPerMinute: parseInt(process.env.SDP_RATE_LIMIT_PER_MINUTE || '60'),
    serverName: process.env.MCP_SERVER_NAME || 'service-desk-plus',
    logLevel: process.env.MCP_LOG_LEVEL || 'info',
  };
}

export function validateConfig(config: Config): void {
  // Validate base URL format
  try {
    new URL(config.baseUrl);
  } catch (error) {
    throw new SDPError('Invalid SDP_BASE_URL format. Must be a valid URL.', 'CONFIG_ERROR');
  }

  // Validate rate limit
  if (isNaN(config.rateLimitPerMinute) || config.rateLimitPerMinute < 1) {
    throw new SDPError('Invalid SDP_RATE_LIMIT_PER_MINUTE. Must be a positive number.', 'CONFIG_ERROR');
  }
}