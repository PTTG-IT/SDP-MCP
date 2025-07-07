import { z } from 'zod';

// Project schemas
export const createProjectSchema = z.object({
  title: z.string().describe("Project title"),
  description: z.string().optional().describe("Project description"),
  project_type: z.string().optional().describe("Type of project (e.g., Development, Implementation, Maintenance)"),
  priority: z.string().optional().describe("Priority level (e.g., Low, Medium, High, Critical)"),
  owner_email: z.string().email().optional().describe("Email of the project owner"),
  scheduled_start: z.string().optional().describe("Scheduled start date in ISO format"),
  scheduled_end: z.string().optional().describe("Scheduled end date in ISO format"),
  site: z.string().optional().describe("Site/location name"),
  group: z.string().optional().describe("Group responsible for the project"),
});

export const updateProjectSchema = z.object({
  project_id: z.string().describe("ID of the project to update"),
  title: z.string().optional().describe("New project title"),
  description: z.string().optional().describe("New project description"),
  status: z.string().optional().describe("Project status (e.g., Open, In Progress, On Hold, Completed, Cancelled)"),
  priority: z.string().optional().describe("New priority level"),
  owner_email: z.string().email().optional().describe("New owner email"),
  percentage_completion: z.number().min(0).max(100).optional().describe("Completion percentage (0-100)"),
  actual_start: z.string().optional().describe("Actual start date in ISO format"),
  actual_end: z.string().optional().describe("Actual end date in ISO format"),
});

export const getProjectSchema = z.object({
  project_id: z.string().describe("ID of the project to retrieve"),
});

export const listProjectsSchema = z.object({
  status: z.string().optional().describe("Filter by status"),
  owner: z.string().optional().describe("Filter by owner name or email"),
  page: z.number().optional().default(1).describe("Page number"),
  per_page: z.number().optional().default(20).describe("Results per page"),
  sort_by: z.string().optional().describe("Field to sort by (e.g., created_time, title)"),
  sort_order: z.enum(['asc', 'desc']).optional().describe("Sort order"),
});

// Task schemas
export const createTaskSchema = z.object({
  title: z.string().describe("Task title"),
  description: z.string().optional().describe("Task description"),
  project_id: z.string().describe("ID of the project this task belongs to"),
  milestone_id: z.string().optional().describe("ID of the milestone this task belongs to"),
  owner_email: z.string().email().optional().describe("Email of the task owner"),
  group: z.string().optional().describe("Group responsible for the task"),
  priority: z.string().optional().describe("Priority level (e.g., Low, Medium, High, Critical)"),
  task_type: z.string().optional().describe("Type of task"),
  scheduled_start: z.string().optional().describe("Scheduled start date in ISO format"),
  scheduled_end: z.string().optional().describe("Scheduled end date in ISO format"),
  estimated_hours: z.number().optional().describe("Estimated hours to complete"),
  parent_task_id: z.string().optional().describe("ID of the parent task (for subtasks)"),
});

export const updateTaskSchema = z.object({
  task_id: z.string().describe("ID of the task to update"),
  title: z.string().optional().describe("New task title"),
  description: z.string().optional().describe("New task description"),
  status: z.string().optional().describe("Task status (e.g., Open, In Progress, On Hold, Completed, Cancelled)"),
  priority: z.string().optional().describe("New priority level"),
  owner_email: z.string().email().optional().describe("New owner email"),
  percentage_completion: z.number().min(0).max(100).optional().describe("Completion percentage (0-100)"),
  actual_start: z.string().optional().describe("Actual start date in ISO format"),
  actual_end: z.string().optional().describe("Actual end date in ISO format"),
  actual_hours: z.number().optional().describe("Actual hours spent"),
});

export const completeTaskSchema = z.object({
  task_id: z.string().describe("ID of the task to complete"),
  completion_comments: z.string().optional().describe("Comments about task completion"),
  actual_hours: z.number().optional().describe("Total hours spent on the task"),
});

export const listProjectTasksSchema = z.object({
  project_id: z.string().describe("ID of the project"),
  milestone_id: z.string().optional().describe("Filter by milestone ID"),
  status: z.string().optional().describe("Filter by status"),
  owner: z.string().optional().describe("Filter by owner name or email"),
  page: z.number().optional().default(1).describe("Page number"),
  per_page: z.number().optional().default(20).describe("Results per page"),
});

// Worklog schemas
export const addWorklogSchema = z.object({
  task_id: z.string().optional().describe("ID of the task (either task_id or project_id required)"),
  project_id: z.string().optional().describe("ID of the project (either task_id or project_id required)"),
  description: z.string().describe("Description of work performed"),
  start_time: z.string().describe("Start time in ISO format"),
  end_time: z.string().describe("End time in ISO format"),
  owner_email: z.string().email().optional().describe("Email of the person who did the work"),
  is_billable: z.boolean().optional().default(true).describe("Whether this time is billable"),
  worklog_type: z.string().optional().describe("Type of work (e.g., Development, Testing, Documentation)"),
}).refine(data => data.task_id || data.project_id, {
  message: "Either task_id or project_id must be provided",
});

// Milestone schemas
export const createMilestoneSchema = z.object({
  project_id: z.string().describe("ID of the project"),
  title: z.string().describe("Milestone title"),
  description: z.string().optional().describe("Milestone description"),
  owner_email: z.string().email().optional().describe("Email of the milestone owner"),
  scheduled_start: z.string().optional().describe("Scheduled start date in ISO format"),
  scheduled_end: z.string().optional().describe("Scheduled end date in ISO format"),
});

export const getProjectSummarySchema = z.object({
  project_id: z.string().describe("ID of the project"),
  include_tasks: z.boolean().optional().default(true).describe("Include task summary"),
  include_milestones: z.boolean().optional().default(true).describe("Include milestone summary"),
  include_worklogs: z.boolean().optional().default(true).describe("Include time tracking summary"),
});