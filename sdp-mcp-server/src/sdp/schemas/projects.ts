import { z } from 'zod';
import {
  UserReferenceSchema,
  StatusSchema,
  PrioritySchema,
  SiteSchema,
  DepartmentSchema,
  AttachmentSchema,
  UDFFieldsSchema,
  ListParamsSchema,
  NonEmptyStringSchema,
  OptionalStringSchema,
  FutureDateTimeSchema,
  EntityReferenceSchema,
  CostSchema,
} from './common.js';

/**
 * Project status enum
 */
export const ProjectStatusEnum = z.enum([
  'Open',
  'In Progress',
  'On Hold',
  'Completed',
  'Cancelled',
  'Closed',
]);

/**
 * Project priority enum
 */
export const ProjectPriorityEnum = z.enum(['Low', 'Medium', 'High', 'Urgent']);

/**
 * Milestone status enum
 */
export const MilestoneStatusEnum = z.enum([
  'Open',
  'In Progress',
  'Completed',
  'Overdue',
]);

/**
 * Task status enum
 */
export const TaskStatusEnum = z.enum([
  'Open',
  'In Progress',
  'Completed',
  'Cancelled',
  'On Hold',
]);

/**
 * Task priority enum
 */
export const TaskPriorityEnum = z.enum(['Low', 'Medium', 'High', 'Urgent']);

/**
 * Project member schema
 */
export const ProjectMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  allocation_percentage: z.number().min(0).max(100).optional(),
});

/**
 * Task dependency schema
 */
export const TaskDependencySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish']).optional(),
});

/**
 * Task schema
 */
export const TaskSchema = z.object({
  id: z.string(),
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  status: z.object({
    id: z.string().optional(),
    name: TaskStatusEnum.optional(),
  }).optional(),
  priority: z.object({
    id: z.string().optional(),
    name: TaskPriorityEnum.optional(),
  }).optional(),
  owner: UserReferenceSchema.optional(),
  assigned_to: UserReferenceSchema.optional(),
  scheduled_start_time: z.string().datetime().optional(),
  scheduled_end_time: z.string().datetime().optional(),
  actual_start_time: z.string().datetime().optional(),
  actual_end_time: z.string().datetime().optional(),
  estimated_hours: z.number().nonnegative().optional(),
  actual_hours: z.number().nonnegative().optional(),
  percentage_completion: z.number().min(0).max(100).optional(),
  dependencies: z.array(TaskDependencySchema).optional(),
});

/**
 * Milestone schema
 */
export const MilestoneSchema = z.object({
  id: z.string(),
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  status: z.object({
    id: z.string().optional(),
    name: MilestoneStatusEnum.optional(),
  }).optional(),
  owner: UserReferenceSchema.optional(),
  scheduled_start_date: z.string().datetime().optional(),
  scheduled_end_date: z.string().datetime().optional(),
  actual_start_date: z.string().datetime().optional(),
  actual_end_date: z.string().datetime().optional(),
  percentage_completion: z.number().min(0).max(100).optional(),
  tasks: z.array(TaskSchema).optional(),
});

/**
 * Project budget schema
 */
export const ProjectBudgetSchema = z.object({
  allocated: z.number().nonnegative().optional(),
  spent: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('USD'),
});

/**
 * Project schema
 */
export const ProjectSchema = z.object({
  id: z.string(),
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  status: z.object({
    id: z.string().optional(),
    name: ProjectStatusEnum.optional(),
  }).optional(),
  priority: z.object({
    id: z.string().optional(),
    name: ProjectPriorityEnum.optional(),
  }).optional(),
  project_type: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  owner: UserReferenceSchema.optional(),
  project_manager: UserReferenceSchema.optional(),
  site: SiteSchema.optional(),
  department: DepartmentSchema.optional(),
  scheduled_start_date: z.string().datetime().optional(),
  scheduled_end_date: z.string().datetime().optional(),
  actual_start_date: z.string().datetime().optional(),
  actual_end_date: z.string().datetime().optional(),
  created_time: z.string().datetime().optional(),
  updated_time: z.string().datetime().optional(),
  completed_time: z.string().datetime().optional(),
  percentage_completion: z.number().min(0).max(100).optional(),
  estimated_hours: z.number().nonnegative().optional(),
  actual_hours: z.number().nonnegative().optional(),
  budget: ProjectBudgetSchema.optional(),
  members: z.array(ProjectMemberSchema).optional(),
  milestones: z.array(MilestoneSchema).optional(),
  associated_assets: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  associated_changes: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })).optional(),
  udf_fields: UDFFieldsSchema,
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Project creation schema
 */
export const CreateProjectSchema = z.object({
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  priority: ProjectPriorityEnum.optional(),
  project_type: EntityReferenceSchema.optional(),
  owner: EntityReferenceSchema.optional(),
  project_manager: EntityReferenceSchema.optional(),
  site: EntityReferenceSchema.optional(),
  department: EntityReferenceSchema.optional(),
  scheduled_start_date: FutureDateTimeSchema.optional(),
  scheduled_end_date: FutureDateTimeSchema.optional(),
  estimated_hours: z.number().nonnegative().optional(),
  budget: z.object({
    allocated: z.number().nonnegative().optional(),
    currency: z.string().length(3).default('USD'),
  }).optional(),
  udf_fields: UDFFieldsSchema,
}).refine(
  (data) => {
    // Ensure scheduled end date is after start date
    if (data.scheduled_start_date && data.scheduled_end_date) {
      return new Date(data.scheduled_end_date) > new Date(data.scheduled_start_date);
    }
    return true;
  },
  {
    message: 'Scheduled end date must be after scheduled start date',
  }
);

/**
 * Project update schema
 */
export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  status: ProjectStatusEnum.optional(),
  actual_start_date: z.string().datetime().optional(),
  actual_end_date: z.string().datetime().optional(),
  percentage_completion: z.number().min(0).max(100).optional(),
  actual_hours: z.number().nonnegative().optional(),
});

/**
 * Milestone creation schema
 */
export const CreateMilestoneSchema = z.object({
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  owner: EntityReferenceSchema.optional(),
  scheduled_start_date: FutureDateTimeSchema.optional(),
  scheduled_end_date: FutureDateTimeSchema.optional(),
}).refine(
  (data) => {
    // Ensure scheduled end date is after start date
    if (data.scheduled_start_date && data.scheduled_end_date) {
      return new Date(data.scheduled_end_date) > new Date(data.scheduled_start_date);
    }
    return true;
  },
  {
    message: 'Scheduled end date must be after scheduled start date',
  }
);

/**
 * Task creation schema
 */
export const CreateTaskSchema = z.object({
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  priority: TaskPriorityEnum.optional(),
  owner: EntityReferenceSchema.optional(),
  assigned_to: EntityReferenceSchema.optional(),
  scheduled_start_time: FutureDateTimeSchema.optional(),
  scheduled_end_time: FutureDateTimeSchema.optional(),
  estimated_hours: z.number().nonnegative().optional(),
}).refine(
  (data) => {
    // Ensure scheduled end time is after start time
    if (data.scheduled_start_time && data.scheduled_end_time) {
      return new Date(data.scheduled_end_time) > new Date(data.scheduled_start_time);
    }
    return true;
  },
  {
    message: 'Scheduled end time must be after scheduled start time',
  }
);

/**
 * Task update schema
 */
export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  status: TaskStatusEnum.optional(),
  actual_hours: z.number().nonnegative().optional(),
  percentage_completion: z.number().min(0).max(100).optional(),
});

/**
 * Project member add schema
 */
export const AddProjectMemberSchema = z.object({
  member: EntityReferenceSchema,
  role: OptionalStringSchema,
  allocation_percentage: z.number().min(0).max(100).optional(),
});

/**
 * Project list parameters schema
 */
export const ListProjectParamsSchema = ListParamsSchema;

/**
 * Project list response schema
 */
export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectSchema),
  response_status: z.object({
    status_code: z.number(),
    status: z.string(),
  }),
  page_info: z.object({
    page: z.number(),
    page_size: z.number(),
    total_count: z.number(),
    has_more_rows: z.boolean(),
  }).optional(),
});

/**
 * Project statistics schema
 */
export const ProjectStatisticsSchema = z.object({
  open: z.number().nonnegative(),
  in_progress: z.number().nonnegative(),
  completed: z.number().nonnegative(),
  overdue: z.number().nonnegative(),
  on_hold: z.number().nonnegative(),
});

/**
 * Project health status schema
 */
export const ProjectHealthSchema = z.object({
  overall_health: z.enum(['Healthy', 'At Risk', 'Critical']),
  schedule_health: z.enum(['On Track', 'Behind Schedule', 'Ahead of Schedule']),
  budget_health: z.enum(['Under Budget', 'On Budget', 'Over Budget']),
  resource_health: z.enum(['Adequate', 'Stretched', 'Critical']),
  risk_score: z.number().min(0).max(100),
});

/**
 * Project validation helpers
 */
export const validateProjectStatus = (status: string): boolean => {
  return ProjectStatusEnum.safeParse(status).success;
};

export const validateProjectPriority = (priority: string): boolean => {
  return ProjectPriorityEnum.safeParse(priority).success;
};

export const validateMilestoneStatus = (status: string): boolean => {
  return MilestoneStatusEnum.safeParse(status).success;
};

export const validateTaskStatus = (status: string): boolean => {
  return TaskStatusEnum.safeParse(status).success;
};

export const validateTaskPriority = (priority: string): boolean => {
  return TaskPriorityEnum.safeParse(priority).success;
};

/**
 * Type exports
 */
export type Project = z.infer<typeof ProjectSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type CreateProjectParams = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectParams = z.infer<typeof UpdateProjectSchema>;
export type CreateMilestoneParams = z.infer<typeof CreateMilestoneSchema>;
export type CreateTaskParams = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskParams = z.infer<typeof UpdateTaskSchema>;
export type AddProjectMemberParams = z.infer<typeof AddProjectMemberSchema>;
export type ListProjectParams = z.infer<typeof ListProjectParamsSchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type ProjectStatistics = z.infer<typeof ProjectStatisticsSchema>;
export type ProjectHealth = z.infer<typeof ProjectHealthSchema>;