import { SDPClient } from '../api/client.js';
import { SDPError } from '../utils/errors.js';

export type ToolHandler = (args: any) => Promise<any>;

export function createToolHandler(toolName: string, client: SDPClient): ToolHandler {
  const handlers: Record<string, ToolHandler> = {
    create_request: async (args) => {
      const requestData: any = {
        subject: args.subject,
        description: args.description,
        requester: {},
        // Add default required fields based on what we learned
        mode: { name: "E-Mail" },
        request_type: { name: "Request" },
        urgency: { name: "3 - Have Workaround" },
        level: { name: "1 - Frontline" },
        impact: { name: "1 - Affects User" },
        category: { name: "General" },  // Default category
        subcategory: { name: "General" },  // Default subcategory
        status: { name: "Open" }
      };

      if (args.requester_email) {
        requestData.requester.email_id = args.requester_email;
      }
      if (args.requester_name) {
        requestData.requester.name = args.requester_name;
      }
      if (args.category) {
        requestData.category = { name: args.category };
        // Reset subcategory when category changes
        if (args.category.toLowerCase() === "hardware" || args.category === "Hardwre") {
          requestData.subcategory = { name: "Computer" };
        }
      }
      if (args.subcategory) {
        requestData.subcategory = { name: args.subcategory };
      }
      if (args.priority) {
        // Map common priority names to your system's values
        const priorityMap: Record<string, string> = {
          "low": "3 - Low",
          "normal": "2 - Normal",
          "high": "1 - High",
          "urgent": "1 - High"
        };
        requestData.priority = { name: priorityMap[args.priority.toLowerCase()] || args.priority };
      }
      if (args.urgency) {
        requestData.urgency = { name: args.urgency };
      }
      if (args.impact) {
        requestData.impact = { name: args.impact };
      }
      if (args.technician_email) {
        requestData.technician = { email_id: args.technician_email };
      }
      if (args.due_date) {
        requestData.due_by_time = args.due_date;
      }
      if (args.tags) {
        requestData.tags = args.tags;
      }

      const request = await client.requests.create(requestData);
      return `Request created successfully with ID: ${request.id}\nDisplay ID: ${request.display_id}\nSubject: ${request.subject}\nStatus: ${request.status.name}\nRequester: ${request.requester?.name || request.requester?.email || 'Unknown'}`;
    },

    update_request: async (args) => {
      const updateData: any = {};
      
      if (args.subject) updateData.subject = args.subject;
      if (args.description) updateData.description = args.description;
      if (args.priority) updateData.priority = { name: args.priority };
      if (args.status) updateData.status = { name: args.status };
      if (args.technician_email) updateData.technician = { email_id: args.technician_email };
      if (args.category) updateData.category = { name: args.category };
      if (args.subcategory) updateData.subcategory = { name: args.subcategory };

      const request = await client.requests.update(args.request_id, updateData);
      return `Request ${request.id} updated successfully\nSubject: ${request.subject}\nStatus: ${request.status.name}`;
    },

    get_request: async (args) => {
      const request = await client.requests.get(args.request_id);
      return {
        id: request.id,
        subject: request.subject,
        description: request.description,
        status: request.status.name,
        priority: request.priority?.name,
        requester: {
          name: request.requester.name,
          email: request.requester.email,
        },
        technician: request.technician ? {
          name: request.technician.name,
          email: request.technician.email,
        } : null,
        created_time: request.created_time,
        due_by_time: request.due_by_time,
        is_overdue: request.is_overdue,
      };
    },

    search_requests: async (args) => {
      // Since search endpoint doesn't exist, we'll use list and filter in memory
      const options: any = {
        per_page: 100, // Get more results to filter
      };

      const results = await client.requests.list(options);
      
      // Filter results based on arguments
      let filteredRequests = results.data;
      
      if (args.query) {
        const query = args.query.toLowerCase();
        filteredRequests = filteredRequests.filter(req => 
          req.subject?.toLowerCase().includes(query) ||
          req.description?.toLowerCase().includes(query) ||
          req.id?.includes(query) ||
          req.display_id?.includes(query)
        );
      }
      
      if (args.status) {
        filteredRequests = filteredRequests.filter(req => 
          req.status?.name?.toLowerCase() === args.status.toLowerCase() ||
          req.status?.internal_name?.toLowerCase() === args.status.toLowerCase()
        );
      }
      
      if (args.priority) {
        filteredRequests = filteredRequests.filter(req => 
          req.priority?.name?.toLowerCase() === args.priority.toLowerCase()
        );
      }
      
      if (args.technician) {
        const tech = args.technician.toLowerCase();
        filteredRequests = filteredRequests.filter(req => 
          req.technician?.name?.toLowerCase().includes(tech) ||
          req.technician?.email?.toLowerCase().includes(tech)
        );
      }
      
      if (args.requester) {
        const req = args.requester.toLowerCase();
        filteredRequests = filteredRequests.filter(request => 
          request.requester?.name?.toLowerCase().includes(req) ||
          request.requester?.email?.toLowerCase().includes(req)
        );
      }
      
      // Limit results
      const limitedResults = filteredRequests.slice(0, args.limit || 20);
      
      const formattedResults = limitedResults.map(req => ({
        id: req.id,
        display_id: req.display_id,
        subject: req.subject,
        status: req.status?.name || 'Unknown',
        priority: req.priority?.name || 'Not set',
        requester: req.requester?.name || 'Unknown',
        technician: req.technician?.name || 'Unassigned',
        created_time: (req.created_time as any)?.display_value || req.created_time,
      }));

      return {
        total_found: filteredRequests.length,
        showing: formattedResults.length,
        results: formattedResults,
      };
    },

    list_requests: async (args) => {
      const options: any = {
        page: args.page || 1,
        per_page: args.per_page || 20,
      };

      if (args.sort_by) options.sort_by = args.sort_by;
      if (args.sort_order) options.sort_order = args.sort_order;
      
      // Add filters
      if (args.status || args.priority) {
        options.filter = {};
        if (args.status) options.filter.status = args.status;
        if (args.priority) options.filter.priority = args.priority;
      }

      const results = await client.requests.list(options);
      
      const formattedResults = results.data.map(req => ({
        id: req.id,
        subject: req.subject,
        status: req.status.name,
        priority: req.priority?.name,
        requester: req.requester.name,
        technician: req.technician?.name,
        created_time: req.created_time,
      }));

      return {
        page: results.meta.page,
        per_page: results.meta.per_page,
        total_count: results.meta.total_count,
        total_pages: results.meta.total_pages,
        requests: formattedResults,
      };
    },

    close_request: async (args) => {
      // First, ensure the request has a technician assigned
      const request = await client.requests.get(args.request_id);
      
      const updateData: any = {
        status: { 
          name: "Closed",
          id: "216826000000006661" // Standard closed status ID
        },
        closure_info: {
          closure_comments: args.closure_comments || "Request closed",
          closure_code: { 
            name: args.closure_code || "Completed",
            id: "216826000000090001" // Standard completion code ID
          }
        }
      };

      // If no technician is assigned and one is provided, assign it
      if (!request.technician && args.technician_email) {
        updateData.technician = { email_id: args.technician_email };
      } else if (!request.technician) {
        throw new SDPError('Request must have a technician assigned before closing', 'VALIDATION_ERROR');
      }

      // Update the request to close it
      const closedRequest = await client.requests.update(args.request_id, updateData);
      return `Request ${closedRequest.id} closed successfully\nDisplay ID: ${closedRequest.display_id}\nSubject: ${closedRequest.subject}\nStatus: ${closedRequest.status.name}\nClosed by: ${closedRequest.technician?.name || args.technician_email}\nResolution: ${args.closure_comments || "Request closed"}`;
    },

    add_note_to_request: async (args) => {
      const note = await client.requests.addNote(args.request_id, {
        content: args.content,
        is_public: args.is_public !== false,
        notify_technician: args.notify_technician || false,
      });

      return `Note added successfully to request ${args.request_id}\nNote ID: ${note.id}\nContent: ${note.content}\nPublic: ${note.is_public}`;
    },

    assign_request: async (args) => {
      // Note: This is a simplified implementation
      // In reality, you might need to look up the technician ID from the email
      const updateData: any = {
        technician: { email: args.technician_email },
      };
      
      if (args.group_name) {
        updateData.group = { name: args.group_name };
      }

      const request = await client.requests.update(args.request_id, updateData);
      return `Request ${request.id} assigned to ${request.technician?.name || args.technician_email}`;
    },

    create_asset: async (_args) => {
      // Note: This would need to be implemented when the assets module is created
      throw new SDPError('Asset management is not yet implemented', 'NOT_IMPLEMENTED');
    },

    update_asset: async (_args) => {
      throw new SDPError('Asset management is not yet implemented', 'NOT_IMPLEMENTED');
    },

    search_assets: async (_args) => {
      throw new SDPError('Asset management is not yet implemented', 'NOT_IMPLEMENTED');
    },

    get_user: async (args) => {
      // Note: This would need to be implemented when the users module is fully created
      if (args.user_id) {
        const user = await client.users.get(args.user_id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          department: user.department?.name,
          site: user.site?.name,
          is_vip: user.is_vip,
        };
      } else if (args.email) {
        const results = await client.users.search(args.email);
        if (results.data.length === 0) {
          throw new SDPError('User not found', 'NOT_FOUND');
        }
        const user = results.data[0];
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          department: user.department?.name,
          site: user.site?.name,
          is_vip: user.is_vip,
        };
      }
      throw new SDPError('Either user_id or email must be provided', 'INVALID_PARAMS');
    },

    search_users: async (args) => {
      const results = await client.users.search(args.query, {
        per_page: args.limit || 20,
      });

      const formattedResults = results.data.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department?.name,
        site: user.site?.name,
      }));

      return {
        total_count: results.meta.total_count,
        users: formattedResults,
      };
    },

    create_problem: async (_args) => {
      // Note: This would need to be implemented when the problems module is created
      throw new SDPError('Problem management is not yet implemented', 'NOT_IMPLEMENTED');
    },

    create_change: async (_args) => {
      // Note: This would need to be implemented when the changes module is created
      throw new SDPError('Change management is not yet implemented', 'NOT_IMPLEMENTED');
    },
  };

  const handler = handlers[toolName];
  if (!handler) {
    throw new SDPError(`Unknown tool: ${toolName}`, 'UNKNOWN_TOOL');
  }

  return handler;
}