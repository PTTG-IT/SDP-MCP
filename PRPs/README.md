# Product Requirements Prompts (PRPs)

This directory contains Product Requirements Prompts for Service Desk Plus Cloud API features.

## What is a PRP?

A Product Requirements Prompt (PRP) is a detailed specification document that:
- Defines exact requirements for a feature
- Provides implementation guidelines
- Specifies testing requirements
- Lists acceptance criteria
- Ensures consistent implementation

## Directory Structure

```
PRPs/
├── templates/
│   └── prp_base.md      # Base template for new PRPs
├── README.md            # This file
└── [feature-name].md    # Generated PRPs for specific features
```

## Creating a PRP

1. **Write Feature Request**: Create or update `INITIAL.md` with your feature request
2. **Generate PRP**: Use the `/generate-prp` command
3. **Review PRP**: Check the generated PRP for completeness
4. **Execute PRP**: Use `/execute-prp [filename]` to implement

## PRP Workflow

```
INITIAL.md → /generate-prp → PRP Document → /execute-prp → Implementation
```

## Example PRPs

As PRPs are generated, they will be stored here with descriptive names:
- `work-logs-api.md` - Work log tracking for requests
- `bulk-operations.md` - Bulk create/update operations  
- `request-templates.md` - Request template management
- `sla-management.md` - SLA tracking and reporting

## Best Practices

1. **Be Specific**: Include exact API endpoints and parameters
2. **Consider Edge Cases**: Think about error scenarios
3. **Follow Patterns**: Reference existing code patterns
4. **Test Thoroughly**: Define comprehensive test cases
5. **Document Well**: Include clear examples

## PRP Sections

Each PRP includes:
- **Overview**: Feature description and purpose
- **Requirements**: Functional and non-functional requirements
- **Implementation Steps**: Code structure and examples
- **Testing Requirements**: Unit and integration tests
- **Documentation Updates**: What docs need updating
- **Validation Checklist**: Pre-implementation checks
- **Acceptance Criteria**: Definition of done

## Executing PRPs

When executing a PRP:
1. Read the entire PRP first
2. Implement incrementally
3. Test as you go
4. Update documentation
5. Mark tasks complete in TASK.md

## Tips for Success

- Always check existing patterns in `src/api/modules/`
- Maintain consistent error handling
- Keep MCP tools user-friendly
- Write comprehensive tests
- Update both API and MCP documentation