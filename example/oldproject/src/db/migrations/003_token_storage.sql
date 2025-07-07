-- Enhanced OAuth Token Storage for Secure Token Lifecycle Management
-- Following OAuth 2.0 best practices for encrypted token storage

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    client_id_hash VARCHAR(255) NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata for monitoring
    usage_count INTEGER DEFAULT 0,
    source VARCHAR(100), -- 'refresh', 'auth_code', etc.
    
    -- Indexes
    INDEX idx_access_client_hash (client_id_hash),
    INDEX idx_access_expires (expires_at),
    INDEX idx_access_last_used (last_used_at)
);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    client_id_hash VARCHAR(255) NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_revoked BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for non-expiring tokens
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    -- Token rotation support
    previous_token_id INTEGER REFERENCES oauth_refresh_tokens(id),
    generation INTEGER DEFAULT 1, -- Track token generations
    
    -- Security tracking
    usage_count INTEGER DEFAULT 0,
    max_usage_count INTEGER DEFAULT 1, -- Single-use by default
    
    -- Audit fields
    created_ip INET,
    last_used_ip INET,
    revocation_reason VARCHAR(255),
    
    -- Indexes
    INDEX idx_refresh_client_hash (client_id_hash),
    INDEX idx_refresh_active (is_active),
    INDEX idx_refresh_expires (expires_at),
    UNIQUE INDEX idx_refresh_token_hash (client_id_hash, encrypted_refresh_token) WHERE is_active = true
);

-- Rate limiting table for Zoho's 10 tokens per 10 minutes limit
CREATE TABLE IF NOT EXISTS token_rate_limits (
    id SERIAL PRIMARY KEY,
    client_id_hash VARCHAR(255) NOT NULL,
    token_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Cleanup old entries automatically
    INDEX idx_rate_limit_client_time (client_id_hash, token_created_at)
);

-- Token usage audit log
CREATE TABLE IF NOT EXISTS token_audit_log (
    id SERIAL PRIMARY KEY,
    client_id_hash VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'refresh', 'revoke', 'use', 'expire'
    token_type VARCHAR(20) NOT NULL, -- 'access', 'refresh'
    token_id INTEGER, -- Reference to token table
    success BOOLEAN DEFAULT true,
    error_code VARCHAR(100),
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional context
    metadata JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_audit_client_action (client_id_hash, action, created_at),
    INDEX idx_audit_errors (success, error_code, created_at)
);

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Delete expired access tokens
    DELETE FROM oauth_access_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Delete old rate limit entries (older than 10 minutes)
    DELETE FROM token_rate_limits 
    WHERE token_created_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes';
    
    -- Archive old audit logs (keep last 30 days)
    DELETE FROM token_audit_log 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(p_client_id_hash VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    token_count INTEGER;
BEGIN
    -- Count tokens created in last 10 minutes
    SELECT COUNT(*) INTO token_count
    FROM token_rate_limits
    WHERE client_id_hash = p_client_id_hash
      AND token_created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes';
    
    -- Zoho allows max 10 tokens per 10 minutes
    RETURN token_count < 10;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE oauth_access_tokens IS 'Encrypted storage for OAuth access tokens with expiration tracking';
COMMENT ON TABLE oauth_refresh_tokens IS 'Encrypted storage for OAuth refresh tokens with rotation and revocation support';
COMMENT ON TABLE token_rate_limits IS 'Rate limiting tracking for OAuth token creation (Zoho: 10 tokens per 10 minutes)';
COMMENT ON TABLE token_audit_log IS 'Audit trail for all token operations and security events';

COMMENT ON COLUMN oauth_access_tokens.encrypted_access_token IS 'AES-256-GCM encrypted access token';
COMMENT ON COLUMN oauth_refresh_tokens.encrypted_refresh_token IS 'AES-256-GCM encrypted refresh token';
COMMENT ON COLUMN oauth_refresh_tokens.max_usage_count IS 'Maximum times this refresh token can be used (1 for single-use)';
COMMENT ON COLUMN oauth_refresh_tokens.generation IS 'Token generation number for rotation tracking';

-- Initialize cleanup job (for future automation)
-- This would typically be called by a cron job or background task
-- SELECT cleanup_expired_tokens();