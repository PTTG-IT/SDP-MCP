# Feature Request Template

Use this template to request new features or enhancements for the Service Desk Plus Cloud API integration.

## FEATURE:
[Describe the specific Service Desk Plus API feature or MCP tool you want to implement. Be clear about what functionality is needed and why.]

Example:
- Implement work log tracking for requests to record time spent on tickets
- Add MCP tools for creating and managing request templates
- Support for bulk operations on multiple requests

## EXAMPLES:
[Reference existing code patterns that should be followed]

- API Module Pattern: `src/api/modules/requests.ts`
- MCP Tool Pattern: `src/mcp/tools.ts` - see `create_request` tool
- Error Handling: `src/utils/errors.ts` - custom error classes
- Type Definitions: `src/api/types.ts` - interface patterns

## DOCUMENTATION:
[Include relevant API documentation and resources]

- Service Desk Plus API Docs: https://www.manageengine.com/products/service-desk/sdpod-v3-api/
- Specific endpoint documentation: [URL to specific API section]
- OAuth Scopes needed: [List required scopes]
- MCP Protocol docs: https://modelcontextprotocol.io/

## OTHER CONSIDERATIONS:
[Important factors to consider during implementation]

- **Rate Limiting**: Current limit is 60 requests/minute
- **Authentication**: Uses OAuth 2.0 with automatic token refresh
- **Pagination**: API returns max 100 items per page
- **Field Validation**: Service Desk Plus has specific field requirements
- **Error Scenarios**: Consider network failures, invalid data, permission errors
- **Testing Requirements**: Unit tests for API methods, integration tests for MCP tools
- **Backwards Compatibility**: Ensure changes don't break existing functionality

## ACCEPTANCE CRITERIA:
[Optional: Define specific criteria for the feature to be considered complete]

- [ ] API client method implemented with proper types
- [ ] MCP tool created with Zod schema validation  
- [ ] Error handling covers all failure scenarios
- [ ] Unit tests achieve 80%+ coverage
- [ ] Documentation updated in API_REFERENCE.md and MCP_TOOLS.md
- [ ] Integration tested with Claude Desktop

---

*Remove this instruction text and fill in the sections above when creating a feature request*