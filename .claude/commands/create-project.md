# /create-project

Create a new project with full context engineering setup, following the Service Desk Plus Cloud API project template.

## Usage
```
/create-project <project-name> <description>
```

## Description
Creates a complete project structure with:
- Context engineering files (CLAUDE.md, PLANNING.md, TASK.md, INITIAL.md)
- .claude directory with commands and settings
- PRPs directory for Product Requirements Prompts
- Appropriate technology stack setup (TypeScript, Node.js, etc.)
- MCP server structure if applicable
- Full documentation templates

## Process
1. Create project directory structure
2. Set up context engineering files:
   - CLAUDE.md with AI guidelines
   - PLANNING.md with architecture
   - TASK.md for task tracking
   - INITIAL.md for feature requests
3. Create .claude directory:
   - Custom commands (generate-prp, execute-prp)
   - Permission settings
4. Set up PRPs directory with templates
5. Create technology-specific files:
   - package.json (for Node.js projects)
   - tsconfig.json (for TypeScript projects)
   - Configuration files
6. Generate comprehensive README.md
7. Create documentation structure
8. Set up testing framework

## Parameters
- `project-name`: Name of the project (kebab-case)
- `description`: Brief description of what the project does

## Example
```
/create-project customer-portal-api "API for customer self-service portal with authentication and order management"
```

## Output
- Complete project directory with all context engineering files
- Technology-specific setup based on project type
- Ready-to-use development environment
- Summary of created structure and next steps