import { AxiosInstance } from 'axios';

export interface Requester {
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
  middle_name?: string;
  is_vipuser?: boolean;
  site?: {
    id: string;
    name: string;
  };
}

export class RequestersAPI {
  constructor(private axios: AxiosInstance) {}

  /**
   * Get requester by ID
   */
  async get(id: string): Promise<Requester> {
    const response = await this.axios.get(`/requesters/${id}`);
    return response.data.requester;
  }

  /**
   * List all requesters
   */
  async list(options?: any): Promise<{ requesters: Requester[]; response_status: any }> {
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

    const response = await this.axios.get('/requesters', { params });
    return response.data;
  }

  /**
   * Search requesters
   */
  async search(searchKey: string, options?: any): Promise<{ requesters: Requester[]; response_status: any }> {
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

    const response = await this.axios.get('/requesters', { params });
    return response.data;
  }

  /**
   * Create a new requester
   */
  async create(data: Partial<Requester>): Promise<Requester> {
    const requesterData = {
      requester: data
    };

    const response = await this.axios.post('/requesters', {
      input_data: JSON.stringify(requesterData)
    });
    return response.data.requester;
  }

  /**
   * Update requester
   */
  async update(id: string, data: Partial<Requester>): Promise<Requester> {
    const requesterData = {
      requester: data
    };

    const response = await this.axios.put(`/requesters/${id}`, {
      input_data: JSON.stringify(requesterData)
    });
    return response.data.requester;
  }
}