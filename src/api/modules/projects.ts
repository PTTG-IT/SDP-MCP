import { AxiosInstance } from 'axios';
import { BaseEntity, User, ListResponse, ListOptions, SDPResponse } from '../types.js';

export interface Project extends BaseEntity {
  title: string;
  description?: string;
  project_type?: string;
  status: { id: string; name: string };
  priority?: string;
  owner?: User;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  percentage_completion?: number;
}

export class ProjectsAPI {
  constructor(private axios: AxiosInstance) {}

  async create(data: any): Promise<Project> {
    const response = await this.axios.post<SDPResponse<Project>>('/projects', { project: data });
    return response.data.project!;
  }

  async get(id: string): Promise<Project> {
    const response = await this.axios.get<SDPResponse<Project>>(`/projects/${id}`);
    return response.data.project!;
  }

  async update(id: string, data: any): Promise<Project> {
    const response = await this.axios.put<SDPResponse<Project>>(`/projects/${id}`, { project: data });
    return response.data.project!;
  }

  async list(options?: ListOptions): Promise<ListResponse<Project>> {
    const response = await this.axios.get<ListResponse<Project>>('/projects', { params: options });
    return response.data;
  }
}