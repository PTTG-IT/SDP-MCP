# TypeScript Compilation Fix Plan

## Problem Summary
The project has 482 TypeScript compilation errors preventing normal build and development workflow. This blocks OAuth setup, testing, and deployment.

## Root Causes
1. **Strict TypeScript Configuration**: The project uses strict mode with all checks enabled
2. **Import/Export Mismatches**: ESM modules with .js extensions in TypeScript
3. **Unused Imports**: Many files have imports that aren't used
4. **Type Mismatches**: Incompatible types between expected and actual values
5. **Missing Type Definitions**: Some third-party libraries lack proper types

## Phase 1: Immediate Fixes (Priority: Critical)

### 1.1 Create Build Workarounds
- [ ] Create `tsconfig.build.json` with relaxed settings for quick builds
- [ ] Add npm scripts for development vs production builds
- [ ] Create JavaScript fallback scripts for critical operations

### 1.2 Essential Scripts
- [ ] OAuth setup script (pure JavaScript) ✅ Already created
- [ ] Database migration script (JavaScript)
- [ ] Server start script (JavaScript wrapper)
- [ ] Health check script (JavaScript)

## Phase 2: Systematic Error Resolution (Priority: High)

### 2.1 Import/Export Fixes
- [ ] Configure TypeScript for proper ESM support
- [ ] Update all imports to use correct extensions
- [ ] Fix circular dependencies
- [ ] Remove unused imports across all files

### 2.2 Type Definition Updates
- [ ] Install missing @types packages
- [ ] Create custom type definitions for untyped libraries
- [ ] Fix type mismatches in function signatures
- [ ] Update generic type parameters

### 2.3 Code Structure Fixes
- [ ] Remove unreachable code
- [ ] Fix async/await usage
- [ ] Resolve promise handling issues
- [ ] Update error handling patterns

## Phase 3: Long-term Solutions (Priority: Medium)

### 3.1 Development Workflow
```json
// tsconfig.dev.json - Relaxed for development
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": false,
    "skipLibCheck": true
  }
}
```

### 3.2 Incremental Migration Strategy
1. **Module by Module**:
   - Fix one module completely before moving to next
   - Start with core modules (auth, database, config)
   - Move to API modules
   - Finally fix MCP tools

2. **Test Coverage**:
   - Add tests as modules are fixed
   - Ensure no regression
   - Use tests to validate fixes

### 3.3 CI/CD Integration
- [ ] Add pre-commit hooks for TypeScript checks
- [ ] Set up GitHub Actions for continuous type checking
- [ ] Create staged builds (dev → staging → production)

## Phase 4: Prevention Measures

### 4.1 Development Standards
- [ ] Create coding standards document
- [ ] Set up ESLint with TypeScript rules
- [ ] Configure Prettier for consistent formatting
- [ ] Add code review checklist

### 4.2 Tooling Improvements
- [ ] Set up VS Code workspace settings
- [ ] Create code snippets for common patterns
- [ ] Add problem matchers for better error reporting
- [ ] Configure auto-fix on save

### 4.3 Documentation
- [ ] Document type patterns used in project
- [ ] Create examples for common scenarios
- [ ] Maintain changelog of type system changes

## Implementation Timeline

### Week 1: Critical Path
- Day 1-2: Create all JavaScript fallback scripts
- Day 3-4: Fix authentication and database modules
- Day 5: Test core functionality with fallbacks

### Week 2: Core Modules
- Day 1-2: Fix type definitions and imports
- Day 3-4: Resolve API client modules
- Day 5: Integration testing

### Week 3: MCP Tools
- Day 1-3: Fix MCP tool implementations
- Day 4-5: Update tool schemas and handlers

### Week 4: Polish
- Day 1-2: Complete remaining fixes
- Day 3: Update documentation
- Day 4-5: Final testing and deployment prep

## Quick Start Commands

```bash
# For immediate use (bypasses TypeScript)
npm run start:js         # Start server with JavaScript
npm run oauth:setup:js   # Setup OAuth without building
npm run db:migrate:js    # Run migrations without building

# For development (relaxed TypeScript)
npm run dev              # Start with nodemon and ts-node
npm run build:dev        # Build with relaxed settings

# For testing fixes
npm run typecheck        # Check types without building
npm run lint:fix         # Auto-fix what's possible
```

## Success Metrics
- [ ] Zero TypeScript errors in production build
- [ ] All tests passing
- [ ] OAuth setup working through npm scripts
- [ ] MCP server starting successfully
- [ ] Development workflow < 5 seconds for changes

## Notes
- Priority is getting OAuth working first
- Use JavaScript escapes where needed
- Fix TypeScript incrementally
- Don't let perfect be enemy of good