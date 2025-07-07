-- Migration 004: MCP OAuth Clients
-- This migration creates tables for MCP client OAuth authentication
-- This is SEPARATE from SDP API OAuth tokens

-- MCP OAuth Clients table
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  client_secret VARCHAR(255), -- NULL for public clients
  client_name VARCHAR(255) NOT NULL,
  redirect_uris TEXT[], -- Array of allowed redirect URIs
  grant_types TEXT[] DEFAULT ARRAY['authorization_code'],
  response_types TEXT[] DEFAULT ARRAY['code'],
  scope TEXT DEFAULT 'mcp:tools',
  contacts TEXT[],
  logo_uri VARCHAR(500),
  client_uri VARCHAR(500),
  policy_uri VARCHAR(500),
  tos_uri VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MCP OAuth Authorization Codes
CREATE TABLE IF NOT EXISTS mcp_authorization_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(255) NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id VARCHAR(255), -- Optional user identifier
  redirect_uri VARCHAR(500),
  scope TEXT,
  code_challenge VARCHAR(255), -- For PKCE
  code_challenge_method VARCHAR(10), -- S256 or plain
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MCP OAuth Access Tokens
CREATE TABLE IF NOT EXISTS mcp_access_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(255) NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id VARCHAR(255), -- Optional user identifier
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MCP OAuth Refresh Tokens
CREATE TABLE IF NOT EXISTS mcp_refresh_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(255) NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  user_id VARCHAR(255), -- Optional user identifier
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_clients_client_id ON mcp_oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_mcp_authorization_codes_code ON mcp_authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_mcp_authorization_codes_expires ON mcp_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_token ON mcp_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_expires ON mcp_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_refresh_tokens_token ON mcp_refresh_tokens(token);

-- Function to clean up expired codes and tokens
CREATE OR REPLACE FUNCTION cleanup_expired_mcp_oauth() RETURNS void AS $$
BEGIN
  -- Delete expired authorization codes
  DELETE FROM mcp_authorization_codes 
  WHERE expires_at < CURRENT_TIMESTAMP;
  
  -- Delete expired access tokens
  DELETE FROM mcp_access_tokens 
  WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
  
  -- Delete expired refresh tokens
  DELETE FROM mcp_refresh_tokens 
  WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger
CREATE OR REPLACE TRIGGER update_mcp_oauth_clients_timestamp
  BEFORE UPDATE ON mcp_oauth_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();