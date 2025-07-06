-- User mappings table for API key to SDP credentials mapping
-- This enables simple multi-tenant access where users only need an API key

CREATE TABLE IF NOT EXISTS user_mappings (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  api_key_hash VARCHAR(255) NOT NULL, -- For secure lookups
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  encrypted_credentials TEXT NOT NULL, -- AES-256 encrypted JSON
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  rate_limit_override INTEGER, -- Custom rate limit for this user
  metadata JSONB DEFAULT '{}', -- Additional user metadata
  notes TEXT -- Admin notes about this user
);

-- Indexes for performance
CREATE INDEX idx_user_mappings_api_key_hash ON user_mappings(api_key_hash) WHERE is_active = true;
CREATE INDEX idx_user_mappings_user_email ON user_mappings(user_email) WHERE user_email IS NOT NULL;
CREATE INDEX idx_user_mappings_active ON user_mappings(is_active);
CREATE INDEX idx_user_mappings_last_used ON user_mappings(last_used_at DESC);

-- Audit trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_mappings_updated_at 
  BEFORE UPDATE ON user_mappings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Usage tracking table for analytics
CREATE TABLE IF NOT EXISTS user_mapping_usage (
  id SERIAL PRIMARY KEY,
  user_mapping_id INTEGER REFERENCES user_mappings(id) ON DELETE CASCADE,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  request_count INTEGER DEFAULT 1,
  error_count INTEGER DEFAULT 0
);

CREATE INDEX idx_user_mapping_usage_mapping_id ON user_mapping_usage(user_mapping_id);
CREATE INDEX idx_user_mapping_usage_used_at ON user_mapping_usage(used_at DESC);

-- Example of how to insert a user (DO NOT RUN - just documentation)
-- INSERT INTO user_mappings (api_key, api_key_hash, user_name, user_email, encrypted_credentials)
-- VALUES (
--   'usr_2KtY3Bz9F5X8vQ...', 
--   SHA256('usr_2KtY3Bz9F5X8vQ...'),
--   'John Doe',
--   'john.doe@company.com',
--   'encrypted_json_here'
-- );