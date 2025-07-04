import { AxiosInstance } from 'axios';
import { User, ListResponse, ListOptions, SDPResponse } from '../types.js';

export class UsersAPI {
  constructor(private axios: AxiosInstance) {}

  async get(id: string): Promise<User> {
    const response = await this.axios.get<SDPResponse<User>>(`/users/${id}`);
    return response.data.user!;
  }

  async list(options?: ListOptions): Promise<ListResponse<User>> {
    const response = await this.axios.get<ListResponse<User>>('/users', { params: options });
    return response.data;
  }

  async search(query: string, options?: ListOptions): Promise<ListResponse<User>> {
    const response = await this.axios.get<ListResponse<User>>('/users/search', {
      params: { q: query, ...options },
    });
    return response.data;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const response = await this.axios.put<SDPResponse<User>>(`/users/${id}`, { user: data });
    return response.data.user!;
  }
}