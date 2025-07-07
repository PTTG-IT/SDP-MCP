-- Create tool_usage_stats table for analytics
CREATE TABLE IF NOT EXISTS tool_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    total_duration_ms BIGINT DEFAULT 0,
    avg_duration_ms INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN (success_count + failure_count) > 0 
            THEN total_duration_ms / (success_count + failure_count)
            ELSE 0
        END
    ) STORED,
    last_used_at TIMESTAMP WITH TIME ZONE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for daily stats per tenant/tool/operation
CREATE UNIQUE INDEX idx_tool_usage_stats_daily ON tool_usage_stats(tenant_id, tool_name, operation, date);

-- Create indexes for analytics queries
CREATE INDEX idx_tool_usage_stats_tenant_date ON tool_usage_stats(tenant_id, date DESC);
CREATE INDEX idx_tool_usage_stats_tool_name ON tool_usage_stats(tool_name);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_tool_usage_stats_updated_at BEFORE UPDATE ON tool_usage_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();