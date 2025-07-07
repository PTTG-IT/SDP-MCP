/**
 * Service Desk Plus TypeScript Types
 * 
 * This file exports all TypeScript types for the SDP API
 */

// Re-export all types from schemas (Zod inferred types)
export type {
  // Common types
  ResponseStatus,
  PageInfo,
  // Request types
  Request,
  CreateRequestParams,
  UpdateRequestParams,
  CloseRequestParams,
  PickupRequestParams,
  ListRequestParams,
  RequestListResponse,
  RequestStatistics,
  RequestNote,
  RequestTimeEntry,
  RequestResolution,
} from '../schemas/requests.js';

export type {
  // Problem types
  Problem,
  CreateProblemParams,
  UpdateProblemParams,
  ProblemAnalysisParams,
  ProblemResolutionParams,
  ListProblemParams,
  ProblemListResponse,
  ProblemStatistics,
  ProblemAssociation,
  KnownError,
} from '../schemas/problems.js';

export type {
  // Change types
  Change,
  CreateChangeParams,
  UpdateChangeParams,
  ChangeApprovalParams,
  ImplementChangeParams,
  CompleteChangeParams,
  ListChangeParams,
  ChangeListResponse,
  ChangeStatistics,
  ChangeImpactAssessment,
  CABMeeting,
} from '../schemas/changes.js';

export type {
  // Project types
  Project,
  Milestone,
  Task,
  CreateProjectParams,
  UpdateProjectParams,
  CreateMilestoneParams,
  CreateTaskParams,
  UpdateTaskParams,
  AddProjectMemberParams,
  ListProjectParams,
  ProjectListResponse,
  ProjectStatistics,
  ProjectHealth,
} from '../schemas/projects.js';

export type {
  // Asset types
  Asset,
  ComputerAsset,
  CreateAssetParams,
  UpdateAssetParams,
  AssetScanParams,
  AssetRelationshipParams,
  ListAssetParams,
  AssetListResponse,
  ComputerAssetListResponse,
  AssetStatistics,
  AssetDepreciation,
  AssetMaintenance,
} from '../schemas/assets.js';

// Export enums from modules
export {
  RequestStatus,
  RequestPriority,
  RequestUrgency,
  RequestImpact,
} from '../modules/requests.js';

export {
  ProblemStatus,
  ProblemPriority,
  ProblemImpact,
} from '../modules/problems.js';

export {
  ChangeStatus,
  ChangeType,
  ChangePriority,
  ChangeRisk,
  ChangeImpact,
} from '../modules/changes.js';

export {
  ProjectStatus,
  ProjectPriority,
  MilestoneStatus,
  TaskStatus,
  TaskPriority,
} from '../modules/projects.js';

export {
  AssetState,
  AssetTypeCategory,
  AssetCriticality,
} from '../modules/assets.js';

/**
 * Common types used across modules
 */
export interface SDPEntity {
  id: string;
  created_time?: string;
  updated_time?: string;
}

export interface SDPUser {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface SDPReference {
  id?: string;
  name?: string;
}

export interface SDPListParams {
  page?: number;
  page_size?: number;
  search_fields?: Record<string, string>;
  filter_by?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  include_details?: boolean;
}

export interface SDPListResponse<T> {
  data: T[];
  response_status: {
    status_code: number;
    status: string;
  };
  page_info?: {
    page: number;
    page_size: number;
    total_count: number;
    has_more_rows: boolean;
  };
}

export interface SDPError {
  code: string;
  message: string;
  details?: any;
}

/**
 * API client types
 */
export interface SDPClientConfig {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
  enableCache?: boolean;
  enableCircuitBreaker?: boolean;
}

export interface SDPResponse<T = any> {
  response_status: {
    status_code: number;
    status: 'success' | 'failure';
    messages?: Array<{
      status_code: number;
      message: string;
      type: string;
    }>;
  };
  [key: string]: T | any;
}

/**
 * Module API interfaces
 */
export interface IRequestsAPI {
  create(params: CreateRequestParams): Promise<Request>;
  get(id: string): Promise<Request>;
  update(id: string, params: UpdateRequestParams): Promise<Request>;
  delete(id: string): Promise<void>;
  list(params?: ListRequestParams): Promise<RequestListResponse>;
  close(id: string, params?: CloseRequestParams): Promise<Request>;
  pickup(id: string, params?: PickupRequestParams): Promise<Request>;
  search(criteria: Record<string, any>): Promise<RequestListResponse>;
  getStatistics(): Promise<RequestStatistics>;
}

export interface IProblemsAPI {
  create(params: CreateProblemParams): Promise<Problem>;
  get(id: string): Promise<Problem>;
  update(id: string, params: UpdateProblemParams): Promise<Problem>;
  delete(id: string): Promise<void>;
  list(params?: ListProblemParams): Promise<ProblemListResponse>;
  analyze(id: string, params: ProblemAnalysisParams): Promise<Problem>;
  resolve(id: string, params: ProblemResolutionParams): Promise<Problem>;
  close(id: string): Promise<Problem>;
  getStatistics(): Promise<ProblemStatistics>;
}

export interface IChangesAPI {
  create(params: CreateChangeParams): Promise<Change>;
  get(id: string): Promise<Change>;
  update(id: string, params: UpdateChangeParams): Promise<Change>;
  delete(id: string): Promise<void>;
  list(params?: ListChangeParams): Promise<ChangeListResponse>;
  approve(id: string, params?: ChangeApprovalParams): Promise<void>;
  reject(id: string, params?: ChangeApprovalParams): Promise<void>;
  startImplementation(id: string, params?: ImplementChangeParams): Promise<Change>;
  complete(id: string, params?: CompleteChangeParams): Promise<Change>;
  close(id: string): Promise<Change>;
  cancel(id: string, reason: string): Promise<Change>;
  getStatistics(): Promise<ChangeStatistics>;
}

export interface IProjectsAPI {
  create(params: CreateProjectParams): Promise<Project>;
  get(id: string): Promise<Project>;
  update(id: string, params: UpdateProjectParams): Promise<Project>;
  delete(id: string): Promise<void>;
  list(params?: ListProjectParams): Promise<ProjectListResponse>;
  getMilestones(projectId: string): Promise<Milestone[]>;
  createMilestone(projectId: string, params: CreateMilestoneParams): Promise<Milestone>;
  getTasks(projectId: string, milestoneId: string): Promise<Task[]>;
  createTask(projectId: string, milestoneId: string, params: CreateTaskParams): Promise<Task>;
  complete(id: string): Promise<Project>;
  cancel(id: string, reason?: string): Promise<Project>;
  getStatistics(): Promise<ProjectStatistics>;
}

export interface IAssetsAPI {
  create(params: CreateAssetParams): Promise<Asset>;
  get(id: string): Promise<Asset>;
  update(id: string, params: UpdateAssetParams): Promise<Asset>;
  delete(id: string): Promise<void>;
  list(params?: ListAssetParams): Promise<AssetListResponse>;
  listComputers(params?: ListAssetParams): Promise<ComputerAssetListResponse>;
  assign(assetId: string, userId: string): Promise<Asset>;
  unassign(assetId: string): Promise<Asset>;
  scan(params?: AssetScanParams): Promise<{ scan_id: string }>;
  dispose(id: string, reason?: string): Promise<Asset>;
  getStatistics(): Promise<AssetStatistics>;
}