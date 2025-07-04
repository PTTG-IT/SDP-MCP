# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Service Desk Plus Cloud API MCP Server
- OAuth 2.0 authentication with automatic token refresh
- Comprehensive API client for Service Desk Plus Cloud
- MCP server implementation for AI assistant integration
- Request management API (create, update, list, search, close)
- User management API (get, search, list)
- Asset management API stubs (to be implemented)
- Problem and Change management API stubs (to be implemented)
- TypeScript support with full type definitions
- Automatic rate limiting with exponential backoff
- Error handling with custom error classes
- Input validation using Zod schemas
- Pre-commit hooks for security
- Comprehensive documentation

### Security
- Implemented credential sanitization in error messages
- Added pre-commit hook to prevent credential commits
- Environment variable based configuration
- HTTPS enforcement for all API calls

### Fixed
- Corrected OAuth endpoint to use Zoho's central server
- Fixed field naming (email_id vs email)
- Fixed request closing process with proper technician assignment
- Fixed required fields for request creation

### Known Issues
- Search endpoint not available in SDP API (using client-side filtering)
- Asset, Problem, and Change APIs not yet implemented
- Close endpoint may not work as expected (use update with status instead)

## [1.0.0] - TBD

- Initial public release