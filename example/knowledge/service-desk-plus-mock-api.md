# Service Desk Plus Mock API Documentation

## Overview

A mock Service Desk Plus API server is available for development and testing. It perfectly mimics the real API behavior while allowing safe testing without affecting production data.

## Features

### Exact API Mimicry
- Same endpoints and URL structure as real API
- Identical error responses and status codes
- Enforces same business rules (e.g., can't update closed tickets)
- Returns same field validation errors

### Mock Data Identification
All mock data includes `is_mock: true` field to distinguish from real data:
```json
{
  "id": "MOCK-216826000006430001",
  "subject": "[MOCK] Test ticket",
  "is_mock": true
}
```

### Pre-configured Test Data
Includes mock:
- Priorities, statuses, categories, impacts
- Request types, urgency levels, modes
- Sample open and closed tickets

## Starting the Mock Server

### Option 1: Mock API + SSE Server
```bash
cd sdp-mcp-server
./start-mock-server.sh
```

This starts:
- Mock API on port 3457
- SSE MCP server on port 3456 (using mock API)

### Option 2: Mock API Only
```bash
npm run mock:api
```

### Option 3: Use with Existing SSE Server
```bash
# Terminal 1: Start mock API
npm run mock:api

# Terminal 2: Start SSE server with mock
export SDP_USE_MOCK_API=true
export SDP_BASE_URL=http://localhost:3457
./start-sse-server.sh
```

## Configuration

### Environment Variables
- `SDP_USE_MOCK_API=true` - Enable mock API usage
- `SDP_BASE_URL=http://localhost:3457` - Mock API URL
- `MOCK_SDP_PORT=3457` - Mock API port (default: 3457)

### Mock API Base URL
```
http://localhost:3457/app/itdesk/api/v3
```

## Supported Endpoints

### Requests
- `GET /requests` - List requests
- `GET /requests/{id}` - Get request details  
- `POST /requests` - Create request
- `PUT /requests/{id}` - Update request
- `POST /requests/{id}/notes` - Add note

### Metadata
- `GET /priorities` - List priorities
- `GET /categories` - List categories
- `GET /impacts` - List impacts
- `GET /modes` - List modes
- `GET /request_types` - List request types
- `GET /urgencies` - List urgencies
- `GET /levels` - List support levels

## Business Rules

### Mandatory Fields for Create
When creating a request, these fields are required:
- mode
- request_type
- urgency
- level
- impact
- category
- status

### Update Restrictions
- Cannot update priority, category, or other fields on closed tickets
- Returns 403 error: "Cannot give value for {field}"

### Status Handling
- Must use name format: `{ name: "Open" }`
- Using ID format returns: "Unable to parse the given data for id"

## Testing Examples

### Test Script
```bash
node scripts/test-mock-api.cjs
```

### Manual Testing with curl
```bash
# List requests
curl -H "Authorization: Bearer test" \
  "http://localhost:3457/app/itdesk/api/v3/requests?input_data={\"list_info\":{\"row_count\":10}}"

# Create request
curl -X POST -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  "http://localhost:3457/app/itdesk/api/v3/requests" \
  -d "input_data={\"request\":{\"subject\":\"Test\",\"mode\":{\"name\":\"Web Form\"},\"request_type\":{\"name\":\"Incident\"},\"urgency\":{\"name\":\"2 - General Concern\"},\"level\":{\"name\":\"1 - Frontline\"},\"impact\":{\"name\":\"1 - Affects User\"},\"category\":{\"name\":\"Software\"},\"status\":{\"name\":\"Open\"}}}"
```

## Differences from Real API

1. **Authentication**: Accepts any Bearer token (no OAuth validation)
2. **Persistence**: Data only persists during server session
3. **IDs**: Uses `MOCK-` prefix for all generated IDs
4. **Metadata**: Limited to common values (not full production set)
5. **Features**: Core CRUD operations only (no attachments, workflows, etc.)

## Use Cases

### Development
- Test MCP tools without real API calls
- Develop new features safely
- Debug error handling

### Testing
- Unit tests with predictable responses
- Integration tests with known data
- Error scenario testing

### Demo/Training
- Safe environment for demos
- Training new developers
- Documentation examples

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3457
lsof -i :3457

# Kill the process
kill -9 <PID>
```

### Mock Server Not Detected
Ensure mock server is running before starting SSE server with mock mode.

### Wrong API Called
Check environment variables are set before starting SSE server.

## Implementation Details

The mock server (`mock-sdp-api-server.cjs`) implements:
- Express.js server
- In-memory data storage
- Full request validation
- Error response matching
- State management for CRUD operations

## Future Enhancements

- Configurable error injection
- Request/response logging
- Data persistence between sessions
- More comprehensive test data
- WebSocket support for real-time updates