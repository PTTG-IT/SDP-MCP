import { AxiosInstance } from 'axios';

export interface Technician {
  id: string;
  name: string;
  email_id?: string;
  phone?: string;
  mobile?: string;
  department?: {
    id: string;
    name: string;
  };
  job_title?: string;
  first_name?: string;
  last_name?: string;
  is_technician?: boolean;
  login_name?: string;
  site?: {
    id: string;
    name: string;
  };
}

export class TechniciansAPI {
  constructor(private axios: AxiosInstance) {}

  /**
   * Get technician by ID
   */
  async get(id: string): Promise<Technician> {
    const response = await this.axios.get(`/technicians/${id}`);
    return response.data.technician;
  }

  /**
   * List all technicians
   */
  async list(options?: any): Promise<{ technicians: Technician[]; response_status: any }> {
    const params: any = {
      input_data: JSON.stringify({
        list_info: {
          row_count: options?.per_page || 100,
          start_index: ((options?.page || 1) - 1) * (options?.per_page || 100) + 1,
          sort_field: options?.sort_by || 'name',
          sort_order: options?.sort_order || 'asc'
        }
      })
    };

    const response = await this.axios.get('/technicians', { params });
    return response.data;
  }

  /**
   * Search technicians
   */
  async search(searchKey: string, options?: any): Promise<{ technicians: Technician[]; response_status: any }> {
    const params: any = {
      input_data: JSON.stringify({
        list_info: {
          row_count: options?.limit || 20,
          search_fields: {
            email_id: searchKey,
            name: searchKey
          }
        }
      })
    };

    const response = await this.axios.get('/technicians', { params });
    return response.data;
  }
}