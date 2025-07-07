# Database Implementation Plan for SDP MCP Server

## Executive Summary

For the Service Desk Plus MCP Server, I recommend implementing **PostgreSQL** as the primary database with the following considerations:
- Already running on port 5432 (can share or use different port)
- Better suited for production use with multiple features needed
- Supports JSON storage for flexible schema evolution
- Excellent for audit logging and token management

## Database Requirements Analysis

### 1. Token Management
- Store OAuth tokens with expiry tracking
- Track token refresh attempts and rate limits
- Maintain token history for debugging
- Support concurrent access with proper locking

### 2. Audit Logging
- Log all API requests and responses
- Track MCP tool usage by tool name, user, timestamp
- Store error details for troubleshooting
- Performance metrics (response times, rate limits hit)

### 3. Field Lookup Caching
- Cache priority, category, status lookups
- Store field mappings (name to ID)
- Track cache validity and refresh times
- Support bulk operations

### 4. Project/Task Tracking
- Store project deduplication data
- Cache frequently accessed projects
- Track task creation/update history
- Store project metadata

## Database Selection: PostgreSQL

### Why PostgreSQL over SQLite:
1. **Concurrent Access**: Better handling of multiple MCP tool calls
2. **JSON Support**: Native JSONB for flexible data storage
3. **Performance**: Better for high-volume audit logging
4. **Extensions**: pgvector for future semantic search capabilities
5. **Existing Infrastructure**: Already running in Docker

### Docker Configuration
```yaml
# docker-compose.yml
services:
  sdp-mcp-db:
    image: postgres:16-alpine
    container_name: sdp-mcp-postgres
    restart: unless-stopped
    ports:
      - "5433:5432"  # Non-standard port to avoid conflicts
    environment:
      POSTGRES_DB: sdp_mcp
      POSTGRES_USER: sdp_mcp_user
      POSTGRES_PASSWORD: ${SDP_DB_PASSWORD}
    volumes:
      - sdp_mcp_data:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sdp_mcp_user -d sdp_mcp"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  sdp_mcp_data:
```

## Database Schema

### 1. Token Management
```sql
-- OAuth tokens table
CREATE TABLE oauth_tokens (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    refresh_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Token request tracking for rate limiting
CREATE TABLE token_requests (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL, -- 'access' or 'refresh'
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX idx_oauth_tokens_active ON oauth_tokens(is_active, expires_at);
CREATE INDEX idx_token_requests_time ON token_requests(requested_at);
```

### 2. Audit Logging
```sql
-- API request/response logging
CREATE TABLE api_audit_log (
    id SERIAL PRIMARY KEY,
    request_id UUID DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,
    error_message TEXT,
    duration_ms INTEGER,
    token_id INTEGER REFERENCES oauth_tokens(id)
);

-- MCP tool usage tracking
CREATE TABLE mcp_tool_usage (
    id SERIAL PRIMARY KEY,
    tool_name VARCHAR(100) NOT NULL,
    arguments JSONB,
    result JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_context JSONB
);

-- Indexes
CREATE INDEX idx_api_audit_timestamp ON api_audit_log(timestamp);
CREATE INDEX idx_api_audit_endpoint ON api_audit_log(endpoint, method);
CREATE INDEX idx_mcp_tool_usage_name ON mcp_tool_usage(tool_name, timestamp);
```

### 3. Field Lookup Cache
```sql
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
    UNIQUE(field_type, field_name)
);

-- Indexes
CREATE INDEX idx_field_lookups_type ON field_lookups(lookup_type, is_valid);
CREATE INDEX idx_field_mappings_lookup ON field_mappings(field_type, field_name);
```

### 4. Project/Task Management
```sql
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
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(100) NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'completed'
    changes JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_project_cache_title ON project_cache(title);
CREATE INDEX idx_task_history_project ON task_history(project_id, timestamp);
```

## Implementation Steps

### Phase 1: Database Setup (Day 1)
1. Create Docker Compose configuration
2. Initialize database with schema
3. Create database connection module
4. Implement connection pooling with pg library

### Phase 2: Token Management Integration (Day 2)
1. Migrate TokenStore to use database
2. Implement token persistence and retrieval
3. Add token request tracking
4. Update rate limiting logic

### Phase 3: Audit Logging (Day 3)
1. Create logging middleware for API calls
2. Implement MCP tool usage tracking
3. Add error logging with context
4. Create performance monitoring

### Phase 4: Field Lookup Caching (Day 4)
1. Migrate in-memory cache to database
2. Implement cache invalidation logic
3. Add field mapping storage
4. Create bulk update operations

### Phase 5: Project Management (Day 5)
1. Implement project caching
2. Add task history tracking
3. Create deduplication queries
4. Add project search capabilities

## Connection Configuration

```typescript
// src/db/config.ts
export const dbConfig = {
  host: process.env.SDP_DB_HOST || 'localhost',
  port: parseInt(process.env.SDP_DB_PORT || '5433'),
  database: process.env.SDP_DB_NAME || 'sdp_mcp',
  user: process.env.SDP_DB_USER || 'sdp_mcp_user',
  password: process.env.SDP_DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

## Migration Strategy

1. **Gradual Migration**: Keep existing in-memory implementations while adding database
2. **Feature Flags**: Use environment variables to toggle database features
3. **Backwards Compatible**: Ensure system works without database for development
4. **Data Migration**: Script to migrate existing token data if needed

## Performance Considerations

1. **Connection Pooling**: Use pg-pool for efficient connection management
2. **Batch Operations**: Bulk insert for audit logs
3. **Async Operations**: Non-blocking database calls
4. **Indexes**: Strategic indexing for common queries
5. **Partitioning**: Consider partitioning audit logs by month

## Security Considerations

1. **Encryption**: Encrypt sensitive tokens at rest
2. **Access Control**: Separate read/write users
3. **Audit Trail**: Log all database access
4. **Backup**: Regular automated backups
5. **SSL/TLS**: Encrypted connections

## Monitoring and Maintenance

1. **Health Checks**: Database connectivity monitoring
2. **Performance Metrics**: Query performance tracking
3. **Storage Monitoring**: Alert on disk usage
4. **Vacuum Schedule**: Regular PostgreSQL maintenance
5. **Log Rotation**: Automated cleanup of old audit logs

## Next Steps

1. Review and approve this plan
2. Set up Docker Compose for PostgreSQL
3. Create initial schema migrations
4. Implement database connection module
5. Begin phased integration starting with token management