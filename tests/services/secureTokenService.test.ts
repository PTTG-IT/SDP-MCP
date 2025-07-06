import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SecureTokenService, TokenRefreshResponse } from '../../src/services/secureTokenService';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SecureTokenService', () => {
  let service: SecureTokenService;
  let mockPool: any;

  beforeEach(() => {
    // Create mock pool
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    };

    service = new SecureTokenService(mockPool, 'https://accounts.zoho.com', 'test-instance');

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Token Refresh', () => {
    it('should successfully refresh access token with valid refresh token', async () => {
      const clientId = 'test-client';
      const clientSecret = 'test-secret';

      // Mock rate limit check
      mockPool.query.mockResolvedValueOnce({ rows: [{ can_create: true }] });

      // Mock get active refresh token
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          encrypted_refresh_token: 'encrypted-refresh-token',
          expires_at: null,
          generation: 1,
          max_usage_count: 1,
          usage_count: 0
        }]
      });

      // Mock token refresh API call
      const mockTokenResponse: TokenRefreshResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read'
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock store access token
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock update refresh token usage
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock record rate limit usage
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock log token usage
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.refreshAccessToken(clientId, clientSecret);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.scope).toBe('read');

      // Verify API call was made correctly
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://accounts.zoho.com/oauth/v2/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should throw error when rate limit is exceeded', async () => {
      const clientId = 'test-client';
      const clientSecret = 'test-secret';

      // Mock rate limit check returning false
      mockPool.query.mockResolvedValueOnce({ rows: [{ can_create: false }] });

      await expect(service.refreshAccessToken(clientId, clientSecret))
        .rejects
        .toThrow('Rate limit exceeded. Zoho allows maximum 10 tokens per 10 minutes');
    });

    it('should throw error when no active refresh token found', async () => {
      const clientId = 'test-client';
      const clientSecret = 'test-secret';

      // Mock rate limit check passing
      mockPool.query.mockResolvedValueOnce({ rows: [{ can_create: true }] });

      // Mock no active refresh token
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.refreshAccessToken(clientId, clientSecret))
        .rejects
        .toThrow('No active refresh token found. Re-authorization required.');
    });

    it('should throw error when refresh token usage limit exceeded', async () => {
      const clientId = 'test-client';
      const clientSecret = 'test-secret';

      // Mock rate limit check
      mockPool.query.mockResolvedValueOnce({ rows: [{ can_create: true }] });

      // Mock refresh token at usage limit
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          encrypted_refresh_token: 'encrypted-refresh-token',
          expires_at: null,
          generation: 1,
          max_usage_count: 1,
          usage_count: 1 // At limit
        }]
      });

      // Mock revoke refresh token
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.refreshAccessToken(clientId, clientSecret))
        .rejects
        .toThrow('Refresh token usage limit exceeded. Re-authorization required.');
    });
  });

  describe('Token Storage', () => {
    it('should store initial tokens correctly', async () => {
      const clientId = 'test-client';
      const clientSecret = 'test-secret';
      const tokenResponse: TokenRefreshResponse = {
        access_token: 'initial-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'initial-refresh-token',
        scope: 'read write'
      };

      // Mock store access token
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock store refresh token
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock log token usage (access)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock log token usage (refresh)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.storeInitialTokens(clientId, clientSecret, tokenResponse);

      expect(result.accessToken.accessToken).toBe('initial-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken!.refreshToken).toBe('initial-refresh-token');
      expect(result.refreshToken!.generation).toBe(1);
      expect(result.refreshToken!.maxUsageCount).toBe(1);
    });
  });

  describe('Token Cleanup', () => {
    it('should cleanup expired tokens', async () => {
      // Mock cleanup function returning count
      mockPool.query.mockResolvedValueOnce({ rows: [{ cleanup_expired_tokens: 5 }] });

      const cleanedCount = await service.cleanup();

      expect(cleanedCount).toBe(5);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT cleanup_expired_tokens()');
    });
  });

  describe('Token Retrieval', () => {
    it('should get valid access token from cache', async () => {
      const clientId = 'test-client';
      const clientSecret = 'test-secret';

      // Mock get valid access token from database
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          encrypted_access_token: 'encrypted-access-token',
          token_type: 'Bearer',
          expires_at: futureDate,
          scope: 'read'
        }]
      });

      // Mock log token usage
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getAccessToken(clientId, clientSecret);

      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresAt).toEqual(futureDate);
      expect(result.scope).toBe('read');
    });

    it('should refresh token when no valid access token available', async () => {
      const clientId = 'test-client';
      const clientSecret = 'test-secret';

      // Mock no valid access token in database
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock rate limit check
      mockPool.query.mockResolvedValueOnce({ rows: [{ can_create: true }] });

      // Mock get active refresh token
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          encrypted_refresh_token: 'encrypted-refresh-token',
          expires_at: null,
          generation: 1,
          max_usage_count: 1,
          usage_count: 0
        }]
      });

      // Mock token refresh API call
      const mockTokenResponse: TokenRefreshResponse = {
        access_token: 'refreshed-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read'
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockTokenResponse });

      // Mock remaining database operations
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getAccessToken(clientId, clientSecret);

      expect(result.accessToken).toBe('refreshed-access-token');
    });
  });

  describe('Token Revocation', () => {
    it('should revoke all tokens for a client', async () => {
      const clientId = 'test-client';

      // Mock revoke refresh tokens
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock delete access tokens
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock log token usage
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.revokeAllTokens(clientId, 'test_revocation');

      expect(mockPool.query).toHaveBeenCalledTimes(3);
      
      // Check that revoke query was called
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE oauth_refresh_tokens'),
        expect.arrayContaining([expect.any(String), 'test_revocation'])
      );

      // Check that delete query was called
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM oauth_access_tokens'),
        expect.arrayContaining([expect.any(String)])
      );
    });
  });
});