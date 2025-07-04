import { z } from 'zod';

export interface Tool {
  name: string;
  description: string;
}

export const tools: Tool[] = [
  {
    name: "create_request",
    description: "Create a new service request in Service Desk Plus",
  },
  {
    name: "update_request",
    description: "Update an existing service request",
  },
  {
    name: "get_request",
    description: "Get details of a specific service request",
  },
  {
    name: "search_requests",
    description: "Search for service requests using keywords or filters",
  },
  {
    name: "list_requests",
    description: "List service requests with optional filters",
  },
  {
    name: "close_request",
    description: "Close a service request with resolution details",
  },
  {
    name: "add_note_to_request",
    description: "Add a note or comment to a service request",
  },
  {
    name: "assign_request",
    description: "Assign a request to a technician",
  },
  {
    name: "create_asset",
    description: "Create a new asset in the asset management system",
  },
  {
    name: "update_asset",
    description: "Update an existing asset's information",
  },
  {
    name: "search_assets",
    description: "Search for assets using various criteria",
  },
  {
    name: "get_user",
    description: "Get information about a user",
  },
  {
    name: "search_users",
    description: "Search for users in the system",
  },
  {
    name: "create_problem",
    description: "Create a new problem record",
  },
  {
    name: "create_change",
    description: "Create a new change request",
  },
];

// Schema definitions for each tool
export const toolSchemas: Record<string, z.ZodSchema> = {
  create_request: z.object({
    subject: z.string().describe("Subject or title of the request"),
    description: z.string().optional().describe("Detailed description of the request"),
    requester_email: z.string().email().optional().describe("Email of the requester"),
    requester_name: z.string().optional().describe("Name of the requester"),
    category: z.string().optional().describe("Category of the request"),
    subcategory: z.string().optional().describe("Subcategory of the request"),
    priority: z.string().optional().describe("Priority level (e.g., Low, Medium, High, Urgent)"),
    technician_email: z.string().email().optional().describe("Email of the technician to assign"),
    due_date: z.string().optional().describe("Due date in ISO format"),
    tags: z.array(z.string()).optional().describe("Tags to add to the request"),
  }),

  update_request: z.object({
    request_id: z.string().describe("ID of the request to update"),
    subject: z.string().optional().describe("New subject for the request"),
    description: z.string().optional().describe("New description"),
    priority: z.string().optional().describe("New priority level"),
    status: z.string().optional().describe("New status"),
    technician_email: z.string().email().optional().describe("Email of technician to assign"),
    category: z.string().optional().describe("New category"),
    subcategory: z.string().optional().describe("New subcategory"),
  }),

  get_request: z.object({
    request_id: z.string().describe("ID of the request to retrieve"),
  }),

  search_requests: z.object({
    query: z.string().describe("Search query string"),
    status: z.string().optional().describe("Filter by status"),
    priority: z.string().optional().describe("Filter by priority"),
    technician: z.string().optional().describe("Filter by technician name or email"),
    requester: z.string().optional().describe("Filter by requester name or email"),
    limit: z.number().optional().default(20).describe("Maximum number of results"),
  }),

  list_requests: z.object({
    status: z.string().optional().describe("Filter by status (e.g., Open, Closed)"),
    priority: z.string().optional().describe("Filter by priority"),
    page: z.number().optional().default(1).describe("Page number"),
    per_page: z.number().optional().default(20).describe("Results per page"),
    sort_by: z.string().optional().describe("Field to sort by"),
    sort_order: z.enum(['asc', 'desc']).optional().describe("Sort order"),
  }),

  close_request: z.object({
    request_id: z.string().describe("ID of the request to close"),
    closure_comments: z.string().describe("Resolution or closure comments"),
    closure_code: z.string().optional().describe("Closure code (e.g., Completed, Cancelled, Solved)"),
    technician_email: z.string().email().optional().describe("Email of technician to assign before closing (if not already assigned)"),
    notify_requester: z.boolean().optional().default(true).describe("Whether to notify the requester"),
  }),

  add_note_to_request: z.object({
    request_id: z.string().describe("ID of the request"),
    content: z.string().describe("Note content"),
    is_public: z.boolean().optional().default(true).describe("Whether the note is visible to requester"),
    notify_technician: z.boolean().optional().default(false).describe("Whether to notify the technician"),
  }),

  assign_request: z.object({
    request_id: z.string().describe("ID of the request to assign"),
    technician_email: z.string().email().describe("Email of the technician"),
    group_name: z.string().optional().describe("Name of the support group"),
  }),

  create_asset: z.object({
    name: z.string().describe("Asset name"),
    asset_tag: z.string().optional().describe("Asset tag or serial number"),
    product: z.string().describe("Product name or model"),
    vendor: z.string().optional().describe("Vendor or manufacturer"),
    location: z.string().optional().describe("Asset location"),
    user_email: z.string().email().optional().describe("Email of the asset user"),
    purchase_date: z.string().optional().describe("Purchase date in ISO format"),
    cost: z.number().optional().describe("Asset cost"),
    description: z.string().optional().describe("Additional description"),
  }),

  update_asset: z.object({
    asset_id: z.string().describe("ID of the asset to update"),
    name: z.string().optional().describe("New asset name"),
    location: z.string().optional().describe("New location"),
    user_email: z.string().email().optional().describe("New user email"),
    status: z.string().optional().describe("Asset status"),
    description: z.string().optional().describe("Updated description"),
  }),

  search_assets: z.object({
    query: z.string().describe("Search query"),
    asset_type: z.string().optional().describe("Filter by asset type"),
    location: z.string().optional().describe("Filter by location"),
    user: z.string().optional().describe("Filter by user name or email"),
    limit: z.number().optional().default(20).describe("Maximum number of results"),
  }),

  get_user: z.object({
    user_id: z.string().optional().describe("User ID"),
    email: z.string().email().optional().describe("User email"),
  }).refine(data => data.user_id || data.email, {
    message: "Either user_id or email must be provided",
  }),

  search_users: z.object({
    query: z.string().describe("Search query for user name or email"),
    department: z.string().optional().describe("Filter by department"),
    site: z.string().optional().describe("Filter by site/location"),
    limit: z.number().optional().default(20).describe("Maximum number of results"),
  }),

  create_problem: z.object({
    title: z.string().describe("Problem title"),
    description: z.string().describe("Problem description"),
    impact: z.string().optional().describe("Impact level"),
    urgency: z.string().optional().describe("Urgency level"),
    category: z.string().optional().describe("Problem category"),
    requester_email: z.string().email().optional().describe("Email of the problem reporter"),
  }),

  create_change: z.object({
    title: z.string().describe("Change request title"),
    description: z.string().describe("Change description"),
    reason_for_change: z.string().describe("Reason for the change"),
    change_type: z.string().optional().describe("Type of change (e.g., Standard, Emergency)"),
    impact: z.string().optional().describe("Expected impact"),
    risk: z.string().optional().describe("Risk level"),
    scheduled_start: z.string().optional().describe("Scheduled start time in ISO format"),
    scheduled_end: z.string().optional().describe("Scheduled end time in ISO format"),
  }),
};