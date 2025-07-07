# /generate-prp

Generate a Product Requirements Prompt (PRP) for Service Desk Plus Cloud API features.

## Usage
```
/generate-prp
```

## Description
Transforms an INITIAL.md feature request into a comprehensive PRP (Product Requirements Prompt) that:
- Defines clear acceptance criteria
- Specifies API endpoints and MCP tools to implement
- Includes validation and testing requirements
- Considers rate limiting and authentication
- Provides implementation guidelines

## Process
1. Read the INITIAL.md file to understand the feature request
2. Analyze existing code patterns in src/api/modules/ and src/mcp/
3. Generate a detailed PRP following the template in PRPs/templates/prp_base.md
4. Save the PRP with a descriptive filename in the PRPs/ directory
5. Provide guidance on executing the PRP

## Output
- A complete PRP file in PRPs/ directory
- Summary of the requirements
- Next steps for implementation