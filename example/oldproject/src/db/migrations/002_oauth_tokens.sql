-- OAuth Token Storage for Self Client Authentication
-- Stores tokens per Client ID with encryption

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    client_id_hash VARCHAR(255) NOT NULL UNIQUE,
    encrypted_tokens TEXT NOT NULL, -- Contains access_token, refresh_token, expires_at
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_refreshed_at TIMESTAMP WITH TIME ZONE,
    refresh_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_id_hash ON oauth_tokens(client_id_hash);
CREATE INDEX IF NOT EXISTS idx_last_refreshed ON oauth_tokens(last_refreshed_at);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oauth_tokens_updated_at_trigger ON oauth_tokens;
CREATE TRIGGER oauth_tokens_updated_at_trigger
BEFORE UPDATE ON oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION update_oauth_tokens_updated_at();

-- OAuth token usage tracking
CREATE TABLE IF NOT EXISTS oauth_token_usage (
    id SERIAL PRIMARY KEY,
    oauth_token_id INTEGER NOT NULL REFERENCES oauth_tokens(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    action VARCHAR(50), -- 'refresh', 'access', 'auth_code'
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Create indexes for oauth_token_usage
CREATE INDEX IF NOT EXISTS idx_token_usage ON oauth_token_usage(oauth_token_id, used_at);
CREATE INDEX IF NOT EXISTS idx_usage_action ON oauth_token_usage(action, used_at);

-- Add comment
COMMENT ON TABLE oauth_tokens IS 'Stores OAuth tokens for Self Client authentication with encryption';
COMMENT ON COLUMN oauth_tokens.client_id IS 'Plain text Client ID for display purposes only';
COMMENT ON COLUMN oauth_tokens.client_id_hash IS 'SHA-256 hash of Client ID for lookups';
COMMENT ON COLUMN oauth_tokens.encrypted_tokens IS 'AES-256-GCM encrypted JSON containing access_token, refresh_token, expires_at';
COMMENT ON COLUMN oauth_tokens.last_refreshed_at IS 'Last time the access token was refreshed';
COMMENT ON COLUMN oauth_tokens.refresh_count IS 'Number of times the token has been refreshed';