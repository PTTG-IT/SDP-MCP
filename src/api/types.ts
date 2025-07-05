// Common types used across the API

export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ListResponse<T> {
  data: T[];
  meta: {
    total_count: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// Actual SDP API Response format
export interface SDPListResponse<T> {
  response_status: Array<{
    status_code: number;
    status: string;
  }>;
  list_info: {
    has_more_rows: boolean;
    row_count: number;
    sort_fields?: Array<{
      field: string;
      order: string;
    }>;
  };
  requests?: T[];
  users?: T[];
  assets?: T[];
  problems?: T[];
  changes?: T[];
  projects?: T[];
  tasks?: T[];
  milestones?: T[];
  worklogs?: T[];
  priorities?: T[];
  categories?: T[];
  statuses?: T[];
  technicians?: T[];
  request_types?: T[];
  levels?: T[];
  modes?: T[];
  impacts?: T[];
  urgencies?: T[];
  subcategories?: T[];
}

export interface SDPResponse<T> {
  request?: T;
  asset?: T;
  problem?: T;
  change?: T;
  user?: T;
  project?: T;
  task?: T;
  milestone?: T;
  worklog?: T;
  note?: T;
  response_status: {
    status_code: number;
    status: string;
    messages?: Array<{
      message: string;
      type: 'success' | 'error' | 'warning';
    }>;
  };
}

export interface BaseEntity {
  id: string;
  created_time?: string;
  created_by?: User;
  last_updated_time?: string;
  last_updated_by?: User;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  department?: Department;
  site?: Site;
  is_vip?: boolean;
}

export interface Technician extends User {
  cost_per_hour?: number;
  roles?: Role[];
}

export interface Department {
  id: string;
  name: string;
}

export interface Site {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface SubCategory {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  name: string;
}

export interface Priority {
  id: string;
  name: string;
  color?: string;
}

export interface Status {
  id: string;
  name: string;
  color?: string;
  internal_name?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  content_type: string;
  module?: string;
  attached_on?: string;
}

export interface Note {
  id: string;
  content: string;
  created_time: string;
  created_by: User;
  is_public: boolean;
  attachments?: Attachment[];
}

export interface CustomField {
  field_id: string;
  value: any;
}

export interface Resolution {
  content: string;
  submitted_on?: string;
  submitted_by?: User;
}

// Search related types
export interface SearchCriteria {
  field: string;
  condition: 'is' | 'is not' | 'contains' | 'not contains' | 'starts with' | 'ends with' | 'greater than' | 'less than' | 'between';
  values: string[];
  logical_operator?: 'AND' | 'OR';
}

export interface SearchParams {
  search_criteria?: SearchCriteria[];
  pagination?: PaginationParams;
}

// Field options for listing
export interface ListOptions extends PaginationParams {
  fields?: string[];
  include?: string[];
  filter?: Record<string, any>;
}

// Date format used by SDP API
export interface SDPDate {
  display_value: string;
  value: string;
}