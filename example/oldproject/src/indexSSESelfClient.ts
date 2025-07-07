#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server - SSE with Self Client Authentication
 * 
 * Users provide only Client ID and Secret in their .mcp.json
 * Server handles OAuth flow and token storage
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express, { Request, Response, NextFunction } from 'express';
import { testConnection, getPool } from './db/config.js';
import { OAuthTokenService } from './services/oauthTokenService.js';
import { OAuthSetupService } from './services/oauthSetupService.js';
import { BearerTokenService } from './services/bearerTokenService.js';
import { tools, toolSchemas } from './mcp/tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createToolHandler } from './mcp/handlers.js';
import { getClientV2 } from './utils/clientFactoryV2.js';
import { SDPConfig } from './api/types.js';
import { SDPAuthError, SDPOAuthSetupError } from './utils/errors.js';
import { validateEncryptionSetup } from './utils/encryption.js';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

// Load environment variables
dotenv.config();

// Global instances
let server: Server;
let sseServer: any;
let shutdownInProgress = false;
let oauthService: OAuthTokenService | null = null;
let setupService: OAuthSetupService | null = null;
let bearerTokenService: BearerTokenService | null = null;

// Store per-session SDP clients
const sessionClients = new Map<string, {
  client: any;
  clientId: string;
  clientSecret: string;
}>();

// Enhanced request type
interface AuthenticatedRequest extends Request {
  sessionId?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Extract Self Client credentials from request
 */
function extractClientCredentials(req: Request): { clientId: string; clientSecret: string } | null {
  // Check environment variables from MCP client
  const envClientId = req.headers['x-sdp-client-id'] as string;
  const envClientSecret = req.headers['x-sdp-client-secret'] as string;
  
  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret };
  }
  
  return null;
}

/**
 * Initialize or get client for a session
 */
async function getSessionClient(
  sessionId: string, 
  clientId: string, 
  clientSecret: string
): Promise<any> {
  // Check if client already exists for this session
  const existing = sessionClients.get(sessionId);
  if (existing && existing.clientId === clientId) {
    return existing.client;
  }
  
  if (!oauthService) {
    throw new Error('OAuth service not initialized');
  }
  
  console.log(`🔐 Initializing SDP client for session ${sessionId}...`);
  
  try {
    // Check if client needs setup first
    const setupInfo = await setupService!.checkSetupStatus(clientId);
    if (setupInfo.needsSetup) {
      throw new SDPOAuthSetupError(
        'OAuth authorization required',
        setupInfo
      );
    }
    
    // Get OAuth tokens for this client
    const tokenData = await oauthService.getTokensForClient(clientId, clientSecret);
    
    // Create SDP config with tokens
    const config: SDPConfig = {
      clientId,
      clientSecret,
      refreshToken: tokenData.refreshToken,
      baseUrl: process.env.SDP_BASE_URL!,
      instanceName: process.env.SDP_INSTANCE_NAME!,
      authCode: '' // Not needed with refresh token
    };
    
    // Create client
    const client = await getClientV2(config);
    
    // Store client for this session
    sessionClients.set(sessionId, { client, clientId, clientSecret });
    
    console.log(`✅ Client initialized for session ${sessionId}`);
    return client;
  } catch (error) {
    console.error(`❌ Failed to initialize client for session ${sessionId}:`, error);
    
    // If it's an auth error that's not already a setup error, check if we need setup
    if (error instanceof SDPAuthError && !(error instanceof SDPOAuthSetupError)) {
      await setupService!.markNeedsReauth(clientId);
      const setupInfo = await setupService!.checkSetupStatus(clientId);
      throw new SDPOAuthSetupError(
        'Authentication failed - OAuth re-authorization required',
        setupInfo
      );
    }
    
    throw error;
  }
}

/**
 * Clean up session resources
 */
function cleanupSession(sessionId: string): void {
  if (sessionClients.has(sessionId)) {
    console.log(`🧹 Cleaning up session ${sessionId}...`);
    sessionClients.delete(sessionId);
  }
}

/**
 * Main server initialization
 */
async function main() {
  console.log('🚀 Starting Service Desk Plus MCP Server (Self Client Auth)');
  console.log('======================================================\n');

  // Validate required configuration
  if (!process.env.SDP_BASE_URL || !process.env.SDP_INSTANCE_NAME) {
    throw new Error('SDP_BASE_URL and SDP_INSTANCE_NAME must be set in environment');
  }

  console.log(`📍 Instance: ${process.env.SDP_INSTANCE_NAME}`);
  console.log(`🌐 Base URL: ${process.env.SDP_BASE_URL}`);

  try {
    // Validate encryption setup
    console.log('\n🔐 Validating encryption setup...');
    if (!validateEncryptionSetup()) {
      throw new Error('Encryption validation failed. Check SDP_ENCRYPTION_KEY environment variable.');
    }
    console.log('✅ Encryption validated');

    // Test database connection
    console.log('\n📊 Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection required for OAuth token storage');
    }
    console.log('✅ Database connected');

    // Initialize OAuth service
    const pool = getPool();
    if (!pool) {
      throw new Error('Database pool not available');
    }

    // Initialize schema
    console.log('\n📋 Initializing OAuth token schema...');
    await OAuthTokenService.initializeSchema(pool);
    
    oauthService = new OAuthTokenService(
      pool,
      process.env.SDP_BASE_URL,
      process.env.SDP_INSTANCE_NAME
    );
    setupService = new OAuthSetupService(
      pool,
      process.env.SDP_BASE_URL,
      process.env.SDP_INSTANCE_NAME
    );
    bearerTokenService = new BearerTokenService();
    console.log('✅ OAuth and Bearer token services initialized');

    // Create MCP server
    console.log('\n📡 Creating MCP server...');
    server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'service-desk-plus-self-client',
        version: '8.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: zodToJsonSchema(toolSchemas[tool.name]),
        })),
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      try {
        const { name, arguments: args } = request.params;
        
        // Get session context
        const sessionId = (extra as any)?.sessionId;
        const clientId = (extra as any)?.clientId;
        const clientSecret = (extra as any)?.clientSecret;
        
        if (!sessionId || !clientId || !clientSecret) {
          throw new Error('Session context not available. Please ensure Client ID and Secret are configured.');
        }
        
        // Special handling for check_auth_status tool
        if (name === 'check_auth_status') {
          try {
            const status = await setupService!.getOAuthStatus(clientId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    authenticated: status.hasTokens && !status.needsReauth,
                    hasTokens: status.hasTokens,
                    needsReauth: status.needsReauth,
                    lastRefreshed: status.lastRefreshed,
                    refreshCount: status.refreshCount,
                    lastError: status.lastError,
                    mode: 'self-client'
                  }, null, 2),
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to check authentication status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
              isError: true
            };
          }
        }
        
        // Get or create client for this session
        const client = await getSessionClient(sessionId, clientId, clientSecret);
        
        // Create tool handler with session-specific client
        const handler = createToolHandler(name, client);
        return await handler(args);
      } catch (error) {
        // Handle OAuth setup errors specially
        if (error instanceof SDPOAuthSetupError && error.setupInfo) {
          return {
            content: [
              {
                type: 'text',
                text: `OAuth Setup Required\n\n${error.setupInfo.instructions}`,
              },
            ],
            isError: true,
            metadata: {
              needsOAuthSetup: true,
              authorizationUrl: error.setupInfo.authorizationUrl,
              dataCenter: error.setupInfo.dataCenter
            }
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            },
          ],
          isError: true
        };
      }
    });

    // Create Express app for SSE
    console.log('\n🌐 Starting SSE server...');
    const app = express();
    
    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: false, // SSE needs this disabled
    }));
    
    // CORS
    if (process.env.SDP_ENABLE_CORS !== 'false') {
      app.use(cors({
        origin: process.env.SDP_CORS_ORIGIN || '*',
        credentials: true,
      }));
    }
    
    // Parse JSON bodies
    app.use(express.json());
    
    // Request logging middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`📥 ${new Date().toISOString()} ${req.method} ${req.path}`);
      console.log(`   Headers:`, req.headers);
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`   Body:`, JSON.stringify(req.body, null, 2));
      }
      next();
    });
    
    // Sessions map
    const sessions = new Map<string, any>();
    
    // Bearer token authentication middleware
    const authenticateBearer = (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token'
        });
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const credentials = bearerTokenService!.validateToken(token);
      
      if (!credentials) {
        return res.status(401).json({ 
          error: 'Invalid or expired token',
          message: 'Please obtain a new token from /auth/token'
        });
      }
      
      req.clientId = credentials.clientId;
      req.clientSecret = credentials.clientSecret;
      req.sessionId = crypto.randomUUID();
      
      next();
    };
    
    // Legacy authentication middleware (for backwards compatibility)
    const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
      const credentials = extractClientCredentials(req);
      
      if (!credentials) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please provide SDP_CLIENT_ID and SDP_CLIENT_SECRET in your .mcp.json env configuration'
        });
      }
      
      req.clientId = credentials.clientId;
      req.clientSecret = credentials.clientSecret;
      req.sessionId = crypto.randomUUID();
      
      next();
    };
    
    // Health check endpoint
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ 
        status: 'healthy',
        server: 'service-desk-plus-self-client',
        sessions: sessions.size,
        tokens: bearerTokenService?.getStats() || { activeTokens: 0, clientIds: [] }
      });
    });
    
    // Authorization endpoint (stub - we use client credentials flow)
    app.get('/auth/authorize', (req: Request, res: Response) => {
      res.status(501).json({
        error: 'not_implemented',
        error_description: 'Authorization code flow not supported. Use client_credentials grant type with /auth/token endpoint.'
      });
    });
    
    // Bearer token endpoint
    app.post('/auth/token', async (req: Request, res: Response) => {
      try {
        let { client_id, client_secret, grant_type } = req.body;
        
        // Only support client_credentials grant type
        if (grant_type && grant_type !== 'client_credentials') {
          return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Only client_credentials grant type is supported'
          });
        }
        
        // Check if this is a dynamically registered client
        if (client_id && client_id.startsWith('mcp_')) {
          // For dynamically registered clients, extract real credentials from the request
          // First try to get from Authorization header
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Basic ')) {
            const credentials = Buffer.from(authHeader.substring(6), 'base64').toString().split(':');
            if (credentials.length === 2) {
              client_id = credentials[0];
              client_secret = credentials[1];
            }
          }
          
          // If not in header, check if real credentials were passed in body
          if (client_secret === 'use_environment_credentials') {
            // Extract from environment or fall back to test credentials
            const envCredentials = extractClientCredentials(req);
            if (envCredentials) {
              client_id = envCredentials.clientId;
              client_secret = envCredentials.clientSecret;
            }
          }
        }
        
        if (!client_id || !client_secret || client_secret === 'use_environment_credentials') {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing or invalid client credentials. For registered clients, provide real credentials.'
          });
        }
        
        // Generate bearer token with real credentials
        const tokenData = await bearerTokenService!.generateToken(client_id, client_secret);
        
        res.json(tokenData);
      } catch (error) {
        console.error('❌ Token generation failed:', error);
        res.status(500).json({
          error: 'server_error',
          error_description: error instanceof Error ? error.message : 'Failed to generate token'
        });
      }
    });
    
    // OAuth discovery endpoints - return simplified metadata
    app.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.json({
        resource: `${baseUrl}/sse`,
        authorization_servers: [baseUrl]
      });
    });
    
    app.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/auth/authorize`,
        token_endpoint: `${baseUrl}/auth/token`,
        registration_endpoint: `${baseUrl}/register`,
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
        grant_types_supported: ['client_credentials', 'authorization_code'],
        response_types_supported: ['code', 'token'],
        code_challenge_methods_supported: ['S256']
      });
    });
    
    app.get('/.well-known/oauth-authorization-server/sse', (req: Request, res: Response) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/auth/authorize`,
        token_endpoint: `${baseUrl}/auth/token`,
        registration_endpoint: `${baseUrl}/register`,
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
        grant_types_supported: ['client_credentials', 'authorization_code'],
        response_types_supported: ['code', 'token'],
        code_challenge_methods_supported: ['S256']
      });
    });
    
    app.post('/register', (req: Request, res: Response) => {
      // Implement minimal dynamic client registration
      // We accept any client and return a "registration" that uses the actual credentials
      const { client_name, redirect_uris } = req.body;
      
      // Generate a fake client ID that we'll map back to the real credentials
      const registeredClientId = `mcp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      res.status(201).json({
        client_id: registeredClientId,
        client_secret: 'use_environment_credentials',
        client_name: client_name || 'MCP Client',
        redirect_uris: redirect_uris || [],
        grant_types: ['client_credentials'],
        response_types: ['token'],
        token_endpoint_auth_method: 'client_secret_post',
        // Additional metadata
        client_id_issued_at: Math.floor(Date.now() / 1000),
        // Note: We'll map this back to real credentials in the token endpoint
        _note: 'Use your actual SDP_CLIENT_ID and SDP_CLIENT_SECRET for token requests'
      });
    });
    
    // OAuth initialization check endpoint (kept for admin use)
    app.post('/oauth/initialize', async (req: Request, res: Response) => {
      try {
        const { clientId } = req.body;
        
        if (!clientId) {
          return res.status(400).json({
            error: 'Missing client ID',
            message: 'Provide clientId in request body'
          });
        }
        
        const setupInfo = await setupService!.checkSetupStatus(clientId);
        
        if (setupInfo.needsSetup) {
          res.json({
            needsSetup: true,
            authorizationUrl: setupInfo.authorizationUrl,
            instructions: setupInfo.instructions,
            dataCenter: setupInfo.dataCenter
          });
          return;
        } else {
          res.json({
            needsSetup: false,
            message: 'Client is already authorized'
          });
          return;
        }
      } catch (error) {
        res.status(500).json({
          error: 'Failed to check OAuth status',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
      }
    });
    
    // SSE endpoint - supports both bearer token and legacy authentication
    app.get('/sse', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Check if bearer token is provided
      if (req.headers.authorization?.startsWith('Bearer ')) {
        return authenticateBearer(req, res, next);
      }
      // Fall back to legacy authentication
      return authenticate(req, res, next);
    }, async (req: AuthenticatedRequest, res: Response) => {
      const sessionId = req.sessionId!;
      const clientId = req.clientId!;
      const clientSecret = req.clientSecret!;
      
      console.log(`🔌 New SSE connection from client: ${clientId.substring(0, 20)}...`);
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      
      // Create SSE transport with session context
      const transport = new SSEServerTransport('/message', res);
      await transport.start();
      
      // Connect with extra context
      const extraContext = { sessionId, clientId, clientSecret };
      server.connect(transport, extraContext);
      
      // Store session
      sessions.set(sessionId, {
        transport,
        clientId,
        createdAt: new Date(),
        lastActivity: new Date()
      });
      
      console.log(`✅ Session ${sessionId} established`);
      
      // Handle connection close
      req.on('close', () => {
        console.log(`🔌 SSE connection closed for session ${sessionId}`);
        sessions.delete(sessionId);
        cleanupSession(sessionId);
      });
    });
    
    // OAuth setup endpoint (for admin use)
    app.post('/oauth/setup', async (req: Request, res: Response) => {
      try {
        const { clientId, clientSecret, authCode } = req.body;
        
        if (!clientId || !clientSecret || !authCode) {
          return res.status(400).json({
            error: 'Missing required fields',
            message: 'Provide clientId, clientSecret, and authCode'
          });
        }
        
        // Exchange auth code for tokens
        const tokenData = await oauthService!.exchangeAuthCode(clientId, clientSecret, authCode);
        
        // Clear any reauth flags
        await setupService!.clearReauthFlag(clientId);
        
        res.json({
          success: true,
          message: 'OAuth tokens stored successfully',
          expiresAt: tokenData.expiresAt
        });
        return;
      } catch (error) {
        res.status(500).json({
          error: 'OAuth setup failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
      }
    });
    
    // List clients endpoint (for admin)
    app.get('/oauth/clients', async (_req: Request, res: Response) => {
      try {
        const clients = await oauthService!.listClients();
        res.json({ clients });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to list clients',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Catch-all 404 handler to log missing endpoints
    app.use((req: Request, res: Response) => {
      console.log(`❌ 404 Not Found: ${req.method} ${req.originalUrl || req.url}`);
      console.log(`   Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl || req.url}`);
      console.log(`   Headers:`, req.headers);
      res.status(404).json({ 
        error: 'Not Found',
        path: req.originalUrl || req.url,
        method: req.method,
        message: 'This endpoint does not exist. Available endpoints: /sse, /health, /oauth/initialize, /oauth/setup'
      });
    });
    
    // Start server
    const port = parseInt(process.env.SDP_HTTP_PORT || '3456');
    const host = process.env.SDP_HTTP_HOST || '0.0.0.0';
    
    sseServer = app.listen(port, host, () => {
      console.log('\n');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✨ Service Desk Plus MCP Server Ready (Self Client Auth)');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`📍 Endpoint: http://${host}:${port}/sse`);
      console.log(`🏢 Instance: ${process.env.SDP_INSTANCE_NAME}`);
      console.log(`🔐 Auth: Self Client (OAuth)`)
      console.log(`📊 Database: Connected`);
      console.log('\n💡 Client Configuration (.mcp.json):');
      console.log('   {');
      console.log('     "mcpServers": {');
      console.log('       "service-desk-plus": {');
      console.log('         "type": "sse",');
      console.log(`         "url": "http://${host}:${port}/sse",`);
      console.log('         "env": {');
      console.log('           "SDP_CLIENT_ID": "1000.XXXXX...",');
      console.log('           "SDP_CLIENT_SECRET": "YYYYY..."');
      console.log('         }');
      console.log('       }');
      console.log('     }');
      console.log('   }');
      console.log('\n📝 First-time setup:');
      console.log('   1. Create Self Client at https://api-console.zoho.com/');
      console.log('   2. Generate authorization code with offline scope');
      console.log('   3. POST to /oauth/setup with clientId, clientSecret, authCode');
      console.log('═══════════════════════════════════════════════════════════════\n');
      
      console.log('Press Ctrl+C to stop\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  
  console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop accepting new connections
    if (sseServer) {
      console.log('   • Closing SSE server...');
      await new Promise<void>((resolve) => {
        sseServer.close(() => {
          console.log('   ✅ SSE server closed');
          resolve();
        });
      });
    }
    
    // Clean up all sessions
    console.log('   • Cleaning up sessions...');
    for (const sessionId of sessionClients.keys()) {
      cleanupSession(sessionId);
    }
    console.log('   ✅ All sessions cleaned up');
    
    console.log('\n✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  shutdown('unhandledRejection');
});

// Import crypto for session IDs
import crypto from 'crypto';

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});