import { AxiosInstance } from 'axios';
import { BaseEntity, User, ListResponse, ListOptions, SDPResponse } from '../types.js';

export interface Asset extends BaseEntity {
  name: string;
  asset_tag?: string;
  serial_number?: string;
  barcode?: string;
  product: {
    id: string;
    name: string;
  };
  vendor?: {
    id: string;
    name: string;
  };
  location?: {
    id: string;
    name: string;
  };
  assigned_to?: User;
  department?: {
    id: string;
    name: string;
  };
  asset_state?: string;
  service_tag?: string;
  acquisition_date?: string;
  expiry_date?: string;
  cost?: number;
  description?: string;
}

export class AssetsAPI {
  constructor(private axios: AxiosInstance) {}

  async create(data: any): Promise<Asset> {
    const response = await this.axios.post<SDPResponse<Asset>>('/assets', { asset: data });
    return response.data.asset!;
  }

  async get(id: string): Promise<Asset> {
    const response = await this.axios.get<SDPResponse<Asset>>(`/assets/${id}`);
    return response.data.asset!;
  }

  async update(id: string, data: any): Promise<Asset> {
    const response = await this.axios.put<SDPResponse<Asset>>(`/assets/${id}`, { asset: data });
    return response.data.asset!;
  }

  async delete(id: string): Promise<void> {
    await this.axios.delete(`/assets/${id}`);
  }

  async list(options?: ListOptions): Promise<ListResponse<Asset>> {
    const response = await this.axios.get<ListResponse<Asset>>('/assets', { params: options });
    return response.data;
  }

  async search(query: string, options?: ListOptions): Promise<ListResponse<Asset>> {
    const response = await this.axios.get<ListResponse<Asset>>('/assets/search', {
      params: { q: query, ...options },
    });
    return response.data;
  }
}