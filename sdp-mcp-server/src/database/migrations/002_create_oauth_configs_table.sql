-- Create oauth_configs table for storing encrypted OAuth credentials
CREATE TABLE IF NOT EXISTS oauth_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id_encrypted TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    encryption_version INTEGER NOT NULL DEFAULT 1,
    allowed_scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    sdp_instance_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure one OAuth config per tenant
CREATE UNIQUE INDEX idx_oauth_configs_tenant_id ON oauth_configs(tenant_id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_oauth_configs_updated_at BEFORE UPDATE ON oauth_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();