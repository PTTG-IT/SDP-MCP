import { SDPClient } from '../client.js';
import { SDPValidationError } from '../../utils/errors.js';
import { logger } from '../../monitoring/logging.js';
import { cacheable, createCacheInvalidator } from '../../utils/cache.js';

/**
 * Change status types
 */
export enum ChangeStatus {
  REQUESTED = 'Requested',
  PLANNING = 'Planning',
  AWAITING_APPROVAL = 'Awaiting Approval',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CLOSED = 'Closed',
  CANCELLED = 'Cancelled',
}

/**
 * Change type
 */
export enum ChangeType {
  MINOR = 'Minor',
  STANDARD = 'Standard',
  MAJOR = 'Major',
  EMERGENCY = 'Emergency',
}

/**
 * Change priority
 */
export enum ChangePriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

/**
 * Change risk
 */
export enum ChangeRisk {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  VERY_HIGH = 'Very High',
}

/**
 * Change impact
 */
export enum ChangeImpact {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  ENTERPRISE = 'Enterprise',
}

/**
 * Change interface
 */
export interface Change {
  id: string;
  title: string;
  description?: string;
  status?: {
    id?: string;
    name?: string;
  };
  type?: {
    id?: string;
    name?: string;
  };
  priority?: {
    id?: string;
    name?: string;
  };
  risk?: {
    id?: string;
    name?: string;
  };
  impact?: {
    id?: string;
    name?: string;
  };
  urgency?: {
    id?: string;
    name?: string;
  };
  category?: {
    id?: string;
    name?: string;
  };
  subcategory?: {
    id?: string;
    name?: string;
  };
  item?: {
    id?: string;
    name?: string;
  };
  change_requester?: {
    id?: string;
    name?: string;
    email?: string;
  };
  change_owner?: {
    id?: string;
    name?: string;
    email?: string;
  };
  change_manager?: {
    id?: string;
    name?: string;
    email?: string;
  };
  group?: {
    id?: string;
    name?: string;
  };
  site?: {
    id?: string;
    name?: string;
  };
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  created_time?: string;
  updated_time?: string;
  completed_time?: string;
  closed_time?: string;
  reason_for_change?: string;
  impact_details?: string;
  rollout_plan?: string;
  backout_plan?: string;
  checklist?: Array<{
    id: string;
    item: string;
    completed: boolean;
  }>;
  approval_status?: {
    id?: string;
    name?: string;
  };
  approvals?: Array<{
    id: string;
    approver: {
      id: string;
      name: string;
    };
    status: string;
    comments?: string;
    approved_time?: string;
  }>;
  associated_problems?: Array<{
    id: string;
    title: string;
  }>;
  associated_assets?: Array<{
    id: string;
    name: string;
  }>;
  udf_fields?: Record<string, any>;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
  }>;
}

/**
 * Change creation parameters
 */
export interface CreateChangeParams {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  risk?: string;
  impact?: string;
  urgency?: string;
  category?: { id: string } | { name: string };
  subcategory?: { id: string } | { name: string };
  item?: { id: string } | { name: string };
  change_requester?: { id: string } | { email: string };
  change_owner?: { id: string } | { email: string };
  change_manager?: { id: string } | { email: string };
  group?: { id: string } | { name: string };
  site?: { id: string } | { name: string };
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  reason_for_change?: string;
  impact_details?: string;
  rollout_plan?: string;
  backout_plan?: string;
  udf_fields?: Record<string, any>;
}

/**
 * Change update parameters
 */
export interface UpdateChangeParams extends Partial<CreateChangeParams> {
  status?: string;
  actual_start_time?: string;
  actual_end_time?: string;
}

/**
 * Change list parameters
 */
export interface ListChangeParams {
  page?: number;
  page_size?: number;
  search_fields?: Record<string, string>;
  filter_by?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  include_details?: boolean;
}

/**
 * Change approval parameters
 */
export interface ChangeApprovalParams {
  comments?: string;
  approval_level?: string;
}

/**
 * Change implementation parameters
 */
export interface ImplementChangeParams {
  implementation_comments?: string;
  actual_start_time?: string;
}

/**
 * Change completion parameters
 */
export interface CompleteChangeParams {
  completion_comments?: string;
  actual_end_time?: string;
  implementation_success?: boolean;
}

/**
 * Change list response
 */
export interface ChangeListResponse {
  changes: Change[];
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

/**
 * Service Desk Plus Changes API Module
 */
export class ChangesAPI {
  private readonly client: SDPClient;
  private readonly cacheInvalidator = createCacheInvalidator('changes');

  constructor(client: SDPClient) {
    this.client = client;
  }

  /**
   * Create a new change
   */
  async create(params: CreateChangeParams): Promise<Change> {
    logger.info('Creating change', { title: params.title });

    // Validate required fields
    if (!params.title) {
      throw new SDPValidationError('Title is required', 'title');
    }

    // Format change data
    const changeData = {
      change: {
        title: params.title,
        description: params.description,
        type: params.type ? { name: params.type } : undefined,
        priority: params.priority ? { name: params.priority } : undefined,
        risk: params.risk ? { name: params.risk } : undefined,
        impact: params.impact ? { name: params.impact } : undefined,
        urgency: params.urgency ? { name: params.urgency } : undefined,
        category: params.category,
        subcategory: params.subcategory,
        item: params.item,
        change_requester: params.change_requester,
        change_owner: params.change_owner,
        change_manager: params.change_manager,
        group: params.group,
        site: params.site,
        scheduled_start_time: params.scheduled_start_time,
        scheduled_end_time: params.scheduled_end_time,
        reason_for_change: params.reason_for_change,
        impact_details: params.impact_details,
        rollout_plan: params.rollout_plan,
        backout_plan: params.backout_plan,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.post<{ change: Change }>(
      '/api/v3/changes',
      changeData
    );

    // Invalidate list cache
    await this.cacheInvalidator.invalidateOperation('list');

    return response.change;
  }

  /**
   * Get change by ID
   */
  @cacheable('changes', 'get')
  async get(id: string): Promise<Change> {
    logger.info('Getting change', { id });

    const response = await this.client.get<{ change: Change }>(
      `/api/v3/changes/${id}`
    );

    return response.change;
  }

  /**
   * Update a change
   */
  async update(id: string, params: UpdateChangeParams): Promise<Change> {
    logger.info('Updating change', { id, params });

    // Format update data
    const changeData = {
      change: {
        title: params.title,
        description: params.description,
        status: params.status ? { name: params.status } : undefined,
        type: params.type ? { name: params.type } : undefined,
        priority: params.priority ? { name: params.priority } : undefined,
        risk: params.risk ? { name: params.risk } : undefined,
        impact: params.impact ? { name: params.impact } : undefined,
        urgency: params.urgency ? { name: params.urgency } : undefined,
        category: params.category,
        subcategory: params.subcategory,
        item: params.item,
        change_requester: params.change_requester,
        change_owner: params.change_owner,
        change_manager: params.change_manager,
        group: params.group,
        site: params.site,
        scheduled_start_time: params.scheduled_start_time,
        scheduled_end_time: params.scheduled_end_time,
        actual_start_time: params.actual_start_time,
        actual_end_time: params.actual_end_time,
        reason_for_change: params.reason_for_change,
        impact_details: params.impact_details,
        rollout_plan: params.rollout_plan,
        backout_plan: params.backout_plan,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.put<{ change: Change }>(
      `/api/v3/changes/${id}`,
      changeData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');

    return response.change;
  }

  /**
   * Delete a change
   */
  async delete(id: string): Promise<void> {
    logger.info('Deleting change', { id });

    await this.client.delete(`/api/v3/changes/${id}`);

    // Invalidate caches
    await this.cacheInvalidator.invalidateAll();
  }

  /**
   * List changes
   */
  @cacheable('changes', 'list')
  async list(params: ListChangeParams = {}): Promise<ChangeListResponse> {
    logger.info('Listing changes', { params });

    // Build query parameters
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 100,
    };

    if (params.search_fields) {
      queryParams.search_fields = JSON.stringify(params.search_fields);
    }

    if (params.filter_by) {
      queryParams.filter_by = params.filter_by;
    }

    if (params.sort_field) {
      queryParams.sort_field = params.sort_field;
      queryParams.sort_order = params.sort_order || 'asc';
    }

    if (params.include_details) {
      queryParams.include_details = true;
    }

    const response = await this.client.get<ChangeListResponse>(
      '/api/v3/changes',
      { params: queryParams }
    );

    return response;
  }

  /**
   * Submit change for approval
   */
  async submitForApproval(id: string): Promise<Change> {
    logger.info('Submitting change for approval', { id });

    return this.update(id, { status: ChangeStatus.AWAITING_APPROVAL });
  }

  /**
   * Approve a change
   */
  async approve(id: string, params: ChangeApprovalParams = {}): Promise<void> {
    logger.info('Approving change', { id, params });

    await this.client.post(
      `/api/v3/changes/${id}/approve`,
      {
        approval: {
          comments: params.comments,
          level: params.approval_level,
        },
      }
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');
  }

  /**
   * Reject a change
   */
  async reject(id: string, params: ChangeApprovalParams = {}): Promise<void> {
    logger.info('Rejecting change', { id, params });

    await this.client.post(
      `/api/v3/changes/${id}/reject`,
      {
        approval: {
          comments: params.comments,
          level: params.approval_level,
        },
      }
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');
  }

  /**
   * Start change implementation
   */
  async startImplementation(id: string, params: ImplementChangeParams = {}): Promise<Change> {
    logger.info('Starting change implementation', { id, params });

    return this.update(id, {
      status: ChangeStatus.IN_PROGRESS,
      actual_start_time: params.actual_start_time || new Date().toISOString(),
    });
  }

  /**
   * Complete change implementation
   */
  async complete(id: string, params: CompleteChangeParams = {}): Promise<Change> {
    logger.info('Completing change', { id, params });

    return this.update(id, {
      status: ChangeStatus.COMPLETED,
      actual_end_time: params.actual_end_time || new Date().toISOString(),
    });
  }

  /**
   * Close a change
   */
  async close(id: string): Promise<Change> {
    logger.info('Closing change', { id });

    return this.update(id, { status: ChangeStatus.CLOSED });
  }

  /**
   * Cancel a change
   */
  async cancel(id: string, reason: string): Promise<Change> {
    logger.info('Cancelling change', { id, reason });

    return this.update(id, {
      status: ChangeStatus.CANCELLED,
      udf_fields: { cancellation_reason: reason },
    });
  }

  /**
   * Associate problem with change
   */
  async associateProblem(changeId: string, problemId: string): Promise<void> {
    logger.info('Associating problem with change', { changeId, problemId });

    await this.client.post(
      `/api/v3/changes/${changeId}/associate_problem`,
      { problem: { id: problemId } }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Associate asset with change
   */
  async associateAsset(changeId: string, assetId: string): Promise<void> {
    logger.info('Associating asset with change', { changeId, assetId });

    await this.client.post(
      `/api/v3/changes/${changeId}/associate_asset`,
      { asset: { id: assetId } }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Search changes
   */
  async search(criteria: Record<string, any>): Promise<ChangeListResponse> {
    logger.info('Searching changes', { criteria });

    // Convert search criteria to filter format
    const searchFields = Object.entries(criteria).reduce((acc, [key, value]) => {
      acc[key] = { value, condition: 'contains' };
      return acc;
    }, {} as Record<string, any>);

    return this.list({ search_fields: searchFields });
  }

  /**
   * Get changes by status
   */
  async getByStatus(status: ChangeStatus): Promise<ChangeListResponse> {
    return this.list({
      filter_by: `status.name:'${status}'`,
    });
  }

  /**
   * Get changes awaiting approval
   */
  async getAwaitingApproval(): Promise<ChangeListResponse> {
    return this.getByStatus(ChangeStatus.AWAITING_APPROVAL);
  }

  /**
   * Get changes by type
   */
  async getByType(type: ChangeType): Promise<ChangeListResponse> {
    return this.list({
      filter_by: `type.name:'${type}'`,
    });
  }

  /**
   * Get emergency changes
   */
  async getEmergencyChanges(): Promise<ChangeListResponse> {
    return this.getByType(ChangeType.EMERGENCY);
  }

  /**
   * Get changes scheduled for date range
   */
  async getScheduledChanges(startDate: string, endDate: string): Promise<ChangeListResponse> {
    return this.list({
      filter_by: `scheduled_start_time:>'${startDate}' AND scheduled_start_time:<'${endDate}'`,
      sort_field: 'scheduled_start_time',
      sort_order: 'asc',
    });
  }

  /**
   * Get change statistics
   */
  async getStatistics(): Promise<{
    requested: number;
    awaiting_approval: number;
    approved: number;
    in_progress: number;
    completed: number;
    emergency: number;
  }> {
    const [requested, awaitingApproval, approved, inProgress, completed, emergency] = await Promise.all([
      this.getByStatus(ChangeStatus.REQUESTED),
      this.getByStatus(ChangeStatus.AWAITING_APPROVAL),
      this.getByStatus(ChangeStatus.APPROVED),
      this.getByStatus(ChangeStatus.IN_PROGRESS),
      this.getByStatus(ChangeStatus.COMPLETED),
      this.getEmergencyChanges(),
    ]);

    return {
      requested: requested.page_info?.total_count || 0,
      awaiting_approval: awaitingApproval.page_info?.total_count || 0,
      approved: approved.page_info?.total_count || 0,
      in_progress: inProgress.page_info?.total_count || 0,
      completed: completed.page_info?.total_count || 0,
      emergency: emergency.page_info?.total_count || 0,
    };
  }
}