import { z } from 'zod';
import {
  UserReferenceSchema,
  StatusSchema,
  PrioritySchema,
  ImpactSchema,
  UrgencySchema,
  CategorySchema,
  SubcategorySchema,
  ItemSchema,
  GroupSchema,
  SiteSchema,
  AttachmentSchema,
  UDFFieldsSchema,
  ListParamsSchema,
  NonEmptyStringSchema,
  OptionalStringSchema,
  FutureDateTimeSchema,
  EntityReferenceSchema,
  ApprovalSchema,
  TimePeriodSchema,
} from './common.js';

/**
 * Change status enum
 */
export const ChangeStatusEnum = z.enum([
  'Requested',
  'Planning',
  'Awaiting Approval',
  'Approved',
  'Rejected',
  'In Progress',
  'Completed',
  'Closed',
  'Cancelled',
]);

/**
 * Change type enum
 */
export const ChangeTypeEnum = z.enum(['Minor', 'Standard', 'Major', 'Emergency']);

/**
 * Change priority enum
 */
export const ChangePriorityEnum = z.enum(['Low', 'Medium', 'High', 'Urgent']);

/**
 * Change risk enum
 */
export const ChangeRiskEnum = z.enum(['Low', 'Medium', 'High', 'Very High']);

/**
 * Change impact enum
 */
export const ChangeImpactEnum = z.enum(['Low', 'Medium', 'High', 'Enterprise']);

/**
 * Change checklist item schema
 */
export const ChangeChecklistItemSchema = z.object({
  id: z.string(),
  item: NonEmptyStringSchema,
  completed: z.boolean().default(false),
  completed_by: UserReferenceSchema.optional(),
  completed_time: z.string().datetime().optional(),
});

/**
 * Change schema
 */
export const ChangeSchema = z.object({
  id: z.string(),
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  status: StatusSchema.optional(),
  type: z.object({
    id: z.string().optional(),
    name: ChangeTypeEnum.optional(),
  }).optional(),
  priority: PrioritySchema.optional(),
  risk: z.object({
    id: z.string().optional(),
    name: ChangeRiskEnum.optional(),
  }).optional(),
  impact: ImpactSchema.optional(),
  urgency: UrgencySchema.optional(),
  category: CategorySchema.optional(),
  subcategory: SubcategorySchema.optional(),
  item: ItemSchema.optional(),
  change_requester: UserReferenceSchema.optional(),
  change_owner: UserReferenceSchema.optional(),
  change_manager: UserReferenceSchema.optional(),
  group: GroupSchema.optional(),
  site: SiteSchema.optional(),
  scheduled_start_time: z.string().datetime().optional(),
  scheduled_end_time: z.string().datetime().optional(),
  actual_start_time: z.string().datetime().optional(),
  actual_end_time: z.string().datetime().optional(),
  created_time: z.string().datetime().optional(),
  updated_time: z.string().datetime().optional(),
  completed_time: z.string().datetime().optional(),
  closed_time: z.string().datetime().optional(),
  reason_for_change: OptionalStringSchema,
  impact_details: OptionalStringSchema,
  rollout_plan: OptionalStringSchema,
  backout_plan: OptionalStringSchema,
  checklist: z.array(ChangeChecklistItemSchema).optional(),
  approval_status: StatusSchema.optional(),
  approvals: z.array(ApprovalSchema).optional(),
  associated_problems: z.array(z.object({
    id: z.string(),
    title: z.string(),
  })).optional(),
  associated_assets: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  udf_fields: UDFFieldsSchema,
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Change creation schema
 */
export const CreateChangeSchema = z.object({
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  type: ChangeTypeEnum.optional(),
  priority: ChangePriorityEnum.optional(),
  risk: ChangeRiskEnum.optional(),
  impact: ChangeImpactEnum.optional(),
  urgency: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional(),
  category: CategorySchema.optional(),
  subcategory: SubcategorySchema.optional(),
  item: ItemSchema.optional(),
  change_requester: EntityReferenceSchema.optional(),
  change_owner: EntityReferenceSchema.optional(),
  change_manager: EntityReferenceSchema.optional(),
  group: EntityReferenceSchema.optional(),
  site: EntityReferenceSchema.optional(),
  scheduled_start_time: FutureDateTimeSchema.optional(),
  scheduled_end_time: FutureDateTimeSchema.optional(),
  reason_for_change: OptionalStringSchema,
  impact_details: OptionalStringSchema,
  rollout_plan: OptionalStringSchema,
  backout_plan: OptionalStringSchema,
  udf_fields: UDFFieldsSchema,
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
).refine(
  (data) => {
    // Emergency changes should have high priority
    if (data.type === 'Emergency' && data.priority && data.priority !== 'High' && data.priority !== 'Urgent') {
      return false;
    }
    return true;
  },
  {
    message: 'Emergency changes should have High or Urgent priority',
  }
);

/**
 * Change update schema
 */
export const UpdateChangeSchema = CreateChangeSchema.partial().extend({
  status: ChangeStatusEnum.optional(),
  actual_start_time: z.string().datetime().optional(),
  actual_end_time: z.string().datetime().optional(),
});

/**
 * Change approval schema
 */
export const ChangeApprovalSchema = z.object({
  comments: OptionalStringSchema,
  approval_level: OptionalStringSchema,
});

/**
 * Implement change schema
 */
export const ImplementChangeSchema = z.object({
  implementation_comments: OptionalStringSchema,
  actual_start_time: z.string().datetime().optional(),
});

/**
 * Complete change schema
 */
export const CompleteChangeSchema = z.object({
  completion_comments: OptionalStringSchema,
  actual_end_time: z.string().datetime().optional(),
  implementation_success: z.boolean().default(true),
});

/**
 * Change list parameters schema
 */
export const ListChangeParamsSchema = ListParamsSchema;

/**
 * Change list response schema
 */
export const ChangeListResponseSchema = z.object({
  changes: z.array(ChangeSchema),
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
 * Change statistics schema
 */
export const ChangeStatisticsSchema = z.object({
  requested: z.number().nonnegative(),
  awaiting_approval: z.number().nonnegative(),
  approved: z.number().nonnegative(),
  in_progress: z.number().nonnegative(),
  completed: z.number().nonnegative(),
  emergency: z.number().nonnegative(),
});

/**
 * Change impact assessment schema
 */
export const ChangeImpactAssessmentSchema = z.object({
  affected_services: z.array(z.string()),
  affected_users_count: z.number().nonnegative(),
  downtime_required: z.boolean(),
  downtime_duration: z.number().optional(),
  business_impact: NonEmptyStringSchema,
  technical_impact: NonEmptyStringSchema,
  risk_assessment: NonEmptyStringSchema,
});

/**
 * Change advisory board (CAB) schema
 */
export const CABMeetingSchema = z.object({
  meeting_date: FutureDateTimeSchema,
  attendees: z.array(UserReferenceSchema),
  agenda: NonEmptyStringSchema,
  changes_to_review: z.array(z.string()),
  meeting_notes: OptionalStringSchema,
  decisions: z.array(z.object({
    change_id: z.string(),
    decision: z.enum(['Approved', 'Rejected', 'Deferred']),
    comments: OptionalStringSchema,
  })).optional(),
});

/**
 * Change validation helpers
 */
export const validateChangeType = (type: string): boolean => {
  return ChangeTypeEnum.safeParse(type).success;
};

export const validateChangeStatus = (status: string): boolean => {
  return ChangeStatusEnum.safeParse(status).success;
};

export const validateChangeRisk = (risk: string): boolean => {
  return ChangeRiskEnum.safeParse(risk).success;
};

export const validateChangePriority = (priority: string): boolean => {
  return ChangePriorityEnum.safeParse(priority).success;
};

export const validateChangeImpact = (impact: string): boolean => {
  return ChangeImpactEnum.safeParse(impact).success;
};

/**
 * Type exports
 */
export type Change = z.infer<typeof ChangeSchema>;
export type CreateChangeParams = z.infer<typeof CreateChangeSchema>;
export type UpdateChangeParams = z.infer<typeof UpdateChangeSchema>;
export type ChangeApprovalParams = z.infer<typeof ChangeApprovalSchema>;
export type ImplementChangeParams = z.infer<typeof ImplementChangeSchema>;
export type CompleteChangeParams = z.infer<typeof CompleteChangeSchema>;
export type ListChangeParams = z.infer<typeof ListChangeParamsSchema>;
export type ChangeListResponse = z.infer<typeof ChangeListResponseSchema>;
export type ChangeStatistics = z.infer<typeof ChangeStatisticsSchema>;
export type ChangeImpactAssessment = z.infer<typeof ChangeImpactAssessmentSchema>;
export type CABMeeting = z.infer<typeof CABMeetingSchema>;