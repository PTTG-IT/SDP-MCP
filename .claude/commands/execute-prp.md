# /execute-prp

Execute a Product Requirements Prompt (PRP) to implement Service Desk Plus API features.

## Usage
```
/execute-prp <prp-filename>
```

## Description
Executes a PRP file to implement the specified feature:
- Implements API client methods
- Creates corresponding MCP tools
- Adds proper TypeScript types
- Includes error handling
- Creates tests
- Updates documentation

## Process
1. Read the specified PRP file from the PRPs/ directory
2. Implement each requirement systematically:
   - Create/update API modules in src/api/modules/
   - Add MCP tools in src/mcp/tools.ts
   - Implement handlers in src/mcp/handlers.ts
   - Add TypeScript types in src/api/types.ts
3. Run validation:
   - TypeScript compilation check
   - ESLint validation
   - Test execution (if tests exist)
4. Update documentation:
   - API_REFERENCE.md
   - MCP_TOOLS.md
5. Mark tasks complete in TASK.md

## Validation
- Ensures OAuth authentication is properly handled
- Validates rate limiting is respected
- Confirms error handling follows established patterns
- Checks that MCP tools have proper Zod schemas

## Output
- Implemented code files
- Updated documentation
- Test results
- Summary of changes made