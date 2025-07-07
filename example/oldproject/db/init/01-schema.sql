-- Service Desk Plus MCP Database Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- OAuth tokens table for persistent token storage
CREATE TABLE oauth_tokens (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    refresh_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Token request tracking for rate limiting
CREATE TABLE token_requests (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL, -- 'access' or 'refresh'
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT
);

-- API request/response audit logging
CREATE TABLE api_audit_log (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,
    error_message TEXT,
    duration_ms INTEGER,
    token_id INTEGER REFERENCES oauth_tokens(id),
    user_context JSONB
);

-- MCP tool usage tracking
CREATE TABLE mcp_tool_usage (
    id BIGSERIAL PRIMARY KEY,
    tool_name VARCHAR(100) NOT NULL,
    arguments JSONB,
    result JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_context JSONB,
    correlation_id UUID
);

-- Change tracking for rollback capability
CREATE TABLE change_history (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL, -- 'request', 'project', 'task', etc.
    entity_id VARCHAR(255) NOT NULL,
    operation VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
    field_name VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255),
    tool_name VARCHAR(100),
    mcp_tool_usage_id BIGINT REFERENCES mcp_tool_usage(id),
    rollback_applied BOOLEAN DEFAULT false,
    rollback_at TIMESTAMP,
    notes TEXT
);

-- Cached lookup values
CREATE TABLE field_lookups (
    id SERIAL PRIMARY KEY,
    lookup_type VARCHAR(50) NOT NULL, -- 'priority', 'category', 'status', etc.
    lookup_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_valid BOOLEAN DEFAULT true
);

-- Field mappings for name-to-ID conversion
CREATE TABLE field_mappings (
    id SERIAL PRIMARY KEY,
    field_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(255) NOT NULL,
    field_id VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(field_type, field_name)
);

-- Project cache for deduplication
CREATE TABLE project_cache (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(100) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status VARCHAR(50),
    owner_email VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task tracking
CREATE TABLE task_history (
    id BIGSERIAL PRIMARY KEY,
    task_id VARCHAR(100) NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'completed'
    changes JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_oauth_tokens_active ON oauth_tokens(is_active, expires_at);
CREATE INDEX idx_oauth_tokens_refresh ON oauth_tokens(refresh_token) WHERE refresh_token IS NOT NULL;
CREATE INDEX idx_token_requests_time ON token_requests(requested_at);
CREATE INDEX idx_api_audit_timestamp ON api_audit_log(timestamp);
CREATE INDEX idx_api_audit_endpoint ON api_audit_log(endpoint, method);
CREATE INDEX idx_api_audit_request_id ON api_audit_log(request_id);
CREATE INDEX idx_mcp_tool_usage_name ON mcp_tool_usage(tool_name, timestamp);
CREATE INDEX idx_mcp_tool_usage_correlation ON mcp_tool_usage(correlation_id);
CREATE INDEX idx_change_history_entity ON change_history(entity_type, entity_id, changed_at);
CREATE INDEX idx_change_history_tool ON change_history(mcp_tool_usage_id);
CREATE INDEX idx_field_lookups_type ON field_lookups(lookup_type, is_valid);
CREATE INDEX idx_field_mappings_lookup ON field_mappings(field_type, field_name);
CREATE INDEX idx_project_cache_title ON project_cache(title);
CREATE INDEX idx_task_history_project ON task_history(project_id, timestamp);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_field_mappings_updated_at BEFORE UPDATE ON field_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_cache_updated_at BEFORE UPDATE ON project_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for active tokens
CREATE VIEW active_tokens AS
SELECT 
    id,
    token_type,
    expires_at,
    created_at,
    last_used_at,
    refresh_count,
    CASE 
        WHEN expires_at > NOW() THEN 'valid'
        ELSE 'expired'
    END as status
FROM oauth_tokens
WHERE is_active = true;

-- Create view for recent changes
CREATE VIEW recent_changes AS
SELECT 
    ch.*,
    mtu.tool_name as executed_tool,
    mtu.timestamp as execution_time
FROM change_history ch
LEFT JOIN mcp_tool_usage mtu ON ch.mcp_tool_usage_id = mtu.id
WHERE ch.changed_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY ch.changed_at DESC;

-- Grant permissions to the service user
GRANT ALL ON ALL TABLES IN SCHEMA public TO sdpmcpservice;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO sdpmcpservice;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO sdpmcpservice;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sdpmcpservice;