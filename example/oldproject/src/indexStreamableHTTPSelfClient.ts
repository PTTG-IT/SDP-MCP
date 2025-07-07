#!/usr/bin/env node

/**
 * Service Desk Plus MCP Server - Streamable HTTP with Self Client Authentication
 * 
 * Users provide only Client ID and Secret in their .mcp.json
 * Server handles OAuth flow and token storage
 * 
 * Updated to use modern Streamable HTTP transport instead of deprecated SSE
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response, NextFunction } from 'express';
import { testConnection, getPool } from './db/config.js';
import { OAuthTokenService } from './services/oauthTokenService.js';
import { OAuthSetupService } from './services/oauthSetupService.js';
import { MCPOAuthService, ClientRegistrationSchema, AuthorizationRequestSchema, TokenRequestSchema } from './services/mcpOAuthService.js';
import { tools, toolSchemas } from './mcp/tools.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
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
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Global instances
let server: Server;
let httpServer: any;
let shutdownInProgress = false;
let oauthService: OAuthTokenService | null = null;
let setupService: OAuthSetupService | null = null;
let mcpOAuthService: MCPOAuthService;

// Store per-session SDP clients and transports
const sessionClients = new Map<string, {
  client: any;
  clientId: string;
  clientSecret: string;
}>();

const transports = new Map<string, StreamableHTTPServerTransport>();

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
  // Check headers for credentials
  const clientId = req.headers['x-sdp-client-id'] as string;
  const clientSecret = req.headers['x-sdp-client-secret'] as string;
  
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  
  // Check body for credentials (for POST requests)
  if (req.body?.clientId && req.body?.clientSecret) {
    return {
      clientId: req.body.clientId,
      clientSecret: req.body.clientSecret
    };
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
  if (transports.has(sessionId)) {
    transports.delete(sessionId);
  }
}

/**
 * Main server initialization
 */
async function main() {
  console.log('🚀 Starting Service Desk Plus MCP Server (Self Client Auth - Streamable HTTP)');
  console.log('==================================================================\n');

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
    
    // Initialize MCP OAuth schema
    console.log('\n🔑 Initializing MCP OAuth schema...');
    await MCPOAuthService.initializeSchema(pool);
    mcpOAuthService = new MCPOAuthService(pool);
    console.log('✅ MCP OAuth services initialized');

    // Create MCP server
    console.log('\n📡 Creating MCP server...');
    server = new Server(
      {
        name: process.env.MCP_SERVER_NAME || 'service-desk-plus-self-client',
        version: '8.1.0',
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

    // Create Express app
    console.log('\n🌐 Starting HTTP server...');
    const app = express();
    
    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: false,
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
    
    // Authentication middleware - supports both OAuth Bearer tokens and custom headers
    const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
      // First check for OAuth Bearer token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        
        // Special handling for our bypass token
        if (token === 'USE_CUSTOM_HEADERS') {
          // This means OAuth flow completed with bypass, use custom headers instead
          const credentials = extractClientCredentials(req);
          
          if (!credentials) {
            return res.status(401).json({ 
              error: 'Authentication required',
              message: 'Please provide x-sdp-client-id and x-sdp-client-secret headers'
            });
          }
          
          req.clientId = credentials.clientId;
          req.clientSecret = credentials.clientSecret;
          req.sessionId = req.headers['x-session-id'] as string || crypto.randomUUID();
          
          next();
          return;
        }
        
        try {
          const tokenInfo = await mcpOAuthService.validateAccessToken(token);
          if (tokenInfo.valid && tokenInfo.client_id) {
            // For OAuth clients, we use the client_id as both client ID and secret
            // The actual SDP credentials will be looked up from the database
            req.clientId = tokenInfo.client_id;
            req.clientSecret = tokenInfo.client_id; // Placeholder, actual SDP auth is separate
            req.sessionId = req.headers['x-session-id'] as string || crypto.randomUUID();
            
            next();
            return;
          }
        } catch (error) {
          // Token validation failed, try other methods
        }
      }
      
      // Fall back to custom header authentication for backward compatibility
      const credentials = extractClientCredentials(req);
      
      if (!credentials) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please provide a Bearer token or SDP_CLIENT_ID and SDP_CLIENT_SECRET headers'
        });
      }
      
      req.clientId = credentials.clientId;
      req.clientSecret = credentials.clientSecret;
      req.sessionId = req.headers['x-session-id'] as string || crypto.randomUUID();
      
      next();
    };
    
    // Health check endpoint
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ 
        status: 'healthy',
        server: 'service-desk-plus-self-client',
        transport: 'streamable-http',
        sessions: sessionClients.size
      });
    });

    // OAuth discovery endpoints - indicate OAuth is optional
    app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
      res.json({
        "resource": "http://localhost:3456/mcp",
        "authorization_servers": [] // Empty array indicates OAuth is optional
      });
    });

    app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
      // Return 404 to indicate OAuth is not required for this server
      // Clients with custom headers can connect directly
      res.status(404).json({
        error: "not_found",
        error_description: "This MCP server supports custom header authentication. OAuth is optional."
      });
    });

    // Dynamic Client Registration endpoint
    app.post('/register', async (req: Request, res: Response) => {
      try {
        const registration = ClientRegistrationSchema.parse(req.body);
        const client = await mcpOAuthService.registerClient(registration);
        
        res.status(201).json({
          ...client,
          client_id_issued_at: Math.floor(Date.now() / 1000),
          grant_types: client.grant_types,
          response_types: client.response_types,
          registration_access_token: client.client_id, // Simplified for now
          registration_client_uri: `http://127.0.0.1:${port}/register/${client.client_id}`
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({
            error: "invalid_client_metadata",
            error_description: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          });
        } else {
          res.status(500).json({
            error: "server_error",
            error_description: error instanceof Error ? error.message : 'Registration failed'
          });
        }
      }
    });

    // OAuth Authorization endpoint - bypass for custom header auth
    app.get('/authorize', async (req: Request, res: Response) => {
      console.log('🔑 Authorization endpoint called:', req.query);
      
      try {
        // For custom header authentication, we bypass OAuth
        // Check if this looks like an MCP client trying to connect
        const redirectUri = req.query.redirect_uri as string;
        const state = req.query.state as string;
        
        if (redirectUri) {
          // Immediately redirect back with a special code that indicates custom auth
          const redirectUrl = new URL(redirectUri);
          redirectUrl.searchParams.set('code', 'CUSTOM_AUTH_BYPASS');
          if (state) {
            redirectUrl.searchParams.set('state', state);
          }
          
          // Auto-redirect to bypass OAuth flow
          res.redirect(redirectUrl.toString());
          return;
        }
        
        // If no redirect URI, return an error
        res.status(400).json({
          error: "invalid_request",
          error_description: "This server uses custom header authentication. Configure your client with x-sdp-client-id and x-sdp-client-secret headers."
        });
      } catch (error) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "This server uses custom header authentication"
        });
      }
    });

    // OAuth Token endpoint
    app.post('/token', async (req: Request, res: Response) => {
      console.log('🔐 Token endpoint called:', {
        body: req.body,
        headers: {
          authorization: req.headers.authorization,
          'content-type': req.headers['content-type']
        }
      });
      
      try {
        const params = TokenRequestSchema.parse(req.body);
        
        // Validate client credentials
        const authHeader = req.headers.authorization;
        let clientId = params.client_id;
        let clientSecret = params.client_secret;
        
        // Support basic auth
        if (authHeader && authHeader.startsWith('Basic ')) {
          const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
          const [id, secret] = credentials.split(':');
          clientId = id;
          clientSecret = secret;
        }
        
        // Skip validation for custom auth bypass
        if (params.grant_type === 'authorization_code' && params.code === 'CUSTOM_AUTH_BYPASS') {
          // Allow bypass without client validation
        } else {
          const isValid = await mcpOAuthService.validateClient(clientId, clientSecret);
          if (!isValid) {
            res.status(401).json({
              error: "invalid_client",
              error_description: "Client authentication failed"
            });
            return;
          }
        }
        
        let tokens;
        if (params.grant_type === 'authorization_code') {
          if (!params.code || !params.redirect_uri) {
            res.status(400).json({
              error: "invalid_request",
              error_description: "Missing required parameters for authorization_code grant"
            });
            return;
          }
          
          // Special handling for custom auth bypass
          if (params.code === 'CUSTOM_AUTH_BYPASS') {
            // Return a dummy token that tells the client to use custom headers
            tokens = {
              access_token: 'USE_CUSTOM_HEADERS',
              token_type: 'Bearer',
              expires_in: 3600000, // Long expiry
              refresh_token: 'USE_CUSTOM_HEADERS',
              scope: 'mcp:tools'
            };
          } else {
            tokens = await mcpOAuthService.exchangeCodeForTokens(
              params.code,
              clientId,
              params.redirect_uri,
              params.code_verifier
            );
          }
        } else if (params.grant_type === 'refresh_token') {
          if (!params.refresh_token) {
            res.status(400).json({
              error: "invalid_request",
              error_description: "Missing refresh_token"
            });
            return;
          }
          
          tokens = await mcpOAuthService.refreshAccessToken(params.refresh_token, clientId);
        } else {
          res.status(400).json({
            error: "unsupported_grant_type",
            error_description: `Grant type '${params.grant_type}' is not supported`
          });
          return;
        }
        
        res.json(tokens);
      } catch (error) {
        console.error('❌ Token endpoint error:', error);
        
        if (error instanceof z.ZodError) {
          console.log('Zod validation errors:', error.errors);
          res.status(400).json({
            error: "invalid_request",
            error_description: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          });
        } else {
          res.status(500).json({
            error: "server_error",
            error_description: error instanceof Error ? error.message : 'Token exchange failed'
          });
        }
      }
    });
    
    // OAuth initialization check endpoint
    app.post('/oauth/initialize', async (req: Request, res: Response) => {
      try {
        const { clientId } = req.body;
        
        if (!clientId) {
          res.status(400).json({
            error: 'Missing client ID',
            message: 'Provide clientId in request body'
          });
          return;
        }
        
        const setupInfo = await setupService!.checkSetupStatus(clientId);
        
        if (setupInfo.needsSetup) {
          res.json({
            needsSetup: true,
            authorizationUrl: setupInfo.authorizationUrl,
            instructions: setupInfo.instructions,
            dataCenter: setupInfo.dataCenter
          });
        } else {
          res.json({
            needsSetup: false,
            message: 'Client is already authorized'
          });
        }
      } catch (error) {
        res.status(500).json({
          error: 'Failed to check OAuth status',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // Main MCP endpoint using Streamable HTTP
    app.post('/mcp', authenticate, async (req: AuthenticatedRequest, res: Response) => {
      const sessionId = req.sessionId!;
      const clientId = req.clientId!;
      const clientSecret = req.clientSecret!;
      
      console.log(`🔌 New MCP request from client: ${clientId.substring(0, 20)}... (session: ${sessionId})`);
      
      try {
        // Get or create transport for this session
        let transport = transports.get(sessionId);
        if (!transport) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
          });
          transports.set(sessionId, transport);
          
          // Connect server to transport
          await server.connect(transport);
          
          console.log(`✅ Session ${sessionId} established`);
        }
        
        // Update session activity
        sessionClients.set(sessionId, {
          ...sessionClients.get(sessionId)!,
          clientId,
          clientSecret
        });
        
        // Handle the request
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error(`❌ Error handling MCP request for session ${sessionId}:`, error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // OAuth setup endpoint (for admin use)
    app.post('/oauth/setup', async (req: Request, res: Response) => {
      try {
        const { clientId, clientSecret, authCode } = req.body;
        
        if (!clientId || !clientSecret || !authCode) {
          res.status(400).json({
            error: 'Missing required fields',
            message: 'Provide clientId, clientSecret, and authCode'
          });
          return;
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
      } catch (error) {
        res.status(500).json({
          error: 'OAuth setup failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
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
    
    // Session cleanup endpoint
    app.post('/sessions/cleanup', (req: Request, res: Response) => {
      const { sessionId } = req.body;
      if (sessionId) {
        cleanupSession(sessionId);
        res.json({ message: `Session ${sessionId} cleaned up` });
      } else {
        // Clean up all inactive sessions
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutes
        let cleaned = 0;
        
        for (const [id, client] of sessionClients.entries()) {
          if (!client.client || (now - client.client.lastActivity > timeout)) {
            cleanupSession(id);
            cleaned++;
          }
        }
        
        res.json({ message: `Cleaned up ${cleaned} inactive sessions` });
      }
    });
    
    // Start server
    const port = parseInt(process.env.SDP_HTTP_PORT || '3456');
    const host = process.env.SDP_HTTP_HOST || '0.0.0.0';
    
    httpServer = app.listen(port, host);
    
    httpServer.on('listening', () => {
      console.log('\n');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✨ Service Desk Plus MCP Server Ready (Self Client Auth)');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(`📍 Endpoint: http://localhost:${port}/mcp`);
      console.log(`🏢 Instance: ${process.env.SDP_INSTANCE_NAME}`);
      console.log(`🔐 Auth: Self Client (OAuth)`);
      console.log(`📊 Database: Connected`);
      console.log(`🚀 Transport: Streamable HTTP (Modern)`);
      console.log('\n💡 Client Configuration (.mcp.json):');
      console.log('   {');
      console.log('     "mcpServers": {');
      console.log('       "service-desk-plus": {');
      console.log('         "type": "http",');
      console.log(`         "url": "http://localhost:${port}/mcp",`);
      console.log('         "headers": {');
      console.log('           "x-sdp-client-id": "1000.XXXXX...",');
      console.log('           "x-sdp-client-secret": "YYYYY..."');
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
    
    httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
      } else if (error.code === 'EADDRNOTAVAIL') {
        console.error(`❌ Address ${host}:${port} is not available`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
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
    if (httpServer) {
      console.log('   • Closing HTTP server...');
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log('   ✅ HTTP server closed');
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

// Start the server
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});