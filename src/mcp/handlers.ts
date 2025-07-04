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

    // Project Management Handlers
    create_project: async (args) => {
      const projectData: any = {
        title: args.title,
        description: args.description,
      };

      if (args.project_type) {
        projectData.project_type = { name: args.project_type };
      }
      if (args.priority) {
        projectData.priority = { name: args.priority };
      }
      if (args.owner_email) {
        projectData.owner = { email_id: args.owner_email };
      }
      if (args.scheduled_start) {
        projectData.scheduled_start_time = args.scheduled_start;
      }
      if (args.scheduled_end) {
        projectData.scheduled_end_time = args.scheduled_end;
      }
      if (args.site) {
        projectData.site = { name: args.site };
      }
      if (args.group) {
        projectData.group = { name: args.group };
      }

      // Set default status
      projectData.status = { name: "Open" };

      const project = await client.projects.create(projectData);
      return `Project created successfully\nID: ${project.id}\nTitle: ${project.title}\nStatus: ${project.status.name}\nOwner: ${project.owner?.name || project.owner?.email || 'Unassigned'}`;
    },

    update_project: async (args) => {
      const updateData: any = {};
      
      if (args.title) updateData.title = args.title;
      if (args.description) updateData.description = args.description;
      if (args.status) updateData.status = { name: args.status };
      if (args.priority) updateData.priority = { name: args.priority };
      if (args.owner_email) updateData.owner = { email_id: args.owner_email };
      if (args.percentage_completion !== undefined) updateData.percentage_completion = args.percentage_completion;
      if (args.actual_start) updateData.actual_start_time = args.actual_start;
      if (args.actual_end) updateData.actual_end_time = args.actual_end;

      const project = await client.projects.update(args.project_id, updateData);
      return `Project ${project.id} updated successfully\nTitle: ${project.title}\nStatus: ${project.status.name}\nCompletion: ${project.percentage_completion || 0}%`;
    },

    get_project: async (args) => {
      const project = await client.projects.get(args.project_id);
      return {
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status.name,
        priority: project.priority?.name,
        owner: project.owner ? {
          name: project.owner.name,
          email: (project.owner as any).email || (project.owner as any).email_id,
        } : null,
        scheduled_start: project.scheduled_start_time,
        scheduled_end: project.scheduled_end_time,
        actual_start: project.actual_start_time,
        actual_end: project.actual_end_time,
        percentage_completion: project.percentage_completion,
        created_time: project.created_time,
      };
    },

    list_projects: async (args) => {
      const options: any = {
        page: args.page || 1,
        per_page: args.per_page || 20,
      };

      if (args.sort_by) options.sort_by = args.sort_by;
      if (args.sort_order) options.sort_order = args.sort_order;

      const results = await client.projects.list(options);
      
      // Apply filters if needed
      let filteredProjects = results.data;
      
      if (args.status) {
        filteredProjects = filteredProjects.filter(proj => 
          proj.status?.name?.toLowerCase() === args.status.toLowerCase()
        );
      }
      
      if (args.owner) {
        const owner = args.owner.toLowerCase();
        filteredProjects = filteredProjects.filter(proj => 
          proj.owner?.name?.toLowerCase().includes(owner) ||
          (proj.owner as any)?.email?.toLowerCase().includes(owner)
        );
      }
      
      const formattedResults = filteredProjects.map(proj => ({
        id: proj.id,
        title: proj.title,
        status: proj.status.name,
        priority: proj.priority?.name || 'Not set',
        owner: proj.owner?.name || 'Unassigned',
        percentage_completion: proj.percentage_completion || 0,
        scheduled_end: proj.scheduled_end_time,
      }));

      return {
        page: results.meta.page,
        total_count: results.meta.total_count,
        projects: formattedResults,
      };
    },

    create_task: async (args) => {
      const taskData: any = {
        title: args.title,
        description: args.description,
        project: { id: args.project_id },
      };

      if (args.milestone_id) {
        taskData.milestone = { id: args.milestone_id };
      }
      if (args.owner_email) {
        taskData.owner = { email_id: args.owner_email };
      }
      if (args.group) {
        taskData.group = { name: args.group };
      }
      if (args.priority) {
        taskData.priority = { name: args.priority };
      }
      if (args.task_type) {
        taskData.task_type = { name: args.task_type };
      }
      if (args.scheduled_start) {
        taskData.scheduled_start_time = args.scheduled_start;
      }
      if (args.scheduled_end) {
        taskData.scheduled_end_time = args.scheduled_end;
      }
      if (args.estimated_hours) {
        taskData.estimated_hours = args.estimated_hours;
      }
      if (args.parent_task_id) {
        taskData.parent_task = { id: args.parent_task_id };
      }

      // Set default status
      taskData.status = { name: "Open" };

      const task = await client.projects.createTask(taskData);
      return `Task created successfully\nID: ${task.id}\nTitle: ${task.title}\nProject: ${task.project.title || task.project.id}\nStatus: ${task.status.name}\nOwner: ${task.owner?.name || 'Unassigned'}`;
    },

    update_task: async (args) => {
      const updateData: any = {};
      
      if (args.title) updateData.title = args.title;
      if (args.description) updateData.description = args.description;
      if (args.status) updateData.status = { name: args.status };
      if (args.priority) updateData.priority = { name: args.priority };
      if (args.owner_email) updateData.owner = { email_id: args.owner_email };
      if (args.percentage_completion !== undefined) updateData.percentage_completion = args.percentage_completion;
      if (args.actual_start) updateData.actual_start_time = args.actual_start;
      if (args.actual_end) updateData.actual_end_time = args.actual_end;
      if (args.actual_hours !== undefined) updateData.actual_hours = args.actual_hours;

      const task = await client.projects.updateTask(args.task_id, updateData);
      return `Task ${task.id} updated successfully\nTitle: ${task.title}\nStatus: ${task.status.name}\nCompletion: ${task.percentage_completion || 0}%`;
    },

    complete_task: async (args) => {
      const updateData: any = {
        status: { name: "Completed" },
        percentage_completion: 100,
        actual_end_time: new Date().toISOString(),
      };

      if (args.completion_comments) {
        updateData.description = args.completion_comments;
      }
      if (args.actual_hours !== undefined) {
        updateData.actual_hours = args.actual_hours;
      }

      const task = await client.projects.updateTask(args.task_id, updateData);
      return `Task ${task.id} marked as completed\nTitle: ${task.title}\nActual Hours: ${task.actual_hours || 'Not specified'}`;
    },

    list_project_tasks: async (args) => {
      const options: any = {
        page: args.page || 1,
        per_page: args.per_page || 20,
      };

      const results = await client.projects.listProjectTasks(args.project_id, options);
      
      // Apply filters if needed
      let filteredTasks = results.data;
      
      if (args.milestone_id) {
        filteredTasks = filteredTasks.filter(task => 
          task.milestone?.id === args.milestone_id
        );
      }
      
      if (args.status) {
        filteredTasks = filteredTasks.filter(task => 
          task.status?.name?.toLowerCase() === args.status.toLowerCase()
        );
      }
      
      if (args.owner) {
        const owner = args.owner.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
          task.owner?.name?.toLowerCase().includes(owner) ||
          (task.owner as any)?.email?.toLowerCase().includes(owner)
        );
      }
      
      const formattedResults = filteredTasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status.name,
        priority: task.priority?.name || 'Not set',
        owner: task.owner?.name || 'Unassigned',
        percentage_completion: task.percentage_completion || 0,
        estimated_hours: task.estimated_hours,
        actual_hours: task.actual_hours,
      }));

      return {
        project_id: args.project_id,
        total_tasks: formattedResults.length,
        tasks: formattedResults,
      };
    },

    add_worklog: async (args) => {
      const worklogData: any = {
        description: args.description,
        start_time: args.start_time,
        end_time: args.end_time,
      };

      if (args.task_id) {
        worklogData.task = { id: args.task_id };
      } else if (args.project_id) {
        worklogData.project = { id: args.project_id };
      }

      if (args.owner_email) {
        worklogData.owner = { email_id: args.owner_email };
      }

      if (args.is_billable !== undefined) {
        worklogData.is_billable = args.is_billable;
      }

      if (args.worklog_type) {
        worklogData.worklog_type = { name: args.worklog_type };
      }

      const worklog = await client.projects.addWorklog(worklogData);
      
      // Calculate time spent
      const start = new Date(args.start_time);
      const end = new Date(args.end_time);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      return `Worklog added successfully\nID: ${worklog.id}\nTime Logged: ${hours.toFixed(2)} hours\nBillable: ${worklog.is_billable ? 'Yes' : 'No'}\nDescription: ${worklog.description}`;
    },

    create_milestone: async (args) => {
      const milestoneData: any = {
        title: args.title,
        description: args.description,
        status: { name: "Open" },
      };

      if (args.owner_email) {
        milestoneData.owner = { email_id: args.owner_email };
      }
      if (args.scheduled_start) {
        milestoneData.scheduled_start_time = args.scheduled_start;
      }
      if (args.scheduled_end) {
        milestoneData.scheduled_end_time = args.scheduled_end;
      }

      const milestone = await client.projects.createMilestone(args.project_id, milestoneData);
      return `Milestone created successfully\nID: ${milestone.id}\nTitle: ${milestone.title}\nProject: ${milestone.project.id}\nStatus: ${milestone.status.name}`;
    },

    get_project_summary: async (args) => {
      const project = await client.projects.get(args.project_id);
      const summary: any = {
        project: {
          id: project.id,
          title: project.title,
          status: project.status.name,
          percentage_completion: project.percentage_completion || 0,
          owner: project.owner?.name || 'Unassigned',
          scheduled_end: project.scheduled_end_time,
        },
      };

      if (args.include_milestones) {
        try {
          const milestones = await client.projects.listMilestones(args.project_id);
          summary.milestones = {
            total: milestones.data.length,
            completed: milestones.data.filter(m => m.status.name === 'Completed').length,
            list: milestones.data.map(m => ({
              id: m.id,
              title: m.title,
              status: m.status.name,
              percentage_completion: m.percentage_completion || 0,
            })),
          };
        } catch (error) {
          summary.milestones = { error: 'Unable to fetch milestones' };
        }
      }

      if (args.include_tasks) {
        try {
          const tasks = await client.projects.listProjectTasks(args.project_id);
          const taskStats = {
            total: tasks.data.length,
            completed: tasks.data.filter(t => t.status.name === 'Completed').length,
            in_progress: tasks.data.filter(t => t.status.name === 'In Progress').length,
            open: tasks.data.filter(t => t.status.name === 'Open').length,
          };
          
          summary.tasks = {
            ...taskStats,
            completion_percentage: taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0,
            total_estimated_hours: tasks.data.reduce((sum, t) => sum + (t.estimated_hours || 0), 0),
            total_actual_hours: tasks.data.reduce((sum, t) => sum + (t.actual_hours || 0), 0),
          };
        } catch (error) {
          summary.tasks = { error: 'Unable to fetch tasks' };
        }
      }

      if (args.include_worklogs) {
        try {
          const worklogs = await client.projects.listProjectWorklogs(args.project_id);
          const totalHours = worklogs.data.reduce((sum, w) => {
            if (w.start_time && w.end_time) {
              const start = new Date((w.start_time as any).value || w.start_time);
              const end = new Date((w.end_time as any).value || w.end_time);
              return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }
            return sum;
          }, 0);

          summary.time_tracking = {
            total_worklogs: worklogs.data.length,
            total_hours_logged: totalHours.toFixed(2),
            billable_hours: worklogs.data
              .filter(w => w.is_billable)
              .reduce((sum, w) => {
                if (w.start_time && w.end_time) {
                  const start = new Date((w.start_time as any).value || w.start_time);
                  const end = new Date((w.end_time as any).value || w.end_time);
                  return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                }
                return sum;
              }, 0).toFixed(2),
          };
        } catch (error) {
          summary.time_tracking = { error: 'Unable to fetch worklogs' };
        }
      }

      return summary;
    },
  };

  const handler = handlers[toolName];
  if (!handler) {
    throw new SDPError(`Unknown tool: ${toolName}`, 'UNKNOWN_TOOL');
  }

  return handler;
}