import { TokenStore } from '../api/tokenStore.js';
import { DatabaseTokenStore } from './tokenStore.js';
import { dbFeatures, testConnection } from './config.js';
import { TokenResponse } from '../api/auth.js';

/**
 * Integrates database token storage with the existing in-memory TokenStore
 */
export class TokenStoreIntegration {
  private memoryStore: TokenStore;
  private dbStore: DatabaseTokenStore | null = null;
  private isDbAvailable: boolean = false;
  
  constructor(memoryStore: TokenStore) {
    this.memoryStore = memoryStore;
  }
  
  /**
   * Get the database store instance
   */
  getDbStore(): DatabaseTokenStore | null {
    return this.dbStore;
  }

  /**
   * Load tokens from database
   */
  async loadTokensFromDatabase(): Promise<boolean> {
    if (!this.dbStore) return false;
    
    try {
      const token = await this.dbStore.getActiveToken();
      if (token) {
        this.memoryStore.setTokens(
          token.accessToken,
          token.refreshToken || undefined,
          Math.floor((token.tokenExpiry.getTime() - Date.now()) / 1000)
        );
        return true;
      }
    } catch (error) {
      console.error('Failed to load tokens from database:', error);
    }
    return false;
  }

  /**
   * Initialize database integration
   */
  async initialize(): Promise<void> {
    if (!dbFeatures.useDbTokens) {
      console.log('Database token storage is disabled');
      return;
    }
    
    try {
      // Test database connection
      this.isDbAvailable = await testConnection();
      
      if (this.isDbAvailable) {
        this.dbStore = new DatabaseTokenStore();
        console.log('Database token storage initialized');
        
        // Try to load existing token from database
        await this.loadTokenFromDatabase();
        
        // Set up periodic cleanup
        this.setupCleanup();
      } else {
        console.warn('Database connection failed, using memory-only token storage');
      }
    } catch (error) {
      console.error('Failed to initialize database token storage:', error);
      this.isDbAvailable = false;
    }
  }
  
  /**
   * Load token from database into memory store
   */
  private async loadTokenFromDatabase(): Promise<void> {
    if (!this.dbStore) return;
    
    try {
      const dbToken = await this.dbStore.getActiveToken();
      
      if (dbToken && dbToken.accessToken && dbToken.tokenExpiry > new Date()) {
        // Load valid token from database into memory
        this.memoryStore.storeTokens({
          access_token: dbToken.accessToken,
          refresh_token: dbToken.refreshToken || undefined,
          expires_in: Math.floor((dbToken.tokenExpiry.getTime() - Date.now()) / 1000),
          token_type: 'Bearer'
        } as TokenResponse);
        
        console.log('Loaded existing token from database');
      }
    } catch (error) {
      console.error('Failed to load token from database:', error);
    }
  }
  
  /**
   * Store tokens in both memory and database
   */
  async storeTokens(response: TokenResponse): Promise<void> {
    // Always store in memory first
    this.memoryStore.storeTokens(response);
    
    // Then try to store in database
    if (this.isDbAvailable && this.dbStore) {
      try {
        await this.dbStore.storeTokens(response);
      } catch (error) {
        console.error('Failed to store token in database:', error);
        // Don't fail the operation if database storage fails
      }
    }
  }
  
  /**
   * Check if token refresh is allowed (rate limiting)
   */
  async canRefreshToken(): Promise<boolean> {
    if (!this.isDbAvailable || !this.dbStore) {
      // If database is not available, use memory-based rate limiting
      return true; // The memory store handles its own rate limiting
    }
    
    try {
      const canRequest = await this.dbStore.canRequestToken();
      const canRefreshNow = await this.dbStore.canRefreshNow();
      
      return canRequest && canRefreshNow;
    } catch (error) {
      console.error('Failed to check rate limits:', error);
      return true; // Allow refresh on error
    }
  }
  
  /**
   * Record a token request for rate limiting
   */
  async recordTokenRequest(
    requestType: 'access' | 'refresh',
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    if (!this.isDbAvailable || !this.dbStore) return;
    
    try {
      await this.dbStore.recordTokenRequest(requestType, success, errorMessage);
    } catch (error) {
      console.error('Failed to record token request:', error);
    }
  }
  
  /**
   * Get debug information
   */
  async getDebugInfo(): Promise<any> {
    const memoryDebug = this.memoryStore.getDebugInfo();
    
    if (!this.isDbAvailable || !this.dbStore) {
      return {
        ...memoryDebug,
        database: { available: false }
      };
    }
    
    try {
      const dbDebug = await this.dbStore.getDebugInfo();
      return {
        ...memoryDebug,
        database: {
          available: true,
          ...dbDebug
        }
      };
    } catch (error) {
      return {
        ...memoryDebug,
        database: {
          available: true,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  
  /**
   * Set up periodic cleanup
   */
  private setupCleanup(): void {
    // Run cleanup every hour
    setInterval(async () => {
      if (this.dbStore) {
        try {
          await this.dbStore.cleanup();
        } catch (error) {
          console.error('Database cleanup failed:', error);
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

// Create singleton integration instance
let integration: TokenStoreIntegration | null = null;

/**
 * Initialize token store integration
 */
export async function initializeTokenStoreIntegration(
  tokenStore: TokenStore
): Promise<TokenStoreIntegration> {
  if (!integration) {
    integration = new TokenStoreIntegration(tokenStore);
    await integration.initialize();
  }
  return integration;
}

/**
 * Get the token store integration instance
 */
export function getTokenStoreIntegration(): TokenStoreIntegration | null {
  return integration;
}