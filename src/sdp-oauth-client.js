/**
 * Service Desk Plus OAuth Client
 * Handles authentication and token management
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class SDPOAuthClient {
  constructor(config = {}) {
    // Use the refresh token from sdp-mcp-server's .env if available
    this.clientId = config.clientId || process.env.SDP_CLIENT_ID || '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU';
    this.clientSecret = config.clientSecret || process.env.SDP_CLIENT_SECRET || '5752f7060c587171f81b21d58c5b8d0019587ca999';
    this.refreshToken = config.refreshToken || process.env.SDP_REFRESH_TOKEN || '1000.58376be1b900c8dba9c8cb277e07ab31.0766efe7060d6208a7c71b0b9d057936';
    this.dataCenter = config.dataCenter || process.env.SDP_DATA_CENTER || 'US';
    
    // Token storage
    this.accessToken = null;
    this.tokenExpiry = null;
    this.tokenFile = path.join(__dirname, '..', '.sdp-tokens.json');
    
    // OAuth endpoints by data center
    this.oauthEndpoints = {
      US: 'https://accounts.zoho.com/oauth/v2/token',
      EU: 'https://accounts.zoho.eu/oauth/v2/token',
      IN: 'https://accounts.zoho.in/oauth/v2/token',
      AU: 'https://accounts.zoho.com.au/oauth/v2/token',
      JP: 'https://accounts.zoho.jp/oauth/v2/token',
      UK: 'https://accounts.zoho.uk/oauth/v2/token',
      CA: 'https://accounts.zohocloud.ca/oauth/v2/token',
      CN: 'https://accounts.zoho.com.cn/oauth/v2/token'
    };
  }
  
  /**
   * Get OAuth endpoint for the configured data center
   */
  getOAuthEndpoint() {
    return this.oauthEndpoints[this.dataCenter] || this.oauthEndpoints.US;
  }
  
  /**
   * Load tokens from file if available
   */
  async loadTokens() {
    try {
      const data = await fs.readFile(this.tokenFile, 'utf8');
      const tokens = JSON.parse(data);
      this.accessToken = tokens.accessToken;
      this.tokenExpiry = new Date(tokens.tokenExpiry);
      this.refreshToken = tokens.refreshToken || this.refreshToken;
      console.error('Loaded tokens from file');
    } catch (error) {
      console.error('No token file found, will need to refresh');
    }
  }
  
  /**
   * Save tokens to file
   */
  async saveTokens() {
    const tokens = {
      accessToken: this.accessToken,
      tokenExpiry: this.tokenExpiry,
      refreshToken: this.refreshToken,
      savedAt: new Date().toISOString()
    };
    await fs.writeFile(this.tokenFile, JSON.stringify(tokens, null, 2));
    console.error('Saved tokens to file');
  }
  
  /**
   * Check if current token is valid
   */
  isTokenValid() {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }
    // Check if token expires in next 5 minutes
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    return new Date().getTime() < (this.tokenExpiry.getTime() - expiryBuffer);
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please run OAuth setup.');
    }
    
    console.error('Refreshing access token...');
    
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      params.append('refresh_token', this.refreshToken);
      
      const response = await axios.post(this.getOAuthEndpoint(), params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      this.accessToken = response.data.access_token;
      // Zoho tokens expire in 1 hour (3600 seconds)
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      
      await this.saveTokens();
      console.error('Access token refreshed successfully');
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to refresh token:', error.response?.data || error.message);
      throw new Error('OAuth token refresh failed');
    }
  }
  
  /**
   * Get valid access token (refresh if needed)
   */
  async getAccessToken() {
    // Load tokens from file if not in memory
    if (!this.accessToken) {
      await this.loadTokens();
    }
    
    // Check if token is still valid
    if (this.isTokenValid()) {
      return this.accessToken;
    }
    
    // Refresh token
    return await this.refreshAccessToken();
  }
  
  /**
   * Exchange authorization code for tokens (initial setup)
   */
  async exchangeAuthCode(authCode, redirectUri) {
    console.error('Exchanging authorization code...');
    
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      params.append('redirect_uri', redirectUri);
      params.append('code', authCode);
      
      const response = await axios.post(this.getOAuthEndpoint(), params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
      
      await this.saveTokens();
      console.error('Authorization successful! Tokens saved.');
      
      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('Failed to exchange auth code:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = { SDPOAuthClient };