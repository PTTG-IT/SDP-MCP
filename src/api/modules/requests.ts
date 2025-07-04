import { AxiosInstance } from 'axios';
import {
  BaseEntity,
  User,
  Technician,
  Category,
  SubCategory,
  Item,
  Priority,
  Status,
  Note,
  Attachment,
  Resolution,
  CustomField,
  Site,
  ListResponse,
  ListOptions,
  SDPResponse,
  SDPListResponse,
} from '../types.js';

export interface Request extends BaseEntity {
  subject: string;
  description?: string;
  requester: User;
  technician?: Technician;
  group?: {
    id: string;
    name: string;
  };
  category?: Category;
  subcategory?: SubCategory;
  item?: Item;
  priority?: Priority;
  status: Status;
  site?: Site;
  due_by_time?: {
    display_value: string;
    value: string;
  };
  is_overdue?: boolean;
  is_first_response_overdue?: boolean;
  is_service_request?: boolean;
  response_time?: string;
  resolution?: Resolution;
  custom_fields?: CustomField[];
  tags?: string[];
  attachments?: Attachment[];
  notes?: Note[];
  approval_status?: string;
  sla?: {
    id: string;
    name: string;
  };
  template?: {
    id: string;
    name: string;
    inactive?: boolean;
    image?: string;
    is_service_template?: boolean;
  };
  display_id?: string;
  display_key?: {
    display_value: string;
    value: string;
  };
  has_draft?: boolean;
  has_notes?: boolean;
  cancellation_requested?: boolean;
  cancel_flag_comments?: string;
  maintenance?: any;
}

export interface CreateRequestInput {
  subject: string;
  description?: string;
  requester: {
    id?: string;
    email?: string;
    email_id?: string; // SDP uses email_id
    name?: string;
  };
  category?: { id: string } | { name: string };
  subcategory?: { id: string } | { name: string };
  item?: { id: string } | { name: string };
  priority?: { id: string } | { name: string };
  status?: { id: string } | { name: string };
  technician?: { id: string } | { email?: string; email_id?: string }; // SDP uses email_id
  group?: { id: string } | { name: string };
  site?: { id: string } | { name: string };
  due_by_time?: string;
  custom_fields?: CustomField[];
  tags?: string[];
  // Required fields for SDP
  mode?: { id: string } | { name: string };
  request_type?: { id: string } | { name: string };
  urgency?: { id: string } | { name: string };
  level?: { id: string } | { name: string };
  impact?: { id: string } | { name: string };
}

export interface UpdateRequestInput extends Partial<CreateRequestInput> {
  // All fields are optional for updates
  closure_info?: {
    closure_code?: { id: string } | { name: string };
    closure_comments?: string;
  };
}

export interface AddNoteInput {
  content: string;
  is_public?: boolean;
  notify_technician?: boolean;
}

export interface CloseRequestInput {
  closure_code?: { id: string } | { name: string };
  closure_comments?: string;
  requester_ack_resolution?: boolean;
  requester_ack_comments?: string;
}

export class RequestsAPI {
  constructor(private axios: AxiosInstance) {}

  /**
   * Create a new request
   */
  async create(data: CreateRequestInput): Promise<Request> {
    // SDP API expects data to be wrapped in input_data parameter
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ request: data }));
    
    const response = await this.axios.post<SDPResponse<Request>>('/requests', params);
    return response.data.request!;
  }

  /**
   * Get a request by ID
   */
  async get(id: string): Promise<Request> {
    const response = await this.axios.get<SDPResponse<Request>>(`/requests/${id}`);
    return response.data.request!;
  }

  /**
   * Update a request
   */
  async update(id: string, data: UpdateRequestInput): Promise<Request> {
    // SDP API expects data to be wrapped in input_data parameter
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ request: data }));
    
    const response = await this.axios.put<SDPResponse<Request>>(`/requests/${id}`, params);
    return response.data.request!;
  }

  /**
   * Delete a request
   */
  async delete(id: string): Promise<void> {
    await this.axios.delete(`/requests/${id}`);
  }

  /**
   * List requests with optional filters
   */
  async list(options?: ListOptions): Promise<ListResponse<Request>> {
    // Transform our options to SDP format
    const params: any = {};
    
    if (options?.per_page || options?.page) {
      // SDP uses input_data parameter with JSON structure
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
    
    const response = await this.axios.get<SDPListResponse<Request>>('/requests', {
      params
    });
    
    // Transform SDP response to our standard format
    return {
      data: response.data.requests || [],
      meta: {
        total_count: response.data.list_info.row_count,
        page: options?.page || 1,
        per_page: options?.per_page || response.data.list_info.row_count,
        total_pages: Math.ceil(response.data.list_info.row_count / (options?.per_page || response.data.list_info.row_count))
      }
    };
  }

  /**
   * Search requests
   */
  async search(query: string, options?: ListOptions): Promise<ListResponse<Request>> {
    const response = await this.axios.get<ListResponse<Request>>('/requests/search', {
      params: {
        q: query,
        ...options,
      },
    });
    return response.data;
  }

  /**
   * Add a note to a request
   */
  async addNote(requestId: string, data: AddNoteInput): Promise<Note> {
    // SDP API expects data to be wrapped in input_data parameter
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ note: data }));
    
    const response = await this.axios.post<SDPResponse<Note>>(`/requests/${requestId}/notes`, params);
    return response.data.note!;
  }

  /**
   * Get notes for a request
   */
  async getNotes(requestId: string, options?: ListOptions): Promise<ListResponse<Note>> {
    const response = await this.axios.get<ListResponse<Note>>(`/requests/${requestId}/notes`, {
      params: options,
    });
    return response.data;
  }

  /**
   * Close a request
   * Note: The close endpoint may not work as expected in some SDP instances.
   * Consider using update() with status="Closed" and closure_info instead.
   */
  async close(id: string, data?: CloseRequestInput): Promise<Request> {
    // SDP API expects data to be wrapped in input_data parameter
    const params = new URLSearchParams();
    if (data) {
      params.append('input_data', JSON.stringify({ request: data }));
    }
    
    const response = await this.axios.post<SDPResponse<Request>>(`/requests/${id}/close`, params);
    return response.data.request!;
  }

  /**
   * Reopen a closed request
   */
  async reopen(id: string): Promise<Request> {
    const response = await this.axios.post<SDPResponse<Request>>(`/requests/${id}/reopen`);
    return response.data.request!;
  }

  /**
   * Assign a request to a technician
   */
  async assign(id: string, technicianId: string, groupId?: string): Promise<Request> {
    const data: any = {
      technician: { id: technicianId },
    };
    if (groupId) {
      data.group = { id: groupId };
    }
    
    // SDP API expects data to be wrapped in input_data parameter
    const params = new URLSearchParams();
    params.append('input_data', JSON.stringify({ request: data }));
    
    const response = await this.axios.put<SDPResponse<Request>>(`/requests/${id}/assign`, params);
    return response.data.request!;
  }

  /**
   * Add an attachment to a request
   */
  async addAttachment(requestId: string, file: Buffer, filename: string): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', new Blob([file]), filename);
    
    const response = await this.axios.post<SDPResponse<Attachment>>(
      `/requests/${requestId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.request!;
  }

  /**
   * Get request statistics
   */
  async getStats(filters?: Record<string, any>): Promise<any> {
    const response = await this.axios.get('/requests/stats', {
      params: filters,
    });
    return response.data;
  }
}