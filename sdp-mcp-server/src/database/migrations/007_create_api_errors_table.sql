-- Migration: Create API errors tracking table
-- Purpose: Capture all API errors with proper status codes for analysis

CREATE TABLE IF NOT EXISTS api_errors (
    id SERIAL PRIMARY KEY,
    
    -- Error identification
    error_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    api_status_code INTEGER,                    -- SDP status code (4001, 4012, etc.)
    http_status_code INTEGER NOT NULL,          -- HTTP status (400, 401, 403, etc.)
    
    -- Error details
    error_message TEXT,
    field_name VARCHAR(255),                    -- Field that caused error
    missing_fields TEXT[],                      -- Array of missing mandatory fields
    
    -- Request context
    endpoint VARCHAR(500) NOT NULL,             -- API endpoint called
    method VARCHAR(10) NOT NULL,                -- HTTP method (GET, POST, etc.)
    request_data JSONB,                         -- Request payload (sanitized)
    
    -- Tenant/User context
    tenant_id UUID REFERENCES tenants(id),
    user_email VARCHAR(255),
    
    -- Response data
    response_data JSONB,                        -- Full error response
    
    -- Timestamps
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    CONSTRAINT valid_http_status CHECK (http_status_code >= 100 AND http_status_code < 600)
);

-- Indexes for performance
CREATE INDEX idx_api_errors_status_code ON api_errors(api_status_code);
CREATE INDEX idx_api_errors_http_status ON api_errors(http_status_code);
CREATE INDEX idx_api_errors_occurred_at ON api_errors(occurred_at DESC);
CREATE INDEX idx_api_errors_endpoint ON api_errors(endpoint);
CREATE INDEX idx_api_errors_tenant ON api_errors(tenant_id);

-- Composite index for common error analysis queries
CREATE INDEX idx_api_errors_analysis ON api_errors(api_status_code, endpoint, occurred_at DESC);

-- Comments for documentation
COMMENT ON TABLE api_errors IS 'Tracks all API errors with SDP-specific status codes for debugging and analysis';
COMMENT ON COLUMN api_errors.api_status_code IS 'Service Desk Plus specific status code (4001=Invalid ID, 4012=Missing mandatory field, etc.)';
COMMENT ON COLUMN api_errors.missing_fields IS 'Array of field names that were mandatory but missing (for 4012 errors)';

-- Function to analyze error patterns
CREATE OR REPLACE FUNCTION get_error_summary(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP - INTERVAL '7 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
    status_code INTEGER,
    error_count BIGINT,
    unique_endpoints BIGINT,
    common_message TEXT,
    last_occurrence TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        api_status_code,
        COUNT(*)::BIGINT as error_count,
        COUNT(DISTINCT endpoint)::BIGINT as unique_endpoints,
        (SELECT error_message FROM api_errors e2 
         WHERE e2.api_status_code = e.api_status_code 
         GROUP BY error_message 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as common_message,
        MAX(occurred_at) as last_occurrence
    FROM api_errors e
    WHERE occurred_at BETWEEN p_start_date AND p_end_date
    GROUP BY api_status_code
    ORDER BY error_count DESC;
END;
$$ LANGUAGE plpgsql;

-- View for common error patterns
CREATE OR REPLACE VIEW v_common_api_errors AS
SELECT 
    api_status_code,
    http_status_code,
    endpoint,
    COUNT(*) as occurrence_count,
    array_agg(DISTINCT error_message) as error_messages,
    array_agg(DISTINCT field_name) FILTER (WHERE field_name IS NOT NULL) as affected_fields,
    MAX(occurred_at) as last_seen,
    MIN(occurred_at) as first_seen
FROM api_errors
WHERE occurred_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY api_status_code, http_status_code, endpoint
HAVING COUNT(*) > 1
ORDER BY occurrence_count DESC;