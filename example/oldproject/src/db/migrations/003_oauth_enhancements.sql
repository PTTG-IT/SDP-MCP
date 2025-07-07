-- OAuth Token Enhancements for Better Self-Client Authentication
-- Adds support for tracking auth status and recovery

-- Add needs_reauth flag to track when tokens need re-authorization
ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS needs_reauth BOOLEAN DEFAULT FALSE;

-- Add last successful API call timestamp for monitoring
ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS last_api_success TIMESTAMP WITH TIME ZONE;

-- Add failure tracking
ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

-- Add circuit breaker state
ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS circuit_breaker_state VARCHAR(20) DEFAULT 'closed' 
  CHECK (circuit_breaker_state IN ('closed', 'open', 'half-open'));

ALTER TABLE oauth_tokens 
ADD COLUMN IF NOT EXISTS circuit_breaker_opened_at TIMESTAMP WITH TIME ZONE;

-- Add index for circuit breaker queries
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state 
ON oauth_tokens(circuit_breaker_state, circuit_breaker_opened_at);

-- Create table for OAuth setup tracking
CREATE TABLE IF NOT EXISTS oauth_setup_attempts (
    id SERIAL PRIMARY KEY,
    client_id_hash VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    data_center VARCHAR(10),
    setup_type VARCHAR(20) CHECK (setup_type IN ('initial', 'reauth'))
);

-- Create indexes for oauth_setup_attempts
CREATE INDEX IF NOT EXISTS idx_setup_client ON oauth_setup_attempts(client_id_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_setup_success ON oauth_setup_attempts(success, attempted_at);

-- Function to update last API success
CREATE OR REPLACE FUNCTION update_last_api_success(p_client_id_hash VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE oauth_tokens 
    SET last_api_success = CURRENT_TIMESTAMP,
        consecutive_failures = 0,
        circuit_breaker_state = 'closed'
    WHERE client_id_hash = p_client_id_hash;
END;
$$ LANGUAGE plpgsql;

-- Function to handle API failure
CREATE OR REPLACE FUNCTION handle_api_failure(p_client_id_hash VARCHAR)
RETURNS VOID AS $$
DECLARE
    v_failures INTEGER;
    v_circuit_state VARCHAR(20);
BEGIN
    -- Get current state
    SELECT consecutive_failures, circuit_breaker_state 
    INTO v_failures, v_circuit_state
    FROM oauth_tokens 
    WHERE client_id_hash = p_client_id_hash;
    
    -- Increment failure count
    v_failures := COALESCE(v_failures, 0) + 1;
    
    -- Open circuit breaker after 5 consecutive failures
    IF v_failures >= 5 AND v_circuit_state = 'closed' THEN
        UPDATE oauth_tokens 
        SET consecutive_failures = v_failures,
            circuit_breaker_state = 'open',
            circuit_breaker_opened_at = CURRENT_TIMESTAMP
        WHERE client_id_hash = p_client_id_hash;
    ELSE
        UPDATE oauth_tokens 
        SET consecutive_failures = v_failures
        WHERE client_id_hash = p_client_id_hash;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if circuit breaker should transition to half-open
CREATE OR REPLACE FUNCTION check_circuit_breaker(p_client_id_hash VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_state VARCHAR(20);
    v_opened_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT circuit_breaker_state, circuit_breaker_opened_at 
    INTO v_state, v_opened_at
    FROM oauth_tokens 
    WHERE client_id_hash = p_client_id_hash;
    
    -- If open for more than 5 minutes, transition to half-open
    IF v_state = 'open' AND 
       v_opened_at IS NOT NULL AND 
       CURRENT_TIMESTAMP - v_opened_at > INTERVAL '5 minutes' THEN
        
        UPDATE oauth_tokens 
        SET circuit_breaker_state = 'half-open'
        WHERE client_id_hash = p_client_id_hash;
        
        RETURN 'half-open';
    END IF;
    
    RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON COLUMN oauth_tokens.needs_reauth IS 'Flag indicating if the client needs to re-authorize';
COMMENT ON COLUMN oauth_tokens.last_api_success IS 'Last time an API call succeeded with these tokens';
COMMENT ON COLUMN oauth_tokens.consecutive_failures IS 'Number of consecutive API failures';
COMMENT ON COLUMN oauth_tokens.circuit_breaker_state IS 'Circuit breaker state to prevent continuous failures';
COMMENT ON TABLE oauth_setup_attempts IS 'Tracks OAuth setup attempts for monitoring and debugging';