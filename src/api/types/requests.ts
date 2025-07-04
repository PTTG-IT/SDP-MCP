import { BaseEntity, User, Technician, Category, SubCategory, Item, Priority, Status, Attachment, Note } from '../types.js';

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
  impact?: string;
  urgency?: string;
  request_type?: string;
  mode?: string;
  level?: string;
  site?: {
    id: string;
    name: string;
  };
  due_date?: string;
  response_due_date?: string;
  resolution_due_date?: string;
  is_overdue?: boolean;
  has_attachments?: boolean;
  attachments?: Attachment[];
  notes?: Note[];
  approval_status?: string;
  sla?: {
    id: string;
    name: string;
  };
  asset?: {
    id: string;
    name: string;
  };
  display_id?: string;
}

export interface CreateRequestInput {
  subject: string;
  description?: string;
  requester: {
    email_id?: string;
    id?: string;
    name?: string;
  };
  technician?: {
    email_id?: string;
    id?: string;
  };
  category?: {
    name?: string;
    id?: string;
  };
  subcategory?: {
    name?: string;
    id?: string;
  };
  item?: {
    name?: string;
    id?: string;
  };
  priority?: {
    name?: string;
    id?: string;
  };
  urgency?: {
    name?: string;
    id?: string;
  };
  impact?: {
    name?: string;
    id?: string;
  };
  request_type?: {
    name?: string;
    id?: string;
  };
  status?: {
    name?: string;
    id?: string;
  };
  mode?: {
    name?: string;
    id?: string;
  };
  level?: {
    name?: string;
    id?: string;
  };
  group?: {
    name?: string;
    id?: string;
  };
  site?: {
    name?: string;
    id?: string;
  };
  due_date?: string;
  assets?: Array<{
    id: string;
  }>;
}

export interface UpdateRequestInput extends Partial<CreateRequestInput> {
  // All fields from CreateRequestInput are optional for updates
}

export interface CloseRequestInput {
  status: {
    name: string;
  };
  closure_info?: {
    requester_ack_resolution?: boolean;
    requester_ack_comments?: string;
    closure_comment?: string;
    closure_code?: {
      name?: string;
      id?: string;
    };
  };
}