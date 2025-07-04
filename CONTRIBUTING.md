# Contributing to Service Desk Plus MCP Server

Thank you for considering contributing to this project! We welcome contributions from the community.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### 1. Reporting Issues

- Check if the issue already exists in the [Issues](https://github.com/TenKTech/service-desk-plus-mcp/issues) section
- Provide a clear description of the problem
- Include steps to reproduce the issue
- Share relevant error messages and logs
- Mention your environment (OS, Node.js version, etc.)

### 2. Suggesting Features

- Open a feature request in [Issues](https://github.com/TenKTech/service-desk-plus-mcp/issues)
- Describe the use case and benefits
- Provide examples if possible
- Be open to discussion and feedback

### 3. Submitting Code

#### Prerequisites

- Node.js 18 or later
- Git
- TypeScript knowledge
- Familiarity with Service Desk Plus API

#### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/service-desk-plus-mcp.git
   cd service-desk-plus-mcp
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. Set up your `.env` file with test credentials

#### Development Workflow

1. **Write Tests First**: Add tests for any new functionality
2. **Follow TypeScript Best Practices**: Use proper types, avoid `any`
3. **Run Tests**: Ensure all tests pass with `npm test`
4. **Lint Your Code**: Run `npm run lint` and fix any issues
5. **Format Code**: Run `npm run format`
6. **Build**: Ensure `npm run build` succeeds

#### Commit Guidelines

We follow conventional commits format:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

Example:
```
feat: add support for bulk ticket creation

- Implement batch API for creating multiple tickets
- Add validation for bulk operations
- Update documentation with examples
```

#### Pull Request Process

1. Update documentation for any new features
2. Add tests for your changes
3. Ensure all tests pass
4. Update CHANGELOG.md with your changes
5. Submit a pull request with:
   - Clear title describing the change
   - Description of what was changed and why
   - Link to related issue (if applicable)
   - Screenshots (if UI changes)

### 4. Adding New API Modules

When adding support for new Service Desk Plus APIs:

1. Create the module in `src/api/modules/`
2. Add types to `src/api/types.ts` or create module-specific types
3. Implement corresponding MCP tools in `src/mcp/`
4. Add comprehensive tests
5. Update API documentation in `docs/API_REFERENCE.md`
6. Update MCP tools documentation in `docs/MCP_TOOLS.md`

Example structure:
```typescript
// src/api/modules/tasks.ts
export class TasksAPI {
  constructor(private axios: AxiosInstance) {}
  
  async create(data: CreateTaskInput): Promise<Task> {
    // Implementation
  }
  
  async get(id: string): Promise<Task> {
    // Implementation
  }
  
  // ... other methods
}
```

### 5. Testing Guidelines

- Write unit tests for all new functions
- Include integration tests for API endpoints
- Test error scenarios
- Mock external API calls in tests
- Aim for >80% code coverage

### 6. Documentation Standards

- Use JSDoc comments for all public APIs
- Include usage examples
- Document error scenarios
- Keep README.md updated
- Update troubleshooting guide for common issues

## Development Tips

### Understanding the Codebase

- Start by reading `ARCHITECTURE.md`
- Review `PLANNING.md` for design decisions
- Check `CLAUDE.md` for AI-assisted development guidelines
- Explore existing modules for patterns

### Common Tasks

#### Adding a New MCP Tool

1. Define the tool in `src/mcp/tools.ts`
2. Add Zod schema for validation
3. Implement handler in `src/mcp/handlers.ts`
4. Add tests
5. Document in `docs/MCP_TOOLS.md`

#### Debugging

- Use `MCP_LOG_LEVEL=debug` for verbose logging
- Check Service Desk Plus API docs for field requirements
- Test with the example scripts in the root directory

## Questions?

If you have questions:

1. Check existing documentation
2. Search closed issues
3. Ask in an issue or discussion
4. Reach out to maintainers

## Recognition

Contributors will be recognized in:
- CHANGELOG.md for their specific contributions
- README.md contributors section (for significant contributions)
- Release notes

Thank you for helping improve Service Desk Plus MCP Server!