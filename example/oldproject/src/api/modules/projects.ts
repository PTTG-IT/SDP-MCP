import { AxiosInstance } from 'axios';
import { ListResponse, ListOptions, SDPResponse, SDPListResponse } from '../types.js';
import { 
  Project, 
  Milestone, 
  Task, 
  Worklog,
  CreateProjectInput,
  CreateTaskInput,
  CreateWorklogInput 
} from '../types/projects.js';

export class ProjectsAPI {
  constructor(private axios: AxiosInstance) {}

  /**
   * Create a new project
   */
  async create(data: CreateProjectInput): Promise<Project> {
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ project: data }));
    
    const response = await this.axios.post<SDPResponse<Project>>('/projects', params);
    return response.data.project!;
  }

  /**
   * Get a project by ID
   */
  async get(id: string): Promise<Project> {
    const response = await this.axios.get<SDPResponse<Project>>(`/projects/${id}`);
    return response.data.project!;
  }

  /**
   * Update a project
   */
  async update(id: string, data: Partial<CreateProjectInput>): Promise<Project> {
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ project: data }));
    
    const response = await this.axios.put<SDPResponse<Project>>(`/projects/${id}`, params);
    return response.data.project!;
  }

  /**
   * List projects with optional filters
   */
  async list(options?: ListOptions): Promise<ListResponse<Project>> {
    const params: any = {};
    
    if (options?.per_page || options?.page) {
      const listInfo: any = {};
      if (options.per_page) {
        listInfo.row_count = options.per_page;
      }
      if (options.page && options.per_page) {
        listInfo.start_index = (options.page - 1) * options.per_page + 1;
      }
      params.input_data = JSON.stringify({
        list_info: listInfo
      });
    }
    
    const response = await this.axios.get<SDPListResponse<Project>>('/projects', {
      params
    });
    
    return {
      data: response.data.projects || [],
      meta: {
        total_count: response.data.list_info.row_count,
        page: options?.page || 1,
        per_page: options?.per_page || response.data.list_info.row_count,
        total_pages: Math.ceil(response.data.list_info.row_count / (options?.per_page || response.data.list_info.row_count))
      }
    };
  }

  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    await this.axios.delete(`/projects/${id}`);
  }

  // Milestone operations
  
  /**
   * Create a milestone for a project
   */
  async createMilestone(projectId: string, data: any): Promise<Milestone> {
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ milestone: { ...data, project: { id: projectId } } }));
    
    const response = await this.axios.post<SDPResponse<Milestone>>(`/projects/${projectId}/milestones`, params);
    return response.data.milestone!;
  }

  /**
   * List milestones for a project
   */
  async listMilestones(projectId: string, options?: ListOptions): Promise<ListResponse<Milestone>> {
    const response = await this.axios.get<ListResponse<Milestone>>(`/projects/${projectId}/milestones`, {
      params: options
    });
    return response.data;
  }

  // Task operations
  
  /**
   * Create a task for a project
   */
  async createTask(data: CreateTaskInput): Promise<Task> {
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ task: data }));
    
    const response = await this.axios.post<SDPResponse<Task>>('/tasks', params);
    return response.data.task!;
  }

  /**
   * Get a task by ID
   */
  async getTask(id: string): Promise<Task> {
    const response = await this.axios.get<SDPResponse<Task>>(`/tasks/${id}`);
    return response.data.task!;
  }

  /**
   * Update a task
   */
  async updateTask(id: string, data: Partial<CreateTaskInput>): Promise<Task> {
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ task: data }));
    
    const response = await this.axios.put<SDPResponse<Task>>(`/tasks/${id}`, params);
    return response.data.task!;
  }

  /**
   * List tasks for a project
   */
  async listProjectTasks(projectId: string, options?: ListOptions): Promise<ListResponse<Task>> {
    const response = await this.axios.get<ListResponse<Task>>(`/projects/${projectId}/tasks`, {
      params: options
    });
    return response.data;
  }

  // Worklog operations
  
  /**
   * Add worklog entry
   */
  async addWorklog(data: CreateWorklogInput): Promise<Worklog> {
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ worklog: data }));
    
    const response = await this.axios.post<SDPResponse<Worklog>>('/worklogs', params);
    return response.data.worklog!;
  }

  /**
   * List worklogs for a project
   */
  async listProjectWorklogs(projectId: string, options?: ListOptions): Promise<ListResponse<Worklog>> {
    const response = await this.axios.get<ListResponse<Worklog>>(`/projects/${projectId}/worklogs`, {
      params: options
    });
    return response.data;
  }

  /**
   * List worklogs for a task
   */
  async listTaskWorklogs(taskId: string, options?: ListOptions): Promise<ListResponse<Worklog>> {
    const response = await this.axios.get<ListResponse<Worklog>>(`/tasks/${taskId}/worklogs`, {
      params: options
    });
    return response.data;
  }
}