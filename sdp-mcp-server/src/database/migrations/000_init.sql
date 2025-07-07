-- Initial database setup
-- This file ensures required extensions are installed

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable crypto functions for additional security
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types if needed
DO $$ BEGIN
    CREATE TYPE data_center_enum AS ENUM ('US', 'EU', 'IN', 'AU', 'CN', 'JP');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Database initialization complete';
    RAISE NOTICE 'UUID extension: enabled';
    RAISE NOTICE 'PGCrypto extension: enabled';
END $$;