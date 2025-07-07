import { SDPClient } from '../client.js';
import { SDPValidationError } from '../../utils/errors.js';
import { logger } from '../../monitoring/logging.js';
import { cacheable, createCacheInvalidator } from '../../utils/cache.js';

/**
 * Problem status types
 */
export enum ProblemStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
  RESOLVED = 'Resolved',
  IN_PROGRESS = 'In Progress',
  PENDING = 'Pending',
}

/**
 * Problem priority levels
 */
export enum ProblemPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

/**
 * Problem impact levels
 */
export enum ProblemImpact {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  ENTERPRISE = 'Enterprise',
}

/**
 * Problem interface
 */
export interface Problem {
  id: string;
  title: string;
  description?: string;
  status?: {
    id?: string;
    name?: string;
  };
  priority?: {
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
  owner?: {
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
  due_by_time?: string;
  created_time?: string;
  updated_time?: string;
  resolved_time?: string;
  closed_time?: string;
  analysis?: {
    root_cause?: string;
    symptoms?: string;
    impact_details?: string;
  };
  resolution?: {
    content?: string;
    submitted_by?: {
      id?: string;
      name?: string;
    };
    submitted_on?: string;
  };
  associated_requests?: Array<{
    id: string;
    subject: string;
  }>;
  associated_changes?: Array<{
    id: string;
    title: string;
  }>;
  associated_assets?: Array<{
    id: string;
    name: string;
  }>;
  workaround?: string;
  known_error?: boolean;
  udf_fields?: Record<string, any>;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
  }>;
}

/**
 * Problem creation parameters
 */
export interface CreateProblemParams {
  title: string;
  description?: string;
  priority?: string;
  impact?: string;
  urgency?: string;
  category?: { id: string } | { name: string };
  subcategory?: { id: string } | { name: string };
  item?: { id: string } | { name: string };
  owner?: { id: string } | { email: string };
  group?: { id: string } | { name: string };
  site?: { id: string } | { name: string };
  due_by_time?: string;
  analysis?: {
    root_cause?: string;
    symptoms?: string;
    impact_details?: string;
  };
  workaround?: string;
  known_error?: boolean;
  udf_fields?: Record<string, any>;
}

/**
 * Problem update parameters
 */
export interface UpdateProblemParams extends Partial<CreateProblemParams> {
  status?: string;
}

/**
 * Problem list parameters
 */
export interface ListProblemParams {
  page?: number;
  page_size?: number;
  search_fields?: Record<string, string>;
  filter_by?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  include_details?: boolean;
}

/**
 * Problem analysis parameters
 */
export interface ProblemAnalysisParams {
  root_cause?: string;
  symptoms?: string;
  impact_details?: string;
  workaround?: string;
}

/**
 * Problem resolution parameters
 */
export interface ProblemResolutionParams {
  content: string;
  permanent_fix?: boolean;
  preventive_measures?: string;
}

/**
 * Problem list response
 */
export interface ProblemListResponse {
  problems: Problem[];
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
 * Service Desk Plus Problems API Module
 */
export class ProblemsAPI {
  private readonly client: SDPClient;
  private readonly cacheInvalidator = createCacheInvalidator('problems');

  constructor(client: SDPClient) {
    this.client = client;
  }

  /**
   * Create a new problem
   */
  async create(params: CreateProblemParams): Promise<Problem> {
    logger.info('Creating problem', { title: params.title });

    // Validate required fields
    if (!params.title) {
      throw new SDPValidationError('Title is required', 'title');
    }

    // Format problem data
    const problemData = {
      problem: {
        title: params.title,
        description: params.description,
        priority: params.priority ? { name: params.priority } : undefined,
        impact: params.impact ? { name: params.impact } : undefined,
        urgency: params.urgency ? { name: params.urgency } : undefined,
        category: params.category,
        subcategory: params.subcategory,
        item: params.item,
        owner: params.owner,
        group: params.group,
        site: params.site,
        due_by_time: params.due_by_time,
        analysis: params.analysis,
        workaround: params.workaround,
        known_error: params.known_error,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.post<{ problem: Problem }>(
      '/api/v3/problems',
      problemData
    );

    // Invalidate list cache
    await this.cacheInvalidator.invalidateOperation('list');

    return response.problem;
  }

  /**
   * Get problem by ID
   */
  @cacheable('problems', 'get')
  async get(id: string): Promise<Problem> {
    logger.info('Getting problem', { id });

    const response = await this.client.get<{ problem: Problem }>(
      `/api/v3/problems/${id}`
    );

    return response.problem;
  }

  /**
   * Update a problem
   */
  async update(id: string, params: UpdateProblemParams): Promise<Problem> {
    logger.info('Updating problem', { id, params });

    // Format update data
    const problemData = {
      problem: {
        title: params.title,
        description: params.description,
        status: params.status ? { name: params.status } : undefined,
        priority: params.priority ? { name: params.priority } : undefined,
        impact: params.impact ? { name: params.impact } : undefined,
        urgency: params.urgency ? { name: params.urgency } : undefined,
        category: params.category,
        subcategory: params.subcategory,
        item: params.item,
        owner: params.owner,
        group: params.group,
        site: params.site,
        due_by_time: params.due_by_time,
        analysis: params.analysis,
        workaround: params.workaround,
        known_error: params.known_error,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.put<{ problem: Problem }>(
      `/api/v3/problems/${id}`,
      problemData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');

    return response.problem;
  }

  /**
   * Delete a problem
   */
  async delete(id: string): Promise<void> {
    logger.info('Deleting problem', { id });

    await this.client.delete(`/api/v3/problems/${id}`);

    // Invalidate caches
    await this.cacheInvalidator.invalidateAll();
  }

  /**
   * List problems
   */
  @cacheable('problems', 'list')
  async list(params: ListProblemParams = {}): Promise<ProblemListResponse> {
    logger.info('Listing problems', { params });

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

    const response = await this.client.get<ProblemListResponse>(
      '/api/v3/problems',
      { params: queryParams }
    );

    return response;
  }

  /**
   * Analyze a problem (add root cause analysis)
   */
  async analyze(id: string, params: ProblemAnalysisParams): Promise<Problem> {
    logger.info('Analyzing problem', { id, params });

    return this.update(id, { analysis: params });
  }

  /**
   * Add resolution to problem
   */
  async resolve(id: string, params: ProblemResolutionParams): Promise<Problem> {
    logger.info('Resolving problem', { id, params });

    const resolutionData = {
      problem: {
        resolution: {
          content: params.content,
        },
        status: { name: ProblemStatus.RESOLVED },
      },
    };

    const response = await this.client.put<{ problem: Problem }>(
      `/api/v3/problems/${id}`,
      resolutionData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateAll();

    return response.problem;
  }

  /**
   * Close a problem
   */
  async close(id: string): Promise<Problem> {
    logger.info('Closing problem', { id });

    return this.update(id, { status: ProblemStatus.CLOSED });
  }

  /**
   * Associate request with problem
   */
  async associateRequest(problemId: string, requestId: string): Promise<void> {
    logger.info('Associating request with problem', { problemId, requestId });

    await this.client.post(
      `/api/v3/problems/${problemId}/associate_request`,
      { request: { id: requestId } }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Associate change with problem
   */
  async associateChange(problemId: string, changeId: string): Promise<void> {
    logger.info('Associating change with problem', { problemId, changeId });

    await this.client.post(
      `/api/v3/problems/${problemId}/associate_change`,
      { change: { id: changeId } }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Associate asset with problem
   */
  async associateAsset(problemId: string, assetId: string): Promise<void> {
    logger.info('Associating asset with problem', { problemId, assetId });

    await this.client.post(
      `/api/v3/problems/${problemId}/associate_asset`,
      { asset: { id: assetId } }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Search problems
   */
  async search(criteria: Record<string, any>): Promise<ProblemListResponse> {
    logger.info('Searching problems', { criteria });

    // Convert search criteria to filter format
    const searchFields = Object.entries(criteria).reduce((acc, [key, value]) => {
      acc[key] = { value, condition: 'contains' };
      return acc;
    }, {} as Record<string, any>);

    return this.list({ search_fields: searchFields });
  }

  /**
   * Get problems by status
   */
  async getByStatus(status: ProblemStatus): Promise<ProblemListResponse> {
    return this.list({
      filter_by: `status.name:'${status}'`,
    });
  }

  /**
   * Get known errors
   */
  async getKnownErrors(): Promise<ProblemListResponse> {
    return this.list({
      filter_by: `known_error:true`,
    });
  }

  /**
   * Get problems by owner
   */
  async getByOwner(ownerId: string): Promise<ProblemListResponse> {
    return this.list({
      filter_by: `owner.id:${ownerId}`,
    });
  }

  /**
   * Get high priority problems
   */
  async getHighPriority(): Promise<ProblemListResponse> {
    return this.list({
      filter_by: `priority.name:'High' OR priority.name:'Urgent'`,
      sort_field: 'priority.id',
      sort_order: 'desc',
    });
  }

  /**
   * Get problem statistics
   */
  async getStatistics(): Promise<{
    open: number;
    closed: number;
    resolved: number;
    known_errors: number;
    high_priority: number;
  }> {
    const [open, closed, resolved, knownErrors, highPriority] = await Promise.all([
      this.getByStatus(ProblemStatus.OPEN),
      this.getByStatus(ProblemStatus.CLOSED),
      this.getByStatus(ProblemStatus.RESOLVED),
      this.getKnownErrors(),
      this.getHighPriority(),
    ]);

    return {
      open: open.page_info?.total_count || 0,
      closed: closed.page_info?.total_count || 0,
      resolved: resolved.page_info?.total_count || 0,
      known_errors: knownErrors.page_info?.total_count || 0,
      high_priority: highPriority.page_info?.total_count || 0,
    };
  }
}