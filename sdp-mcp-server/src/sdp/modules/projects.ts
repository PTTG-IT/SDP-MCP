import { SDPClient } from '../client.js';
import { SDPValidationError } from '../../utils/errors.js';
import { logger } from '../../monitoring/logging.js';
import { cacheable, createCacheInvalidator } from '../../utils/cache.js';

/**
 * Project status types
 */
export enum ProjectStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  ON_HOLD = 'On Hold',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  CLOSED = 'Closed',
}

/**
 * Project priority levels
 */
export enum ProjectPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

/**
 * Milestone status
 */
export enum MilestoneStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  OVERDUE = 'Overdue',
}

/**
 * Task status
 */
export enum TaskStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  ON_HOLD = 'On Hold',
}

/**
 * Task priority
 */
export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

/**
 * Project interface
 */
export interface Project {
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
  project_type?: {
    id?: string;
    name?: string;
  };
  owner?: {
    id?: string;
    name?: string;
    email?: string;
  };
  project_manager?: {
    id?: string;
    name?: string;
    email?: string;
  };
  site?: {
    id?: string;
    name?: string;
  };
  department?: {
    id?: string;
    name?: string;
  };
  scheduled_start_date?: string;
  scheduled_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  created_time?: string;
  updated_time?: string;
  completed_time?: string;
  percentage_completion?: number;
  estimated_hours?: number;
  actual_hours?: number;
  budget?: {
    allocated?: number;
    spent?: number;
    currency?: string;
  };
  members?: Array<{
    id: string;
    name: string;
    email?: string;
    role?: string;
  }>;
  milestones?: Array<{
    id: string;
    title: string;
    status: string;
    percentage_completion: number;
  }>;
  associated_assets?: Array<{
    id: string;
    name: string;
  }>;
  associated_changes?: Array<{
    id: string;
    title: string;
  }>;
  udf_fields?: Record<string, any>;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
  }>;
}

/**
 * Milestone interface
 */
export interface Milestone {
  id: string;
  title: string;
  description?: string;
  status?: {
    id?: string;
    name?: string;
  };
  owner?: {
    id?: string;
    name?: string;
  };
  scheduled_start_date?: string;
  scheduled_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  percentage_completion?: number;
  tasks?: Task[];
}

/**
 * Task interface
 */
export interface Task {
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
  owner?: {
    id?: string;
    name?: string;
  };
  assigned_to?: {
    id?: string;
    name?: string;
  };
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  estimated_hours?: number;
  actual_hours?: number;
  percentage_completion?: number;
  dependencies?: Array<{
    id: string;
    title: string;
  }>;
}

/**
 * Project creation parameters
 */
export interface CreateProjectParams {
  title: string;
  description?: string;
  priority?: string;
  project_type?: { id: string } | { name: string };
  owner?: { id: string } | { email: string };
  project_manager?: { id: string } | { email: string };
  site?: { id: string } | { name: string };
  department?: { id: string } | { name: string };
  scheduled_start_date?: string;
  scheduled_end_date?: string;
  estimated_hours?: number;
  budget?: {
    allocated?: number;
    currency?: string;
  };
  udf_fields?: Record<string, any>;
}

/**
 * Project update parameters
 */
export interface UpdateProjectParams extends Partial<CreateProjectParams> {
  status?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  percentage_completion?: number;
  actual_hours?: number;
}

/**
 * Milestone creation parameters
 */
export interface CreateMilestoneParams {
  title: string;
  description?: string;
  owner?: { id: string } | { email: string };
  scheduled_start_date?: string;
  scheduled_end_date?: string;
}

/**
 * Task creation parameters
 */
export interface CreateTaskParams {
  title: string;
  description?: string;
  priority?: string;
  owner?: { id: string } | { email: string };
  assigned_to?: { id: string } | { email: string };
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  estimated_hours?: number;
}

/**
 * Project list parameters
 */
export interface ListProjectParams {
  page?: number;
  page_size?: number;
  search_fields?: Record<string, string>;
  filter_by?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  include_details?: boolean;
}

/**
 * Project list response
 */
export interface ProjectListResponse {
  projects: Project[];
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
 * Service Desk Plus Projects API Module
 */
export class ProjectsAPI {
  private readonly client: SDPClient;
  private readonly cacheInvalidator = createCacheInvalidator('projects');

  constructor(client: SDPClient) {
    this.client = client;
  }

  /**
   * Create a new project
   */
  async create(params: CreateProjectParams): Promise<Project> {
    logger.info('Creating project', { title: params.title });

    // Validate required fields
    if (!params.title) {
      throw new SDPValidationError('Title is required', 'title');
    }

    // Format project data
    const projectData = {
      project: {
        title: params.title,
        description: params.description,
        priority: params.priority ? { name: params.priority } : undefined,
        project_type: params.project_type,
        owner: params.owner,
        project_manager: params.project_manager,
        site: params.site,
        department: params.department,
        scheduled_start_date: params.scheduled_start_date,
        scheduled_end_date: params.scheduled_end_date,
        estimated_hours: params.estimated_hours,
        budget: params.budget,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.post<{ project: Project }>(
      '/api/v3/projects',
      projectData
    );

    // Invalidate list cache
    await this.cacheInvalidator.invalidateOperation('list');

    return response.project;
  }

  /**
   * Get project by ID
   */
  @cacheable('projects', 'get')
  async get(id: string): Promise<Project> {
    logger.info('Getting project', { id });

    const response = await this.client.get<{ project: Project }>(
      `/api/v3/projects/${id}`
    );

    return response.project;
  }

  /**
   * Update a project
   */
  async update(id: string, params: UpdateProjectParams): Promise<Project> {
    logger.info('Updating project', { id, params });

    // Format update data
    const projectData = {
      project: {
        title: params.title,
        description: params.description,
        status: params.status ? { name: params.status } : undefined,
        priority: params.priority ? { name: params.priority } : undefined,
        project_type: params.project_type,
        owner: params.owner,
        project_manager: params.project_manager,
        site: params.site,
        department: params.department,
        scheduled_start_date: params.scheduled_start_date,
        scheduled_end_date: params.scheduled_end_date,
        actual_start_date: params.actual_start_date,
        actual_end_date: params.actual_end_date,
        estimated_hours: params.estimated_hours,
        actual_hours: params.actual_hours,
        percentage_completion: params.percentage_completion,
        budget: params.budget,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.put<{ project: Project }>(
      `/api/v3/projects/${id}`,
      projectData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');

    return response.project;
  }

  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    logger.info('Deleting project', { id });

    await this.client.delete(`/api/v3/projects/${id}`);

    // Invalidate caches
    await this.cacheInvalidator.invalidateAll();
  }

  /**
   * List projects
   */
  @cacheable('projects', 'list')
  async list(params: ListProjectParams = {}): Promise<ProjectListResponse> {
    logger.info('Listing projects', { params });

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

    const response = await this.client.get<ProjectListResponse>(
      '/api/v3/projects',
      { params: queryParams }
    );

    return response;
  }

  /**
   * Get project milestones
   */
  @cacheable('projects', 'milestones')
  async getMilestones(projectId: string): Promise<Milestone[]> {
    logger.info('Getting project milestones', { projectId });

    const response = await this.client.get<{ milestones: Milestone[] }>(
      `/api/v3/projects/${projectId}/milestones`
    );

    return response.milestones;
  }

  /**
   * Create milestone
   */
  async createMilestone(projectId: string, params: CreateMilestoneParams): Promise<Milestone> {
    logger.info('Creating milestone', { projectId, title: params.title });

    const milestoneData = {
      milestone: {
        title: params.title,
        description: params.description,
        owner: params.owner,
        scheduled_start_date: params.scheduled_start_date,
        scheduled_end_date: params.scheduled_end_date,
      },
    };

    const response = await this.client.post<{ milestone: Milestone }>(
      `/api/v3/projects/${projectId}/milestones`,
      milestoneData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('milestones');
    await this.cacheInvalidator.invalidateOperation('get');

    return response.milestone;
  }

  /**
   * Get milestone tasks
   */
  @cacheable('projects', 'tasks')
  async getTasks(projectId: string, milestoneId: string): Promise<Task[]> {
    logger.info('Getting milestone tasks', { projectId, milestoneId });

    const response = await this.client.get<{ tasks: Task[] }>(
      `/api/v3/projects/${projectId}/milestones/${milestoneId}/tasks`
    );

    return response.tasks;
  }

  /**
   * Create task
   */
  async createTask(
    projectId: string,
    milestoneId: string,
    params: CreateTaskParams
  ): Promise<Task> {
    logger.info('Creating task', { projectId, milestoneId, title: params.title });

    const taskData = {
      task: {
        title: params.title,
        description: params.description,
        priority: params.priority ? { name: params.priority } : undefined,
        owner: params.owner,
        assigned_to: params.assigned_to,
        scheduled_start_time: params.scheduled_start_time,
        scheduled_end_time: params.scheduled_end_time,
        estimated_hours: params.estimated_hours,
      },
    };

    const response = await this.client.post<{ task: Task }>(
      `/api/v3/projects/${projectId}/milestones/${milestoneId}/tasks`,
      taskData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('tasks');
    await this.cacheInvalidator.invalidateOperation('milestones');

    return response.task;
  }

  /**
   * Update task
   */
  async updateTask(
    projectId: string,
    milestoneId: string,
    taskId: string,
    params: Partial<CreateTaskParams> & {
      status?: string;
      actual_hours?: number;
      percentage_completion?: number;
    }
  ): Promise<Task> {
    logger.info('Updating task', { projectId, milestoneId, taskId });

    const taskData = {
      task: {
        title: params.title,
        description: params.description,
        status: params.status ? { name: params.status } : undefined,
        priority: params.priority ? { name: params.priority } : undefined,
        assigned_to: params.assigned_to,
        actual_hours: params.actual_hours,
        percentage_completion: params.percentage_completion,
      },
    };

    const response = await this.client.put<{ task: Task }>(
      `/api/v3/projects/${projectId}/milestones/${milestoneId}/tasks/${taskId}`,
      taskData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('tasks');

    return response.task;
  }

  /**
   * Add project member
   */
  async addMember(
    projectId: string,
    member: { id: string } | { email: string },
    role?: string
  ): Promise<void> {
    logger.info('Adding project member', { projectId, member, role });

    await this.client.post(
      `/api/v3/projects/${projectId}/members`,
      {
        member: {
          ...member,
          role,
        },
      }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Remove project member
   */
  async removeMember(projectId: string, memberId: string): Promise<void> {
    logger.info('Removing project member', { projectId, memberId });

    await this.client.delete(`/api/v3/projects/${projectId}/members/${memberId}`);

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Complete project
   */
  async complete(id: string): Promise<Project> {
    logger.info('Completing project', { id });

    return this.update(id, {
      status: ProjectStatus.COMPLETED,
      actual_end_date: new Date().toISOString(),
      percentage_completion: 100,
    });
  }

  /**
   * Cancel project
   */
  async cancel(id: string, reason?: string): Promise<Project> {
    logger.info('Cancelling project', { id, reason });

    return this.update(id, {
      status: ProjectStatus.CANCELLED,
      udf_fields: reason ? { cancellation_reason: reason } : undefined,
    });
  }

  /**
   * Get projects by status
   */
  async getByStatus(status: ProjectStatus): Promise<ProjectListResponse> {
    return this.list({
      filter_by: `status.name:'${status}'`,
    });
  }

  /**
   * Get projects by owner
   */
  async getByOwner(ownerId: string): Promise<ProjectListResponse> {
    return this.list({
      filter_by: `owner.id:${ownerId}`,
    });
  }

  /**
   * Get overdue projects
   */
  async getOverdueProjects(): Promise<ProjectListResponse> {
    const now = new Date().toISOString();
    return this.list({
      filter_by: `scheduled_end_date:<'${now}' AND status.name!='Completed' AND status.name!='Cancelled'`,
      sort_field: 'scheduled_end_date',
      sort_order: 'asc',
    });
  }

  /**
   * Get project statistics
   */
  async getStatistics(): Promise<{
    open: number;
    in_progress: number;
    completed: number;
    overdue: number;
    on_hold: number;
  }> {
    const [open, inProgress, completed, overdue, onHold] = await Promise.all([
      this.getByStatus(ProjectStatus.OPEN),
      this.getByStatus(ProjectStatus.IN_PROGRESS),
      this.getByStatus(ProjectStatus.COMPLETED),
      this.getOverdueProjects(),
      this.getByStatus(ProjectStatus.ON_HOLD),
    ]);

    return {
      open: open.page_info?.total_count || 0,
      in_progress: inProgress.page_info?.total_count || 0,
      completed: completed.page_info?.total_count || 0,
      overdue: overdue.page_info?.total_count || 0,
      on_hold: onHold.page_info?.total_count || 0,
    };
  }
}