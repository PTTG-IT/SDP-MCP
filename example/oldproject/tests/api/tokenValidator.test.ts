import { TokenValidator } from '../../src/api/tokenValidator';
import { TokenStore } from '../../src/api/tokenStore';
import { RateLimitCoordinator } from '../../src/api/rateLimitCoordinator';
import { SDPConfig } from '../../src/api/types';
import axios from 'axios';
import { jest } from '@jest/globals';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TokenValidator', () => {
  let validator: TokenValidator;
  let tokenStore: TokenStore;
  let config: SDPConfig;

  beforeEach(() => {
    // Reset singletons
    (TokenStore as any).instance = null;
    (RateLimitCoordinator as any).instance = null;

    config = {
      clientId: 'test-client',
      clientSecret: 'test-secret',
      instanceName: 'test-instance',
      authCode: 'test-code'
    };

    tokenStore = TokenStore.getInstance();
    validator = new TokenValidator(config);

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should return invalid when no token available', async () => {
      const result = await validator.validateToken();
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('No access token available');
      expect(result.needsRefresh).toBe(true);
    });

    it('should return invalid when token expired', async () => {
      // Set expired token
      tokenStore.setTokens(
        'expired-token',
        'refresh-token',
        -3600 // Expired 1 hour ago
      );

      const result = await validator.validateToken();
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Token has expired');
      expect(result.expiresIn).toBe(0);
      expect(result.needsRefresh).toBe(true);
    });

    it('should return valid when token not expired', async () => {
      // Set valid token
      tokenStore.setTokens(
        'valid-token',
        'refresh-token',
        3600 // Expires in 1 hour
      );

      const result = await validator.validateToken(true); // Skip API check
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.expiresIn).toBeGreaterThan(3500);
      expect(result.needsRefresh).toBe(false);
    });

    it('should detect token needs refresh soon', async () => {
      // Set token expiring in 4 minutes
      tokenStore.setTokens(
        'expiring-token',
        'refresh-token',
        240 // 4 minutes
      );

      const result = await validator.validateToken(true);
      
      expect(result.isValid).toBe(true);
      expect(result.needsRefresh).toBe(true);
      expect(result.expiresIn).toBeLessThan(300);
    });

    it('should validate with API when not skipped', async () => {
      tokenStore.setTokens('valid-token', 'refresh-token', 3600);

      // Mock successful API response
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { requests: [] }
      });

      const result = await validator.validateToken(false);
      
      expect(result.isValid).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/requests'),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer valid-token',
            'Accept': 'application/vnd.manageengine.sdp.v3+json'
          }
        })
      );
    });

    it('should detect revoked token via API', async () => {
      // Use a unique token to avoid cache conflicts
      const uniqueToken = `revoked-token-${Date.now()}`;
      tokenStore.setTokens(uniqueToken, 'refresh-token', 3600);

      // Clear validator cache to force API call
      validator.clearCache();

      // Clear any previous mocks and set up rejection
      mockedAxios.get.mockClear();
      
      // Create a proper AxiosError mock
      const axiosError = new Error('Request failed with status code 401') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 401 };
      
      mockedAxios.get.mockRejectedValueOnce(axiosError);

      const result = await validator.validateToken(false);
      
      console.log('Mock call count:', mockedAxios.get.mock.calls.length);
      console.log('Mock call args:', mockedAxios.get.mock.calls);
      console.log('Validation result:', result);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Token validation failed with API');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should cache validation results', async () => {
      tokenStore.setTokens('cached-token', 'refresh-token', 3600);

      // First call
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      await validator.validateToken(false);

      // Second call should use cache
      const result = await validator.validateToken(false);
      
      expect(result.isValid).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('getRefreshRecommendation', () => {
    it('should recommend refresh for expired token', async () => {
      tokenStore.setTokens('expired-token', 'refresh-token', -100);

      const recommendation = await validator.getRefreshRecommendation();
      
      expect(recommendation.shouldRefresh).toBe(true);
      expect(recommendation.reason).toBe('Token has expired');
    });

    it('should recommend refresh for expiring token', async () => {
      tokenStore.setTokens('expiring-token', 'refresh-token', 180); // 3 minutes

      const recommendation = await validator.getRefreshRecommendation();
      
      expect(recommendation.shouldRefresh).toBe(true);
      expect(recommendation.reason).toContain('Token expires in');
    });

    it('should not recommend refresh for healthy token', async () => {
      tokenStore.setTokens('healthy-token', 'refresh-token', 1800); // 30 minutes

      const recommendation = await validator.getRefreshRecommendation();
      
      expect(recommendation.shouldRefresh).toBe(false);
      expect(recommendation.reason).toBe('Token is valid and not expiring soon');
    });
  });

  describe('validateRefreshToken', () => {
    it('should detect missing refresh token', async () => {
      tokenStore.setTokens('access-token', undefined, 3600);

      const result = await validator.validateRefreshToken();
      
      expect(result.hasRefreshToken).toBe(false);
      expect(result.canUseRefreshToken).toBe(false);
      expect(result.reason).toBe('No refresh token available');
    });

    it('should check rate limits for refresh token', async () => {
      tokenStore.setTokens('access-token', 'refresh-token', 3600);

      // Make coordinator block refresh
      const coordinator = RateLimitCoordinator.getInstance();
      await coordinator.recordTokenRefresh(true); // Use up the limit

      const result = await validator.validateRefreshToken();
      
      expect(result.hasRefreshToken).toBe(true);
      expect(result.canUseRefreshToken).toBe(false);
      expect(result.reason).toContain('Rate limit: Must wait');
    });

    it('should allow refresh when rate limit permits', async () => {
      tokenStore.setTokens('access-token', 'refresh-token', 3600);

      const result = await validator.validateRefreshToken();
      
      expect(result.hasRefreshToken).toBe(true);
      expect(result.canUseRefreshToken).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('getTokenStatus', () => {
    it('should provide comprehensive status', async () => {
      tokenStore.setTokens('test-token', 'refresh-token', 600); // 10 minutes

      const status = await validator.getTokenStatus();
      
      expect(status.access).toBeDefined();
      expect(status.access.isValid).toBe(true);
      expect(status.access.needsRefresh).toBe(false);
      
      expect(status.refresh).toBeDefined();
      expect(status.refresh.hasRefreshToken).toBe(true);
      
      expect(status.recommendation).toBeDefined();
      expect(status.recommendation.shouldRefresh).toBe(false);
      
      expect(status.rateLimitStatus).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should clear cache on demand', async () => {
      tokenStore.setTokens('cached-token', 'refresh-token', 3600);

      // Cache a result
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      await validator.validateToken(false);

      // Clear cache
      validator.clearCache();

      // Next call should hit API again
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      await validator.validateToken(false);

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should track last validation time', async () => {
      tokenStore.setTokens('test-token', 'refresh-token', 3600);

      expect(validator.getLastValidationTime()).toBeNull();

      mockedAxios.get.mockResolvedValueOnce({ status: 200 });
      await validator.validateToken(false);

      expect(validator.getLastValidationTime()).toBeInstanceOf(Date);
    });
  });
});