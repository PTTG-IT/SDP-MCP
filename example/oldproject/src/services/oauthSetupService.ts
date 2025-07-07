import { SDPAuthError } from '../utils/errors.js';
import { hashApiKey } from '../utils/encryption.js';
import { Pool } from 'pg';

export interface OAuthSetupInfo {
  needsSetup: boolean;
  authorizationUrl?: string;
  instructions?: string;
  dataCenter?: string;
}

export interface DataCenterConfig {
  apiDomain: string;
  accountsServer: string;
  developerConsole: string;
}

const DATA_CENTERS: Record<string, DataCenterConfig> = {
  'US': {
    apiDomain: 'https://sdpondemand.manageengine.com',
    accountsServer: 'https://accounts.zoho.com',
    developerConsole: 'https://api-console.zoho.com/'
  },
  'EU': {
    apiDomain: 'https://sdpondemand.manageengine.eu',
    accountsServer: 'https://accounts.zoho.eu',
    developerConsole: 'https://api-console.zoho.eu/'
  },
  'IN': {
    apiDomain: 'https://sdpondemand.manageengine.in',
    accountsServer: 'https://accounts.zoho.in',
    developerConsole: 'https://api-console.zoho.in/'
  },
  'CN': {
    apiDomain: 'https://servicedeskplus.cn',
    accountsServer: 'https://accounts.zoho.com.cn',
    developerConsole: 'https://api-console.zoho.com.cn/'
  },
  'AU': {
    apiDomain: 'https://servicedeskplus.net.au',
    accountsServer: 'https://accounts.zoho.com.au',
    developerConsole: 'https://api-console.zoho.com.au/'
  },
  'JP': {
    apiDomain: 'https://servicedeskplus.jp',
    accountsServer: 'https://accounts.zoho.jp',
    developerConsole: 'https://api-console.zoho.jp/'
  },
  'CA': {
    apiDomain: 'https://servicedeskplus.ca',
    accountsServer: 'https://accounts.zohocloud.ca',
    developerConsole: 'https://api-console.zohocloud.ca/'
  },
  'UK': {
    apiDomain: 'https://servicedeskplus.uk',
    accountsServer: 'https://accounts.zoho.uk',
    developerConsole: 'https://api-console.zoho.uk/'
  },
  'SA': {
    apiDomain: 'https://servicedeskplus.sa',
    accountsServer: 'https://accounts.zoho.sa',
    developerConsole: 'https://api-console.zoho.sa/'
  }
};

export class OAuthSetupService {
  constructor(
    private pool: Pool,
    private baseUrl: string,
    private instanceName: string
  ) {}

  /**
   * Detect data center from base URL
   */
  private detectDataCenter(): string {
    const url = this.baseUrl.toLowerCase();
    
    if (url.includes('.eu')) return 'EU';
    if (url.includes('.in')) return 'IN';
    if (url.includes('.cn')) return 'CN';
    if (url.includes('.au')) return 'AU';
    if (url.includes('.jp')) return 'JP';
    if (url.includes('.ca')) return 'CA';
    if (url.includes('.uk')) return 'UK';
    if (url.includes('.sa')) return 'SA';
    
    return 'US'; // Default to US
  }

  /**
   * Get data center configuration
   */
  private getDataCenterConfig(): DataCenterConfig {
    const dc = this.detectDataCenter();
    return DATA_CENTERS[dc] || DATA_CENTERS['US'];
  }

  /**
   * Check if a client needs OAuth setup
   */
  async checkSetupStatus(clientId: string): Promise<OAuthSetupInfo> {
    const clientIdHash = hashApiKey(clientId);
    
    // Check if tokens exist in database
    const result = await this.pool.query(
      'SELECT id, needs_reauth FROM oauth_tokens WHERE client_id_hash = $1',
      [clientIdHash]
    );

    if (result.rows.length === 0) {
      // No tokens found - needs initial setup
      return this.generateSetupInstructions(clientId);
    }

    const row = result.rows[0];
    if (row.needs_reauth) {
      // Tokens exist but need re-authorization
      return this.generateSetupInstructions(clientId, true);
    }

    // Tokens exist and are valid
    return { needsSetup: false };
  }

  /**
   * Generate OAuth setup instructions
   */
  private generateSetupInstructions(clientId: string, isReauth: boolean = false): OAuthSetupInfo {
    const dcConfig = this.getDataCenterConfig();
    const dc = this.detectDataCenter();
    
    // Build authorization URL
    const authUrl = new URL(`${dcConfig.accountsServer}/oauth/v2/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', this.getRequiredScopes());
    authUrl.searchParams.set('redirect_uri', this.getRedirectUri());
    authUrl.searchParams.set('access_type', 'offline'); // Critical for refresh tokens
    authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token
    
    const instructions = `
${isReauth ? 'Your OAuth tokens need to be refreshed.' : 'Initial OAuth setup required.'}

To authorize this application:

1. Visit the authorization URL below
2. Log in with your Zoho account
3. Grant the requested permissions
4. Copy the authorization code from the redirect URL
5. Submit the code using the setup endpoint

Authorization URL:
${authUrl.toString()}

After authorization, submit the code:
curl -X POST ${this.getServerUrl()}/oauth/setup \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientId": "${clientId}",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "authCode": "AUTHORIZATION_CODE"
  }'

Data Center: ${dc}
Developer Console: ${dcConfig.developerConsole}
`;

    return {
      needsSetup: true,
      authorizationUrl: authUrl.toString(),
      instructions: instructions.trim(),
      dataCenter: dc
    };
  }

  /**
   * Get required OAuth scopes
   */
  private getRequiredScopes(): string {
    // Get from environment or use comprehensive defaults
    return process.env.SDP_OAUTH_SCOPES || 
      'SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.tasks.ALL,' +
      'SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.assets.ALL,' +
      'SDPOnDemand.users.READ,SDPOnDemand.setup.READ';
  }

  /**
   * Get redirect URI
   */
  private getRedirectUri(): string {
    return process.env.SDP_OAUTH_REDIRECT_URI || 'http://localhost:3456/oauth/callback';
  }

  /**
   * Get server URL for instructions
   */
  private getServerUrl(): string {
    const host = process.env.SDP_HTTP_HOST || 'localhost';
    const port = process.env.SDP_HTTP_PORT || '3456';
    return `http://${host}:${port}`;
  }

  /**
   * Mark client as needing re-authorization
   */
  async markNeedsReauth(clientId: string): Promise<void> {
    const clientIdHash = hashApiKey(clientId);
    
    await this.pool.query(
      'UPDATE oauth_tokens SET needs_reauth = true WHERE client_id_hash = $1',
      [clientIdHash]
    );
  }

  /**
   * Clear re-authorization flag after successful token refresh
   */
  async clearReauthFlag(clientId: string): Promise<void> {
    const clientIdHash = hashApiKey(clientId);
    
    await this.pool.query(
      'UPDATE oauth_tokens SET needs_reauth = false WHERE client_id_hash = $1',
      [clientIdHash]
    );
  }

  /**
   * Get OAuth status for monitoring
   */
  async getOAuthStatus(clientId: string): Promise<{
    hasTokens: boolean;
    needsReauth: boolean;
    lastRefreshed?: Date;
    refreshCount?: number;
    lastError?: string;
  }> {
    const clientIdHash = hashApiKey(clientId);
    
    const result = await this.pool.query(`
      SELECT 
        ot.needs_reauth,
        ot.last_refreshed_at,
        ot.refresh_count,
        otu.error_message
      FROM oauth_tokens ot
      LEFT JOIN oauth_token_usage otu ON otu.oauth_token_id = ot.id
        AND otu.success = false
        AND otu.used_at = (
          SELECT MAX(used_at) 
          FROM oauth_token_usage 
          WHERE oauth_token_id = ot.id AND success = false
        )
      WHERE ot.client_id_hash = $1
    `, [clientIdHash]);

    if (result.rows.length === 0) {
      return { hasTokens: false, needsReauth: true };
    }

    const row = result.rows[0];
    return {
      hasTokens: true,
      needsReauth: row.needs_reauth || false,
      lastRefreshed: row.last_refreshed_at,
      refreshCount: row.refresh_count,
      lastError: row.error_message
    };
  }
}