# Service Desk Plus Cloud OAuth Scopes

## Valid Scopes for SDPOnDemand

Based on research and testing, these are the valid OAuth scopes for Service Desk Plus Cloud (SDPOnDemand):

### Primary Scopes
- `SDPOnDemand.requests.ALL` - Full access to requests (create, read, update, delete)
- `SDPOnDemand.setup.ALL` - Full access to setup/admin features
- `SDPOnDemand.general.ALL` - General API access
- `SDPOnDemand.cmdb.ALL` - Full access to CMDB (Configuration Management Database)

### Read-Only Scopes
- `SDPOnDemand.assets.READ` - Read-only access to assets
- `SDPOnDemand.projects.READ` - Read-only access to projects
- `SDPOnDemand.setup.READ` - Read-only access to setup/configuration

### Mixed Access Scopes
- `SDPOnDemand.setup.CREATE` - Create access for setup/admin (use with READ for read+create)

## Generating Authorization Code

1. Go to Zoho API Console: https://api-console.zoho.com/
2. Navigate to your Self Client
3. Click "Generate Code" tab
4. Enter the required scopes (comma-separated):
   ```
   SDPOnDemand.requests.ALL,SDPOnDemand.setup.ALL,SDPOnDemand.general.ALL
   ```
5. Select Time Duration (e.g., 10 minutes)
6. Add Description (e.g., "MCP Server Full Access")
7. Click CREATE
8. Copy the authorization code

## Example Scope Combinations

### Full Access (Recommended for MCP Server)
```
SDPOnDemand.requests.ALL,SDPOnDemand.setup.ALL,SDPOnDemand.general.ALL,SDPOnDemand.cmdb.ALL
```

### Minimal Access (Requests Only)
```
SDPOnDemand.requests.ALL
```

### Read-Only Access
```
SDPOnDemand.requests.READ,SDPOnDemand.assets.READ,SDPOnDemand.setup.READ
```

## Important Notes

- Each access token is valid for only 1 hour
- Refresh tokens don't expire (when using offline access)
- Scopes are case-sensitive
- Invalid scopes will result in "Enter a valid scope" error
- The scope format is: `SDPOnDemand.<module>.<operation>`

## Common Invalid Scopes (Don't Use These)
- ❌ `SDPOnDemand.tasks.ALL` - Not a valid module
- ❌ `SDPOnDemand.problems.ALL` - Not a valid module
- ❌ `SDPOnDemand.changes.ALL` - Not a valid module
- ❌ `SDPOnDemand.users.READ` - Not a valid module