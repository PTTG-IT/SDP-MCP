# Service Desk Plus OAuth Scope Combinations

## Purpose
Since some scope combinations may not be accepted by Zoho OAuth, here are combinations ordered from most useful to least useful for the MCP server functionality.

## Try These Combinations in Order

### 1. Core Help Desk Functions (Most Important)
```
SDPOnDemand.requests.ALL,SDPOnDemand.setup.READ
```
- ✅ Create, read, update, close requests
- ✅ Add notes to requests
- ✅ Get metadata (categories, priorities, statuses)
- ❌ No technician lookup (but can use technician IDs directly)

### 2. Help Desk + User Management
```
SDPOnDemand.requests.ALL,SDPOnDemand.users.READ,SDPOnDemand.setup.READ
```
- ✅ All request operations
- ✅ Technician lookup for assignments
- ✅ Metadata access

### 3. Help Desk + Problem Management
```
SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.setup.READ
```
- ✅ All request operations
- ✅ Create problems from requests
- ✅ Problem root cause analysis

### 4. Help Desk + Solutions (Knowledge Base)
```
SDPOnDemand.requests.ALL,SDPOnDemand.solutions.READ,SDPOnDemand.setup.READ
```
- ✅ All request operations
- ✅ Search knowledge base for solutions
- ✅ Link solutions to requests

### 5. Minimal Request Management
```
SDPOnDemand.requests.ALL
```
- ✅ Basic request operations
- ❌ No metadata (might fail on create/update)
- ❌ No technician lookup

### 6. Read-Only Access
```
SDPOnDemand.requests.READ,SDPOnDemand.setup.READ
```
- ✅ View requests only
- ✅ Get metadata
- ❌ No create/update/close operations

### 7. Full Technician Access (Comprehensive)
```
SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.users.READ,SDPOnDemand.setup.READ
```
- ✅ Complete ITSM functionality
- ✅ All core modules
- ⚠️ May be rejected due to too many scopes

### 8. Asset Management Focus
```
SDPOnDemand.assets.ALL,SDPOnDemand.setup.READ
```
- ✅ Asset tracking
- ❌ No request management

### 9. Project Management Focus
```
SDPOnDemand.projects.ALL,SDPOnDemand.setup.READ
```
- ✅ Project and task management
- ❌ No request management

### 10. System Administrator (All Modules)
```
SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.solutions.ALL,SDPOnDemand.setup.READ,SDPOnDemand.users.ALL
```
- ✅ Everything
- ⚠️ Most likely to be rejected

## OAuth Code Generation Instructions

When generating the OAuth code:

1. Go to: https://accounts.zoho.com/oauth/v2/auth
2. Use these parameters:
   - client_id: 1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU
   - redirect_uri: https://localhost:3000/callback
   - response_type: code
   - access_type: offline
   - prompt: consent
   - scope: [Use one of the combinations above]

3. Example URL for combination #1:
```
https://accounts.zoho.com/oauth/v2/auth?client_id=1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU&redirect_uri=https://localhost:3000/callback&response_type=code&access_type=offline&prompt=consent&scope=SDPOnDemand.requests.ALL,SDPOnDemand.setup.READ
```

## Notes

- Start with combination #1 (Core Help Desk Functions) as it provides the most essential functionality
- If #1 works, try #2 to add user management
- Each combination builds on core functionality
- The `/users` endpoint may not exist in the API, so user scopes might not be necessary
- `setup.READ` is important for metadata (categories, priorities, statuses)