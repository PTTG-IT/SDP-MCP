-- Create the service user for the application
-- This runs as the postgres superuser during initialization

-- Create the sdpmcpservice user
CREATE USER sdpmcpservice WITH PASSWORD '*jDE1Bj%IPXKMe%Z';

-- Grant privileges on the database
GRANT CREATE, CONNECT ON DATABASE sdp_mcp TO sdpmcpservice;

-- Switch to the sdp_mcp database
\c sdp_mcp

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO sdpmcpservice;

-- Make sdpmcpservice the owner of all objects created later
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sdpmcpservice;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sdpmcpservice;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO sdpmcpservice;

-- Create a root user role for administrative tasks
CREATE ROLE root WITH LOGIN PASSWORD '16vOp$BeC!&9SCqv' SUPERUSER;

-- Log user creation
DO $$
BEGIN
    RAISE NOTICE 'Database users created successfully:';
    RAISE NOTICE '  - sdpmcpservice (application user)';
    RAISE NOTICE '  - root (administrative user)';
END $$;