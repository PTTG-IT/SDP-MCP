# Valid ServiceDesk Plus Cloud OAuth Scopes

## Confirmed Working Scopes

Based on research and testing, try these scopes one at a time to identify which are valid:

### Option 1: Basic Scopes (Start Here)
```
SDPOnDemand.requests.ALL
```

### Option 2: Add Projects
```
SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL
```

### Option 3: Add More Modules (if above works)
```
SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL
```

### Option 4: Setup/Admin Scope (use "setup" not "admin")
```
SDPOnDemand.requests.ALL,SDPOnDemand.projects.ALL,SDPOnDemand.assets.ALL,SDPOnDemand.setup.ALL
```

## Scopes That Might Not Be Valid

These scopes might be causing the "invalid scope" error:
- `SDPOnDemand.solutions.ALL` - Not found in documentation
- `SDPOnDemand.tasks.ALL` - Not confirmed in search results
- `SDPOnDemand.problems.ALL` - Might not be available
- `SDPOnDemand.changes.ALL` - Might not be available

## Troubleshooting Steps

1. **Start Small**: Begin with just `SDPOnDemand.requests.ALL`
2. **Add One at a Time**: Add each scope individually to find which ones are invalid
3. **Use Correct Format**: 
   - No spaces between commas
   - All uppercase for permission level (ALL, READ, CREATE)
   - Use "setup" instead of "admin" for administrative functions

## Alternative Approach

If you continue getting "invalid scope" errors:

1. Check what scopes are shown in your Zoho Developer Console
2. Look for a "View Available Scopes" link
3. Contact ManageEngine support for complete scope list

## What We Know Works

From our testing:
- `SDPOnDemand.requests.ALL` - Confirmed working with client_credentials
- `SDPOnDemand.setup.READ` - Mentioned in documentation
- `SDPOnDemand.setup.CREATE` - Mentioned in documentation
- `SDPOnDemand.projects.READ` - Mentioned in documentation
- `SDPOnDemand.assets.READ` - Mentioned in documentation