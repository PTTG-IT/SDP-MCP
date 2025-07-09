# Recommended OAuth Scope for MCP Server

## The "Everything We'll Need" Scope Combination

```
SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.solutions.ALL,SDPOnDemand.assets.READ,SDPOnDemand.setup.READ,SDPOnDemand.users.READ
```

## What This Gives You

### ✅ Request Management (requests.ALL)
- Create, read, update, delete requests
- Close requests with resolution
- Add notes and comments
- Manage attachments
- Request history and time entries
- Request approvals

### ✅ Problem Management (problems.ALL)
- Create problems from recurring requests
- Root cause analysis
- Problem workarounds
- Link problems to requests

### ✅ Change Management (changes.ALL)
- Create change requests
- CAB approvals
- Impact analysis
- Change tasks
- Rollback plans

### ✅ Knowledge Base (solutions.ALL)
- Create and search solutions
- Link solutions to requests
- Solution ratings and feedback

### ✅ Asset Information (assets.READ)
- View asset details
- Check asset assignments
- Asset history
- Useful for impact analysis

### ✅ Configuration Data (setup.READ)
- Categories and subcategories
- Priorities and statuses
- Request templates
- SLA policies
- All metadata needed for dropdowns

### ✅ User/Technician Info (users.READ)
- List technicians (if endpoint exists)
- User profiles
- Department info
- For assignments and routing

## Why This Combination

1. **Covers all ITSM processes** - Incident, Problem, Change
2. **Knowledge management** - Solutions for self-service
3. **Asset context** - Know what's affected
4. **All metadata** - No surprises with missing dropdowns
5. **Future-proof** - Won't need new tokens for months

## OAuth URL

```
https://accounts.zoho.com/oauth/v2/auth?client_id=1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU&redirect_uri=https://localhost:3000/callback&response_type=code&access_type=offline&prompt=consent&scope=SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.solutions.ALL,SDPOnDemand.assets.READ,SDPOnDemand.setup.READ,SDPOnDemand.users.READ
```

## If This Fails

If Zoho rejects this combination, try removing one scope at a time in this order:
1. Remove `users.READ` (we know the endpoint might not exist)
2. Remove `assets.READ` (nice to have but not critical)
3. Remove `solutions.ALL` (can add later if needed)

## Minimal "Must Have" Fallback

```
SDPOnDemand.requests.ALL,SDPOnDemand.problems.ALL,SDPOnDemand.changes.ALL,SDPOnDemand.setup.READ
```

This covers the core ITSM trilogy (Incident, Problem, Change) plus all the metadata you need.