-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    data_center VARCHAR(10) NOT NULL CHECK (data_center IN ('US', 'EU', 'IN', 'AU', 'CN', 'JP')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    rate_limit_tier VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (rate_limit_tier IN ('basic', 'standard', 'premium', 'enterprise')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on status for quick filtering
CREATE INDEX idx_tenants_status ON tenants(status);

-- Create index on data_center for regional queries
CREATE INDEX idx_tenants_data_center ON tenants(data_center);

-- Create unique index on name to prevent duplicates
CREATE UNIQUE INDEX idx_tenants_name ON tenants(LOWER(name));

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();