-- Create mcp_sessions table for tracking active MCP client sessions
CREATE TABLE IF NOT EXISTS mcp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    client_info JSONB DEFAULT '{}',
    transport_type VARCHAR(20) NOT NULL CHECK (transport_type IN ('sse', 'websocket', 'stdio')),
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    total_requests INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for session management
CREATE INDEX idx_mcp_sessions_tenant_id ON mcp_sessions(tenant_id);
CREATE INDEX idx_mcp_sessions_session_token ON mcp_sessions(session_token);
CREATE INDEX idx_mcp_sessions_active ON mcp_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_mcp_sessions_last_activity ON mcp_sessions(last_activity_at DESC);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_mcp_sessions_updated_at BEFORE UPDATE ON mcp_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();