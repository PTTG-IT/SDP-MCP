import { BaseEntity, User, Technician, SDPDate } from '../types.js';

// Project related types
export interface Project extends BaseEntity {
  title: string;
  description?: string;
  project_type?: {
    id: string;
    name: string;
  };
  status: {
    id: string;
    name: string;
  };
  priority?: {
    id: string;
    name: string;
  };
  owner?: User | Technician;
  scheduled_start_time?: SDPDate;
  scheduled_end_time?: SDPDate;
  actual_start_time?: SDPDate;
  actual_end_time?: SDPDate;
  percentage_completion?: number;
  estimated_hours?: number;
  actual_hours?: number;
  site?: {
    id: string;
    name: string;
  };
  group?: {
    id: string;
    name: string;
  };
  display_id?: string;
}

export interface Milestone extends BaseEntity {
  title: string;
  description?: string;
  project: {
    id: string;
    title?: string;
  };
  owner?: User | Technician;
  scheduled_start_time?: SDPDate;
  scheduled_end_time?: SDPDate;
  actual_start_time?: SDPDate;
  actual_end_time?: SDPDate;
  status: {
    id: string;
    name: string;
  };
  percentage_completion?: number;
  display_id?: string;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  project: {
    id: string;
    title?: string;
  };
  milestone?: {
    id: string;
    title?: string;
  };
  owner?: User | Technician;
  group?: {
    id: string;
    name: string;
  };
  status: {
    id: string;
    name: string;
  };
  priority?: {
    id: string;
    name: string;
  };
  task_type?: {
    id: string;
    name: string;
  };
  scheduled_start_time?: SDPDate;
  scheduled_end_time?: SDPDate;
  actual_start_time?: SDPDate;
  actual_end_time?: SDPDate;
  estimated_hours?: number;
  actual_hours?: number;
  percentage_completion?: number;
  parent_task?: {
    id: string;
    title?: string;
  };
  display_id?: string;
}

export interface TaskDependency {
  task: {
    id: string;
    title?: string;
  };
  dependent_task: {
    id: string;
    title?: string;
  };
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
}

export interface Worklog extends BaseEntity {
  task?: {
    id: string;
    title?: string;
  };
  project?: {
    id: string;
    title?: string;
  };
  owner: User | Technician;
  description?: string;
  start_time: SDPDate;
  end_time: SDPDate;
  time_spent: string; // Format: "HH:MM"
  cost?: number;
  is_billable?: boolean;
  worklog_type?: {
    id: string;
    name: string;
  };
}

// Input types for API operations
export interface CreateProjectInput {
  title: string;
  description?: string;
  project_type?: { id: string } | { name: string };
  status?: { id: string } | { name: string };
  priority?: { id: string } | { name: string };
  owner?: { id: string } | { email_id: string };
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  site?: { id: string } | { name: string };
  group?: { id: string } | { name: string };
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  project: { id: string };
  milestone?: { id: string };
  owner?: { id: string } | { email_id: string };
  group?: { id: string } | { name: string };
  status?: { id: string } | { name: string };
  priority?: { id: string } | { name: string };
  task_type?: { id: string } | { name: string };
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  estimated_hours?: number;
  parent_task?: { id: string };
}

export interface CreateWorklogInput {
  task?: { id: string };
  project?: { id: string };
  owner?: { id: string } | { email_id: string };
  description?: string;
  start_time: string;
  end_time: string;
  time_spent?: string;
  is_billable?: boolean;
  worklog_type?: { id: string } | { name: string };
}