import { AxiosInstance } from 'axios';
import { BaseEntity, User, ListResponse, ListOptions, SDPResponse } from '../types.js';

export interface Problem extends BaseEntity {
  title: string;
  description?: string;
  impact?: string;
  urgency?: string;
  priority?: string;
  category?: { id: string; name: string };
  status: { id: string; name: string };
  requester?: User;
  technician?: User;
  due_by_time?: string;
  known_error?: boolean;
  root_cause?: string;
}

export class ProblemsAPI {
  constructor(private axios: AxiosInstance) {}

  async create(data: any): Promise<Problem> {
    const response = await this.axios.post<SDPResponse<Problem>>('/problems', { problem: data });
    return response.data.problem!;
  }

  async get(id: string): Promise<Problem> {
    const response = await this.axios.get<SDPResponse<Problem>>(`/problems/${id}`);
    return response.data.problem!;
  }

  async update(id: string, data: any): Promise<Problem> {
    const response = await this.axios.put<SDPResponse<Problem>>(`/problems/${id}`, { problem: data });
    return response.data.problem!;
  }

  async list(options?: ListOptions): Promise<ListResponse<Problem>> {
    const response = await this.axios.get<ListResponse<Problem>>('/problems', { params: options });
    return response.data;
  }
}