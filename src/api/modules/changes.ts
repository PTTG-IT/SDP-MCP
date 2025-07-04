import { AxiosInstance } from 'axios';
import { BaseEntity, User, ListResponse, ListOptions, SDPResponse } from '../types.js';

export interface Change extends BaseEntity {
  title: string;
  description?: string;
  change_type?: string;
  impact?: string;
  risk?: string;
  priority?: string;
  category?: { id: string; name: string };
  status: { id: string; name: string };
  requester?: User;
  change_manager?: User;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  reason_for_change?: string;
  rollout_plan?: string;
  backout_plan?: string;
}

export class ChangesAPI {
  constructor(private axios: AxiosInstance) {}

  async create(data: any): Promise<Change> {
    const response = await this.axios.post<SDPResponse<Change>>('/changes', { change: data });
    return response.data.change!;
  }

  async get(id: string): Promise<Change> {
    const response = await this.axios.get<SDPResponse<Change>>(`/changes/${id}`);
    return response.data.change!;
  }

  async update(id: string, data: any): Promise<Change> {
    const response = await this.axios.put<SDPResponse<Change>>(`/changes/${id}`, { change: data });
    return response.data.change!;
  }

  async list(options?: ListOptions): Promise<ListResponse<Change>> {
    const response = await this.axios.get<ListResponse<Change>>('/changes', { params: options });
    return response.data;
  }
}