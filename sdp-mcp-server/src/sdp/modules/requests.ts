import { SDPClient } from '../client.js';
import { SDPValidationError } from '../../utils/errors.js';
import { logger } from '../../monitoring/logging.js';
import { cacheable, createCacheInvalidator } from '../../utils/cache.js';
import {
  CreateRequestSchema,
  UpdateRequestSchema,
  CloseRequestSchema,
  PickupRequestSchema,
  ListRequestParamsSchema,
  type CreateRequestParams,
  type UpdateRequestParams,
  type CloseRequestParams,
  type PickupRequestParams,
  type ListRequestParams,
} from '../schemas/requests.js';

/**
 * Request status types in Service Desk Plus
 */
export enum RequestStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
  RESOLVED = 'Resolved',
  CANCELLED = 'Cancelled',
  ON_HOLD = 'On Hold',
  IN_PROGRESS = 'In Progress',
}

/**
 * Request priority levels
 */
export enum RequestPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

/**
 * Request urgency levels
 */
export enum RequestUrgency {
  LOW = 'Low',
  NORMAL = 'Normal',
  HIGH = 'High',
  URGENT = 'Urgent',
}

/**
 * Request impact levels
 */
export enum RequestImpact {
  LOW = 'Low',
  AFFECTING_DEPARTMENT = 'Affecting Department',
  AFFECTING_BUSINESS = 'Affecting Business',
  AFFECTING_GROUP = 'Affecting Group',
}

/**
 * Request interface
 */
export interface Request {
  id: string;
  subject: string;
  description?: string;
  requester?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  status?: {
    id?: string;
    name?: string;
  };
  priority?: {
    id?: string;
    name?: string;
  };
  urgency?: {
    id?: string;
    name?: string;
  };
  impact?: {
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
  technician?: {
    id?: string;
    name?: string;
  };
  group?: {
    id?: string;
    name?: string;
  };
  site?: {
    id?: string;
    name?: string;
  };
  created_time?: string;
  due_by_time?: string;
  resolved_time?: string;
  closed_time?: string;
  response_due_by_time?: string;
  first_response_time?: string;
  udf_fields?: Record<string, any>;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
  }>;
}

/**
 * Request creation parameters
 */
export interface CreateRequestParams {
  subject: string;
  description?: string;
  requester?: {
    id?: string;
    email?: string;
    name?: string;
  };
  priority?: string;
  urgency?: string;
  impact?: string;
  category?: { id: string } | { name: string };
  subcategory?: { id: string } | { name: string };
  item?: { id: string } | { name: string };
  technician?: { id: string } | { email: string };
  group?: { id: string } | { name: string };
  site?: { id: string } | { name: string };
  due_by_time?: string;
  udf_fields?: Record<string, any>;
}

/**
 * Request update parameters
 */
export interface UpdateRequestParams extends Partial<CreateRequestParams> {
  status?: string;
}

/**
 * Request list parameters
 */
export interface ListRequestParams {
  page?: number;
  page_size?: number;
  search_fields?: Record<string, string>;
  filter_by?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  include_details?: boolean;
}

/**
 * Request close parameters
 */
export interface CloseRequestParams {
  closure_code?: {
    id?: string;
    name?: string;
  };
  closure_comments?: string;
  requester_ack_resolution?: boolean;
  requester_ack_comments?: string;
}

/**
 * Request pickup parameters
 */
export interface PickupRequestParams {
  technician?: {
    id?: string;
    email?: string;
  };
}

/**
 * Request list response
 */
export interface RequestListResponse {
  requests: Request[];
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
 * Service Desk Plus Requests API Module
 */
export class RequestsAPI {
  private readonly client: SDPClient;
  private readonly cacheInvalidator = createCacheInvalidator('requests');

  constructor(client: SDPClient) {
    this.client = client;
  }

  /**
   * Create a new request
   */
  async create(params: CreateRequestParams): Promise<Request> {
    logger.info('Creating request', { subject: params.subject });

    // Validate parameters with Zod schema
    const validationResult = CreateRequestSchema.safeParse(params);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new SDPValidationError(
        firstError.message,
        firstError.path.join('.'),
        validationResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }))
      );
    }

    // Format request data
    const requestData = {
      request: {
        subject: params.subject,
        description: params.description,
        requester: params.requester,
        priority: params.priority ? { name: params.priority } : undefined,
        urgency: params.urgency ? { name: params.urgency } : undefined,
        impact: params.impact ? { name: params.impact } : undefined,
        category: params.category,
        subcategory: params.subcategory,
        item: params.item,
        technician: params.technician,
        group: params.group,
        site: params.site,
        due_by_time: params.due_by_time,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.post<{ request: Request }>(
      '/api/v3/requests',
      requestData
    );

    // Invalidate list cache
    await this.cacheInvalidator.invalidateOperation('list');

    return response.request;
  }

  /**
   * Get request by ID
   */
  @cacheable('requests', 'get')
  async get(id: string): Promise<Request> {
    logger.info('Getting request', { id });

    const response = await this.client.get<{ request: Request }>(
      `/api/v3/requests/${id}`
    );

    return response.request;
  }

  /**
   * Update a request
   */
  async update(id: string, params: UpdateRequestParams): Promise<Request> {
    logger.info('Updating request', { id, params });

    // Format update data
    const requestData = {
      request: {
        subject: params.subject,
        description: params.description,
        requester: params.requester,
        status: params.status ? { name: params.status } : undefined,
        priority: params.priority ? { name: params.priority } : undefined,
        urgency: params.urgency ? { name: params.urgency } : undefined,
        impact: params.impact ? { name: params.impact } : undefined,
        category: params.category,
        subcategory: params.subcategory,
        item: params.item,
        technician: params.technician,
        group: params.group,
        site: params.site,
        due_by_time: params.due_by_time,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.put<{ request: Request }>(
      `/api/v3/requests/${id}`,
      requestData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');

    return response.request;
  }

  /**
   * Delete a request
   */
  async delete(id: string): Promise<void> {
    logger.info('Deleting request', { id });

    await this.client.delete(`/api/v3/requests/${id}`);

    // Invalidate caches
    await this.cacheInvalidator.invalidateAll();
  }

  /**
   * List requests
   */
  @cacheable('requests', 'list')
  async list(params: ListRequestParams = {}): Promise<RequestListResponse> {
    logger.info('Listing requests', { params });

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

    const response = await this.client.get<RequestListResponse>(
      '/api/v3/requests',
      { params: queryParams }
    );

    return response;
  }

  /**
   * Close a request
   */
  async close(id: string, params: CloseRequestParams = {}): Promise<Request> {
    logger.info('Closing request', { id, params });

    const closeData = {
      request: {
        closure_code: params.closure_code,
        closure_comments: params.closure_comments,
        requester_ack_resolution: params.requester_ack_resolution,
        requester_ack_comments: params.requester_ack_comments,
      },
    };

    const response = await this.client.post<{ request: Request }>(
      `/api/v3/requests/${id}/close`,
      closeData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateAll();

    return response.request;
  }

  /**
   * Pickup a request (assign to current technician)
   */
  async pickup(id: string, params: PickupRequestParams = {}): Promise<Request> {
    logger.info('Picking up request', { id, params });

    const pickupData = params.technician ? { request: { technician: params.technician } } : {};

    const response = await this.client.post<{ request: Request }>(
      `/api/v3/requests/${id}/pickup`,
      pickupData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');

    return response.request;
  }

  /**
   * Add attachment to request
   */
  async addAttachment(id: string, file: Buffer, filename: string): Promise<void> {
    logger.info('Adding attachment to request', { id, filename });

    // Note: File upload requires multipart/form-data
    // This is a placeholder - actual implementation would need
    // to handle file uploads properly
    throw new Error('File upload not yet implemented');
  }

  /**
   * Search requests
   */
  async search(criteria: Record<string, any>): Promise<RequestListResponse> {
    logger.info('Searching requests', { criteria });

    // Convert search criteria to filter format
    const searchFields = Object.entries(criteria).reduce((acc, [key, value]) => {
      acc[key] = { value, condition: 'contains' };
      return acc;
    }, {} as Record<string, any>);

    return this.list({ search_fields: searchFields });
  }

  /**
   * Get requests by status
   */
  async getByStatus(status: RequestStatus): Promise<RequestListResponse> {
    return this.list({
      filter_by: `status.name:'${status}'`,
    });
  }

  /**
   * Get requests assigned to technician
   */
  async getByTechnician(technicianId: string): Promise<RequestListResponse> {
    return this.list({
      filter_by: `technician.id:${technicianId}`,
    });
  }

  /**
   * Get requests for requester
   */
  async getByRequester(requesterId: string): Promise<RequestListResponse> {
    return this.list({
      filter_by: `requester.id:${requesterId}`,
    });
  }

  /**
   * Get overdue requests
   */
  async getOverdue(): Promise<RequestListResponse> {
    const now = new Date().toISOString();
    return this.list({
      filter_by: `due_by_time:<'${now}' AND status.name!='Closed'`,
      sort_field: 'due_by_time',
      sort_order: 'asc',
    });
  }

  /**
   * Bulk update requests
   */
  async bulkUpdate(ids: string[], params: UpdateRequestParams): Promise<void> {
    logger.info('Bulk updating requests', { count: ids.length });

    // Note: SDP API v3 doesn't have native bulk update
    // This performs individual updates in parallel
    const updatePromises = ids.map(id => this.update(id, params));
    
    await Promise.all(updatePromises);
  }

  /**
   * Get request statistics
   */
  async getStatistics(): Promise<{
    open: number;
    closed: number;
    overdue: number;
    on_hold: number;
  }> {
    const [open, closed, overdue, onHold] = await Promise.all([
      this.getByStatus(RequestStatus.OPEN),
      this.getByStatus(RequestStatus.CLOSED),
      this.getOverdue(),
      this.getByStatus(RequestStatus.ON_HOLD),
    ]);

    return {
      open: open.page_info?.total_count || 0,
      closed: closed.page_info?.total_count || 0,
      overdue: overdue.page_info?.total_count || 0,
      on_hold: onHold.page_info?.total_count || 0,
    };
  }
}