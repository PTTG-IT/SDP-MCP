/**
 * Main exports for the Service Desk Plus MCP library
 */

// API Clients
export { SDPClient } from './api/client.js';
export { OptimizedSDPClient } from './api/optimizedClient.js';

// API Modules
export { RequestsAPI } from './api/modules/requests.js';
export { ProjectsAPI } from './api/modules/projects.js';
export { RequestersAPI } from './api/modules/requesters.js';
export { TechniciansAPI } from './api/modules/technicians.js';
export { AssetsAPI } from './api/modules/assets.js';
export { ProblemsAPI } from './api/modules/problems.js';
export { ChangesAPI } from './api/modules/changes.js';

// Authentication
export { AuthManager } from './api/auth.js';

// Rate Limiting
export { RateLimiter, ExponentialBackoff } from './utils/rateLimit.js';
export { EnhancedRateLimiter, RequestQueue } from './utils/enhancedRateLimit.js';
export { TimeTrackedRateLimiter } from './utils/timeTrackedRateLimit.js';
export { RateLimitMonitor, createRateLimitMiddleware } from './utils/rateLimitMonitor.js';

// Error Handling
export {
  SDPError,
  SDPAuthError,
  SDPRateLimitError,
  SDPValidationError,
  SDPNotFoundError,
  SDPPermissionError,
  formatSDPError
} from './utils/errors.js';

// Configuration
export { loadConfig, SDPConfig } from './utils/config.js';

// Types
export type {
  Request,
  CreateRequestInput,
  UpdateRequestInput,
  CloseRequestInput
} from './api/types/requests.js';

export type {
  Project,
  Task,
  Milestone,
  Worklog,
  CreateProjectInput,
  CreateTaskInput,
  CreateWorklogInput
} from './api/types/projects.js';

export type {
  User,
  Technician,
  Department,
  Site,
  Category,
  SubCategory,
  Priority,
  Status,
  BaseEntity,
  ListOptions,
  ListResponse,
  SDPResponse,
  SDPListResponse,
  SDPDate
} from './api/types.js';

// MCP Tools
export { tools, toolSchemas } from './mcp/tools.js';
export { createToolHandler } from './mcp/handlers.js';