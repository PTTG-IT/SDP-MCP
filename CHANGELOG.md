# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-05

### Added
- Comprehensive tool status documentation (CURRENT_TOOL_STATUS.md)
- Tool status summary prominently displayed in README  
- Detailed status tracking for all 32 MCP tools

### Fixed
- **Users API (Major Fix)**: Resolved 404 errors by splitting into requesters/technicians
  - Created separate `RequestersAPI` and `TechniciansAPI` modules
  - Updated SDPClient to use new modules instead of generic users
  - Enhanced MCP handlers to search both user types
  - Unified response format with `user_type` field
- **get_technicians lookup**: Now uses direct technicians.list() API instead of broken lookup endpoint

### Changed
- Updated README with accurate module status and tool counts
- Improved documentation structure with clear status indicators
- Removed generic users module in favor of requesters/technicians split

### Documentation
- Created USERS_API_FIX.md with detailed explanation and examples
- Updated NON_FUNCTIONAL_TOOLS_REPORT.md marking user tools as fixed
- Added CURRENT_TOOL_STATUS.md for quick tool status reference
- Updated exports to include new requesters/technicians modules

## [1.0.0] - 2025-01-05

### Added
- Initial release of Service Desk Plus Cloud API MCP Server
- OAuth 2.0 authentication with automatic token refresh
- Comprehensive API client for Service Desk Plus Cloud
- MCP server implementation for AI assistant integration
- Request management API (create, update, list, search, close)
- User management API (get, search, list)
- **Project management API with full implementation:**
  - Create, update, get, and list projects
  - Task management (create, update, complete, list)
  - Milestone management
  - Time tracking with worklog entries
  - Project summary with statistics
- **11 new MCP tools for project management:**
  - create_project, update_project, get_project, list_projects
  - create_task, update_task, complete_task, list_project_tasks
  - add_worklog, create_milestone, get_project_summary
- **Field lookup system with caching (Phase 2.1):**
  - Comprehensive lookup API for priorities, categories, statuses, technicians, etc.
  - 5-minute cache for performance optimization
  - Dynamic ID lookup by name functionality
  - Field mapper utility for automatic name-to-ID conversion
- **6 new MCP lookup tools:**
  - get_priorities, get_categories, get_statuses
  - get_technicians, get_request_types, get_subcategories
- **Date utility functions:**
  - ISO to SDPDate format conversion (epoch milliseconds)
  - Support for nested date fields
  - Helper functions for date operations
- **Enhanced create_request handler:**
  - Accepts both names and IDs for field values
  - Automatic field mapping with helpful error messages
  - Proper date format conversion
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
- Lookup tools require SDPOnDemand.setup.READ scope for authentication
- Assets module not implemented (API exists, implementation pending)
- Problems/Changes modules may not be available in Cloud API
- Project task list returns EXTRA_PARAM_FOUND with pagination parameters
- Several project task tools untested (create_task, update_task, etc.)