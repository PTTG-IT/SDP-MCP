import { describe, it, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import axios, { AxiosInstance } from 'axios';
import { EventSource } from 'eventsource';
import { createSSEServer } from '../src/transport/sse-server';

// Mock MCP Server
const mockServer = {
  connect: jest.fn().mockResolvedValue(undefined),
};

describe('SSE Server', () => {
  let sseServer: any;
  let client: AxiosInstance;
  const testPort = 3456;
  const testApiKey = 'test-api-key-123';
  
  beforeAll(async () => {
    // Create SSE server with test configuration
    sseServer = await createSSEServer({
      port: testPort,
      host: '127.0.0.1',
      apiKeys: [testApiKey],
      allowedIps: ['*'],
      enableCors: true,
      corsOrigin: '*',
      productionConfig: {
        maxConnectionsPerIP: 5,
        maxTotalConnections: 100,
        sessionTimeout: 30000, // 30 seconds for tests
        keepAliveInterval: 5000, // 5 seconds for tests
        rateLimitPerConnection: {
          windowMs: 60000,
          maxRequests: 10, // Lower for tests
        },
      },
      onConnection: jest.fn(),
      onDisconnection: jest.fn(),
    });
    
    // Create axios client
    client = axios.create({
      baseURL: `http://127.0.0.1:${testPort}`,
      headers: {
        'X-API-Key': testApiKey,
      },
    });
  });
  
  afterAll(async () => {
    if (sseServer) {
      await sseServer.shutdown();
    }
  });
  
  describe('Health Check', () => {
    it('should return health status without authentication', async () => {
      const response = await axios.get(`http://127.0.0.1:${testPort}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: 'ok',
        transport: 'sse',
        totalConnections: 0,
        connectionsByIP: {},
      });
      expect(response.data.uptime).toBeGreaterThan(0);
    });
  });
  
  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      try {
        await axios.get(`http://127.0.0.1:${testPort}/sse`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data).toEqual({ error: 'API key required' });
      }
    });
    
    it('should reject requests with invalid API key', async () => {
      try {
        await axios.get(`http://127.0.0.1:${testPort}/sse`, {
          headers: { 'X-API-Key': 'invalid-key' },
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(403);
        expect(error.response.data).toEqual({ error: 'Invalid API key' });
      }
    });
    
    it('should accept API key in query parameter', async () => {
      const response = await axios.get(`http://127.0.0.1:${testPort}/health`);
      expect(response.status).toBe(200);
    });
  });
  
  describe('SSE Connection', () => {
    it('should establish SSE connection with valid API key', (done) => {
      const eventSource = new EventSource(
        `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
      );
      
      eventSource.onopen = () => {
        expect(eventSource.readyState).toBe(EventSource.OPEN);
        eventSource.close();
        done();
      };
      
      eventSource.onerror = (error) => {
        eventSource.close();
        done(error);
      };
    });
    
    it('should receive keep-alive messages', (done) => {
      const eventSource = new EventSource(
        `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
      );
      
      let keepAliveReceived = false;
      
      eventSource.onmessage = (event) => {
        if (event.data === ':keepalive') {
          keepAliveReceived = true;
        }
      };
      
      setTimeout(() => {
        expect(keepAliveReceived).toBe(true);
        eventSource.close();
        done();
      }, 6000); // Wait for at least one keep-alive
    });
  });
  
  describe('Session Management', () => {
    it('should track active sessions', async () => {
      // Create a connection
      const eventSource = new EventSource(
        `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
      );
      
      // Wait for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check sessions
      const response = await client.get('/sessions');
      expect(response.data.count).toBe(1);
      expect(response.data.sessions).toHaveLength(1);
      expect(response.data.sessions[0]).toMatchObject({
        clientIp: expect.any(String),
        apiKey: expect.stringMatching(/^test-api-key/),
      });
      
      eventSource.close();
    });
    
    it('should clean up sessions on disconnect', async () => {
      const eventSource = new EventSource(
        `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify connection exists
      let response = await client.get('/sessions');
      expect(response.data.count).toBe(1);
      
      // Close connection
      eventSource.close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify session cleaned up
      response = await client.get('/sessions');
      expect(response.data.count).toBe(0);
    });
  });
  
  describe('Connection Limits', () => {
    it('should enforce per-IP connection limit', async () => {
      const connections: EventSource[] = [];
      
      try {
        // Create max connections
        for (let i = 0; i < 5; i++) {
          const es = new EventSource(
            `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
          );
          connections.push(es);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Try to create one more
        try {
          await axios.get(`http://127.0.0.1:${testPort}/sse`, {
            headers: { 'X-API-Key': testApiKey },
          });
          fail('Should have rejected connection');
        } catch (error: any) {
          expect(error.response.status).toBe(503);
          expect(error.response.data).toEqual({ error: 'Connection limit exceeded' });
        }
      } finally {
        // Clean up connections
        connections.forEach(es => es.close());
      }
    });
  });
  
  describe('Rate Limiting', () => {
    let sessionId: string;
    let eventSource: EventSource;
    
    beforeEach(async () => {
      // Establish connection and get session ID
      const response = await axios.get(`http://127.0.0.1:${testPort}/sse`, {
        headers: { 'X-API-Key': testApiKey },
        responseType: 'stream',
      });
      
      sessionId = response.headers['x-session-id'];
      eventSource = new EventSource(
        `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    afterEach(() => {
      if (eventSource) {
        eventSource.close();
      }
    });
    
    it('should enforce per-connection rate limit', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        const response = await client.post(`/messages/${sessionId}`, {
          test: 'data',
        });
        expect(response.status).toBe(200);
      }
      
      // Next request should be rate limited
      try {
        await client.post(`/messages/${sessionId}`, { test: 'data' });
        fail('Should have been rate limited');
      } catch (error: any) {
        expect(error.response.status).toBe(429);
        expect(error.response.data).toEqual({ error: 'Rate limit exceeded' });
      }
    });
  });
  
  describe('Message Handling', () => {
    it('should reject messages for non-existent sessions', async () => {
      try {
        await client.post('/messages/invalid-session-id', { test: 'data' });
        fail('Should have rejected');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toEqual({ error: 'Session not found' });
      }
    });
    
    it('should reject messages with mismatched API key', async () => {
      // Create connection with one key
      const response = await axios.get(`http://127.0.0.1:${testPort}/sse`, {
        headers: { 'X-API-Key': testApiKey },
        responseType: 'stream',
      });
      
      const sessionId = response.headers['x-session-id'];
      
      // Try to send message with different key
      try {
        await axios.post(
          `http://127.0.0.1:${testPort}/messages/${sessionId}`,
          { test: 'data' },
          { headers: { 'X-API-Key': 'different-key' } }
        );
        fail('Should have rejected');
      } catch (error: any) {
        expect(error.response.status).toBe(403);
      }
    });
  });
  
  describe('Session Timeout', () => {
    it('should timeout inactive sessions', async () => {
      // Create connection
      const eventSource = new EventSource(
        `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify session exists
      let response = await client.get('/sessions');
      expect(response.data.count).toBe(1);
      
      // Wait for timeout (30s test timeout + cleanup interval)
      await new Promise(resolve => setTimeout(resolve, 31000));
      
      // Verify session cleaned up
      response = await client.get('/sessions');
      expect(response.data.count).toBe(0);
      
      eventSource.close();
    }, 35000); // Increase test timeout
  });
  
  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      try {
        await client.get('/unknown-endpoint');
        fail('Should have returned 404');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toEqual({ error: 'Endpoint not found' });
      }
    });
    
    it('should handle malformed JSON in messages', async () => {
      // Create connection
      const response = await axios.get(`http://127.0.0.1:${testPort}/sse`, {
        headers: { 'X-API-Key': testApiKey },
        responseType: 'stream',
      });
      
      const sessionId = response.headers['x-session-id'];
      
      // Send malformed JSON
      try {
        await axios.post(
          `http://127.0.0.1:${testPort}/messages/${sessionId}`,
          'invalid json',
          {
            headers: {
              'X-API-Key': testApiKey,
              'Content-Type': 'application/json',
            },
          }
        );
        fail('Should have rejected malformed JSON');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });
  
  describe('Statistics', () => {
    it('should provide accurate connection statistics', async () => {
      const connections: EventSource[] = [];
      
      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        const es = new EventSource(
          `http://127.0.0.1:${testPort}/sse?apiKey=${testApiKey}`
        );
        connections.push(es);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Check stats
      const stats = sseServer.getStats();
      expect(stats.totalConnections).toBe(3);
      expect(stats.connectionsByIP['127.0.0.1']).toBe(3);
      expect(stats.oldestConnection).toBeTruthy();
      
      // Clean up
      connections.forEach(es => es.close());
    });
  });
});