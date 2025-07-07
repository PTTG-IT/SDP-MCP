import { SDPClient } from '../api/client.js';
import { SDPClientV2 } from '../api/clientV2.js';
import { SDPConfig } from '../api/types.js';
import { TokenManager } from '../api/tokenManager.js';
import { RateLimitMonitor } from '../monitoring/rateLimitMonitor.js';

/**
 * Client factory for migrating to V2
 * Provides backward compatibility during migration
 */

// Singleton instances
let clientV1: SDPClient | null = null;
let clientV2: SDPClientV2 | null = null;
let tokenManager: TokenManager | null = null;
let monitor: RateLimitMonitor | null = null;

// Feature flags
const useV2Client = process.env.SDP_USE_V2_CLIENT === 'true';
const enableMonitoring = process.env.SDP_ENABLE_MONITORING !== 'false';

/**
 * Get client instance based on feature flag
 */
export function getClient(config?: SDPConfig): SDPClient | SDPClientV2 {
  if (useV2Client) {
    return getClientV2(config);
  } else {
    return getClientV1(config);
  }
}

/**
 * Get V1 client (legacy)
 */
export function getClientV1(config?: SDPConfig): SDPClient {
  if (!clientV1) {
    if (!config) {
      config = getConfigFromEnv();
    }
    clientV1 = new SDPClient({
      ...config,
      baseUrl: config.baseUrl || `https://sdpondemand.manageengine.com/app/${config.instanceName}/api/v3`
    });
  }
  return clientV1;
}

/**
 * Get V2 client (new)
 */
export function getClientV2(config?: SDPConfig): SDPClientV2 {
  if (!clientV2) {
    if (!config) {
      config = getConfigFromEnv();
    }
    clientV2 = new SDPClientV2(config);
  }
  return clientV2;
}

/**
 * Get token manager (only for V2)
 */
export function getTokenManager(config?: SDPConfig): TokenManager | null {
  if (!useV2Client) {
    console.warn('TokenManager is only available with V2 client');
    return null;
  }
  
  if (!tokenManager) {
    if (!config) {
      config = getConfigFromEnv();
    }
    const client = getClientV2(config);
    const authManager = (client as any).authManager;
    tokenManager = TokenManager.getInstance(authManager, config);
  }
  return tokenManager;
}

/**
 * Get rate limit monitor
 */
export function getRateLimitMonitor(): RateLimitMonitor | null {
  if (!enableMonitoring) {
    return null;
  }
  
  if (!monitor) {
    monitor = new RateLimitMonitor();
    const tm = getTokenManager();
    if (tm) {
      monitor.setTokenManager(tm);
    }
  }
  return monitor;
}

/**
 * Initialize services based on configuration
 */
export async function initializeServices(config?: SDPConfig): Promise<{
  client: SDPClient | SDPClientV2;
  tokenManager?: TokenManager;
  monitor?: RateLimitMonitor;
}> {
  if (!config) {
    config = getConfigFromEnv();
  }
  
  if (useV2Client) {
    console.log('Initializing Service Desk Plus Client V2...');
    
    // Initialize V2 client
    const client = getClientV2(config);
    await client.initialize();
    
    // Start token manager
    const tm = getTokenManager(config);
    if (tm) {
      await tm.start();
      console.log('Background token manager started');
    }
    
    // Start monitoring
    const mon = getRateLimitMonitor();
    if (mon) {
      mon.start();
      console.log('Rate limit monitoring started');
    }
    
    return {
      client,
      tokenManager: tm || undefined,
      monitor: mon || undefined
    };
  } else {
    console.log('Initializing Service Desk Plus Client V1 (legacy)...');
    
    // Initialize V1 client
    const client = getClientV1(config);
    await client.initialize();
    
    return { client };
  }
}

/**
 * Shutdown services gracefully
 */
export async function shutdownServices(): Promise<void> {
  // Stop token manager
  if (tokenManager) {
    tokenManager.stop();
    console.log('Token manager stopped');
  }
  
  // Stop monitoring
  if (monitor) {
    monitor.stop();
    console.log('Monitoring stopped');
  }
}

/**
 * Get configuration from environment variables
 */
function getConfigFromEnv(): SDPConfig {
  return {
    clientId: process.env.SDP_CLIENT_ID!,
    clientSecret: process.env.SDP_CLIENT_SECRET!,
    instanceName: process.env.SDP_INSTANCE_NAME!,
    authCode: process.env.SDP_AUTH_CODE!,
    baseUrl: process.env.SDP_BASE_URL,
  };
}

/**
 * Check if using V2 client
 */
export function isUsingV2Client(): boolean {
  return useV2Client;
}

/**
 * Migration helper to switch to V2
 */
export async function migrateToV2(): Promise<void> {
  if (useV2Client) {
    console.log('Already using V2 client');
    return;
  }
  
  console.log('Migrating to V2 client...');
  
  // Shutdown V1 if running
  clientV1 = null;
  
  // Set flag
  process.env.SDP_USE_V2_CLIENT = 'true';
  
  // Initialize V2
  await initializeServices();
  
  console.log('Migration to V2 complete');
}