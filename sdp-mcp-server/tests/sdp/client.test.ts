import { jest } from '@jest/globals';
import axios from 'axios';
import { SDPClient, createSDPClientFactory } from '../../src/sdp/client';
import { TokenManager } from '../../src/auth/tokenManager';
import { TenantManager } from '../../src/tenants/manager';
import { setCurrentTenantId } from '../../src/tenants/context';
import { SDPRateLimitError, SDPAuthError } from '../../src/utils/errors';

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/auth/tokenManager');
jest.mock('../../src/tenants/manager');
jest.mock('../../src/monitoring/logging');
jest.mock('../../src/monitoring/auditLogger');

describe('SDPClient', () => {
  let client: SDPClient;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockTenantManager: jest.Mocked<TenantManager>;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    // Mock managers
    mockTokenManager = {
      getAccessToken: jest.fn().mockResolvedValue('test-token'),
    } as any;

    mockTenantManager = {
      getTenant: jest.fn().mockResolvedValue({
        id: 'test-tenant',
        name: 'Test Tenant',
        dataCenter: 'US',
        rateLimitTier: 'standard',
        status: 'active',
      }),
    } as any;

    // Create client
    client = new SDPClient(
      {
        baseURL: 'https://sdpondemand.manageengine.com',
        timeout: 30000,
        enableCache: true,
        enableCircuitBreaker: true,
      },
      mockTokenManager,
      mockTenantManager
    );

    // Set tenant context
    setCurrentTenantId('test-tenant');
  });

  afterEach(() => {
    setCurrentTenantId(undefined);
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://sdpondemand.manageengine.com',
        timeout: 30000,
        headers: {
          'Accept': 'application/vnd.manageengine.sdp.v3+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    });

    it('should setup interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      // Mock successful response
      mockAxiosInstance.request.mockResolvedValue({
        data: {
          response_status: {
            status_code: 2000,
            status: 'success',
          },
          request: {
            id: '123',
            subject: 'Test Request',
          },
        },
      });
    });

    describe('get', () => {
      it('should make GET request', async () => {
        const result = await client.get('/api/v3/requests/123');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'GET',
            url: '/api/v3/requests/123',
          })
        );

        expect(result).toEqual({
          id: '123',
          subject: 'Test Request',
        });
      });

      it('should use cache for GET requests', async () => {
        // First request
        await client.get('/api/v3/requests/123');
        
        // Second request should use cache
        await client.get('/api/v3/requests/123');

        // Should only make one actual request
        expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
      });
    });

    describe('post', () => {
      it('should make POST request with formatted data', async () => {
        const data = {
          subject: 'New Request',
          description: 'Test description',
        };

        await client.post('/api/v3/requests', data);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            url: '/api/v3/requests',
            data: 'input_data=' + encodeURIComponent(JSON.stringify(data)),
          })
        );
      });
    });

    describe('put', () => {
      it('should make PUT request with formatted data', async () => {
        const data = {
          subject: 'Updated Request',
        };

        await client.put('/api/v3/requests/123', data);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'PUT',
            url: '/api/v3/requests/123',
            data: 'input_data=' + encodeURIComponent(JSON.stringify(data)),
          })
        );
      });
    });

    describe('delete', () => {
      it('should make DELETE request', async () => {
        await client.delete('/api/v3/requests/123');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'DELETE',
            url: '/api/v3/requests/123',
          })
        );
      });
    });
  });

  describe('error handling', () => {
    it('should handle rate limit errors', async () => {
      mockAxiosInstance.request.mockRejectedValue({
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: {
            response_status: {
              status_code: 4290,
              status: 'failure',
              messages: [{
                status_code: 'E50001',
                message: 'Rate limit exceeded',
              }],
            },
          },
        },
      });

      await expect(client.get('/api/v3/requests'))
        .rejects
        .toThrow(SDPRateLimitError);
    });

    it('should handle auth errors', async () => {
      mockAxiosInstance.request.mockRejectedValue({
        response: {
          status: 401,
          data: {
            response_status: {
              status_code: 4010,
              status: 'failure',
              messages: [{
                status_code: 'E10001',
                message: 'Invalid token',
              }],
            },
          },
        },
      });

      await expect(client.get('/api/v3/requests'))
        .rejects
        .toThrow(SDPAuthError);
    });

    it('should retry on network errors', async () => {
      // First attempt fails
      mockAxiosInstance.request
        .mockRejectedValueOnce({
          code: 'ECONNRESET',
          message: 'Connection reset',
        })
        // Second attempt succeeds
        .mockResolvedValueOnce({
          data: {
            response_status: { status: 'success' },
            requests: [],
          },
        });

      const result = await client.get('/api/v3/requests');

      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });
  });

  describe('tenant context', () => {
    it('should throw error if no tenant context', async () => {
      setCurrentTenantId(undefined);

      await expect(client.get('/api/v3/requests'))
        .rejects
        .toThrow('No tenant context');
    });

    it('should include tenant ID in requests', async () => {
      await client.get('/api/v3/requests');

      expect(mockTokenManager.getAccessToken).toHaveBeenCalledWith('test-tenant');
    });
  });

  describe('circuit breaker', () => {
    it('should track circuit breaker status', async () => {
      // Make some successful requests
      await client.get('/api/v3/requests');
      
      const status = client.getCircuitBreakerStatus();
      expect(status.get('GET:requests')).toBe('CLOSED');
    });

    it('should open circuit after failures', async () => {
      // Simulate multiple failures
      mockAxiosInstance.request.mockRejectedValue({
        response: { status: 500 },
      });

      // Make requests until circuit opens
      for (let i = 0; i < 5; i++) {
        try {
          await client.get('/api/v3/requests');
        } catch (error) {
          // Expected to fail
        }
      }

      const status = client.getCircuitBreakerStatus();
      expect(status.get('GET:requests')).toBe('OPEN');
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache for module', async () => {
      // Make cached request
      await client.get('/api/v3/requests/123');
      
      // Invalidate cache
      await client.invalidateCache('requests');
      
      // Next request should hit API
      mockAxiosInstance.request.mockClear();
      await client.get('/api/v3/requests/123');
      
      expect(mockAxiosInstance.request).toHaveBeenCalled();
    });
  });
});

describe('createSDPClientFactory', () => {
  let factory: ReturnType<typeof createSDPClientFactory>;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockTenantManager: jest.Mocked<TenantManager>;

  beforeEach(() => {
    mockTokenManager = {} as any;
    mockTenantManager = {} as any;
    
    factory = createSDPClientFactory(mockTokenManager, mockTenantManager);
  });

  describe('getClient', () => {
    it('should create client for valid data center', () => {
      const client = factory.getClient('US');
      expect(client).toBeInstanceOf(SDPClient);
    });

    it('should reuse client for same data center', () => {
      const client1 = factory.getClient('US');
      const client2 = factory.getClient('US');
      expect(client1).toBe(client2);
    });

    it('should create different clients for different data centers', () => {
      const clientUS = factory.getClient('US');
      const clientEU = factory.getClient('EU');
      expect(clientUS).not.toBe(clientEU);
    });
  });

  describe('getBaseURL', () => {
    it('should return correct URL for each data center', () => {
      expect(factory.getBaseURL('US')).toBe('https://sdpondemand.manageengine.com');
      expect(factory.getBaseURL('EU')).toBe('https://sdpondemand.manageengine.eu');
      expect(factory.getBaseURL('IN')).toBe('https://sdpondemand.manageengine.in');
      expect(factory.getBaseURL('CN')).toBe('https://sdpondemand.manageengine.cn');
      expect(factory.getBaseURL('AU')).toBe('https://sdpondemand.manageengine.com.au');
    });

    it('should throw error for invalid data center', () => {
      expect(() => factory.getBaseURL('INVALID'))
        .toThrow('Unknown data center: INVALID');
    });
  });
});