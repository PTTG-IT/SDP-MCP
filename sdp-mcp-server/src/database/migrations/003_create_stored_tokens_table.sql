-- Create stored_tokens table for access token management
CREATE TABLE IF NOT EXISTS stored_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    last_refreshed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    refresh_count INTEGER DEFAULT 0,
    encryption_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure one active token per tenant
CREATE UNIQUE INDEX idx_stored_tokens_tenant_id ON stored_tokens(tenant_id);

-- Create index on expiration for cleanup queries
CREATE INDEX idx_stored_tokens_expires_at ON stored_tokens(expires_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_stored_tokens_updated_at BEFORE UPDATE ON stored_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();