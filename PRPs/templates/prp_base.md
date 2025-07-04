# Product Requirements Prompt (PRP)

## Feature: [Feature Name]

### Overview
[Brief description of the feature and its purpose]

### Requirements

#### Functional Requirements
1. **API Client Implementation**
   - [ ] Create new method(s) in appropriate module (`src/api/modules/[module].ts`)
   - [ ] Define TypeScript interfaces for request/response
   - [ ] Handle pagination if applicable
   - [ ] Implement proper error handling

2. **MCP Tool Implementation**
   - [ ] Add tool definition to `src/mcp/tools.ts`
   - [ ] Create Zod schema with descriptive parameters
   - [ ] Implement handler in `src/mcp/handlers.ts`
   - [ ] Map API responses to user-friendly format

3. **Type Definitions**
   - [ ] Add interfaces to `src/api/types.ts` or module-specific types
   - [ ] Ensure all fields have proper TypeScript types
   - [ ] Document optional vs required fields

#### Non-Functional Requirements
1. **Authentication**
   - [ ] Verify required OAuth scopes
   - [ ] Handle token refresh automatically

2. **Rate Limiting**
   - [ ] Respect API rate limits (60 req/min)
   - [ ] Implement exponential backoff on 429 errors

3. **Error Handling**
   - [ ] Use appropriate custom error classes
   - [ ] Provide meaningful error messages
   - [ ] Handle network failures gracefully

4. **Validation**
   - [ ] Validate all inputs with Zod schemas
   - [ ] Sanitize data before API calls
   - [ ] Check response data integrity

### Implementation Steps

1. **API Module Development**
   ```typescript
   // Example structure for src/api/modules/[module].ts
   export class [Module]API {
     async [methodName](params: [ParamsType]): Promise<[ReturnType]> {
       // Implementation
     }
   }
   ```

2. **Type Definitions**
   ```typescript
   // Add to src/api/types.ts or create new interface
   export interface [EntityName] extends BaseEntity {
     // Fields
   }
   ```

3. **MCP Tool Creation**
   ```typescript
   // Add to tools array in src/mcp/tools.ts
   {
     name: "[tool_name]",
     description: "[Clear description]"
   }
   
   // Add to toolSchemas in src/mcp/tools.ts
   [tool_name]: z.object({
     // Schema definition
   })
   ```

4. **Handler Implementation**
   ```typescript
   // Add to handlers object in src/mcp/handlers.ts
   [tool_name]: async (args) => {
     // Handler logic
   }
   ```

### Testing Requirements

1. **Unit Tests**
   - [ ] Test successful API calls
   - [ ] Test error scenarios
   - [ ] Test input validation
   - [ ] Test response parsing

2. **Integration Tests**
   - [ ] Test MCP tool end-to-end
   - [ ] Test with real API (if possible)
   - [ ] Test rate limiting behavior

3. **Test Coverage**
   - [ ] Achieve minimum 80% coverage
   - [ ] Cover all error paths
   - [ ] Test edge cases

### Documentation Updates

1. **API Reference**
   - [ ] Add method documentation to `docs/API_REFERENCE.md`
   - [ ] Include code examples
   - [ ] Document parameters and returns

2. **MCP Tools Guide**
   - [ ] Add tool documentation to `docs/MCP_TOOLS.md`
   - [ ] Provide usage examples
   - [ ] List common use cases

3. **Code Documentation**
   - [ ] Add JSDoc comments to all public methods
   - [ ] Include @example sections
   - [ ] Document error conditions

### Validation Checklist

- [ ] Code compiles without TypeScript errors
- [ ] ESLint passes without warnings
- [ ] All tests pass
- [ ] Documentation is complete
- [ ] Error messages are user-friendly
- [ ] Follows established patterns
- [ ] No hardcoded values
- [ ] Handles all API response codes

### Acceptance Criteria

1. **Functionality**
   - [ ] Feature works as specified
   - [ ] Handles all specified use cases
   - [ ] Gracefully handles errors

2. **Code Quality**
   - [ ] Follows project conventions
   - [ ] No code duplication
   - [ ] Properly typed with TypeScript

3. **Documentation**
   - [ ] API docs updated
   - [ ] MCP docs updated
   - [ ] Examples provided

4. **Testing**
   - [ ] All tests pass
   - [ ] Coverage meets requirements
   - [ ] Manual testing completed

### Notes
[Any additional implementation notes, API quirks, or considerations]

---
*Generated from INITIAL.md on [date]*