import { z } from 'zod';
import {
  UserReferenceSchema,
  StatusSchema,
  PrioritySchema,
  UrgencySchema,
  ImpactSchema,
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
} from './common.js';

/**
 * Request status enum
 */
export const RequestStatusEnum = z.enum([
  'Open',
  'Closed',
  'Resolved',
  'Cancelled',
  'On Hold',
  'In Progress',
]);

/**
 * Request priority enum
 */
export const RequestPriorityEnum = z.enum(['Low', 'Medium', 'High', 'Urgent']);

/**
 * Request urgency enum
 */
export const RequestUrgencyEnum = z.enum(['Low', 'Normal', 'High', 'Urgent']);

/**
 * Request impact enum
 */
export const RequestImpactEnum = z.enum([
  'Low',
  'Affecting Department',
  'Affecting Business',
  'Affecting Group',
]);

/**
 * Request schema
 */
export const RequestSchema = z.object({
  id: z.string(),
  subject: NonEmptyStringSchema,
  description: OptionalStringSchema,
  requester: UserReferenceSchema.optional(),
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  urgency: UrgencySchema.optional(),
  impact: ImpactSchema.optional(),
  category: CategorySchema.optional(),
  subcategory: SubcategorySchema.optional(),
  item: ItemSchema.optional(),
  technician: UserReferenceSchema.optional(),
  group: GroupSchema.optional(),
  site: SiteSchema.optional(),
  created_time: z.string().datetime().optional(),
  due_by_time: z.string().datetime().optional(),
  resolved_time: z.string().datetime().optional(),
  closed_time: z.string().datetime().optional(),
  response_due_by_time: z.string().datetime().optional(),
  first_response_time: z.string().datetime().optional(),
  udf_fields: UDFFieldsSchema,
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Request creation schema
 */
export const CreateRequestSchema = z.object({
  subject: NonEmptyStringSchema,
  description: OptionalStringSchema,
  requester: UserReferenceSchema.optional(),
  priority: RequestPriorityEnum.optional(),
  urgency: RequestUrgencyEnum.optional(),
  impact: RequestImpactEnum.optional(),
  category: CategorySchema.optional(),
  subcategory: SubcategorySchema.optional(),
  item: ItemSchema.optional(),
  technician: EntityReferenceSchema.optional(),
  group: EntityReferenceSchema.optional(),
  site: EntityReferenceSchema.optional(),
  due_by_time: FutureDateTimeSchema.optional(),
  udf_fields: UDFFieldsSchema,
}).refine(
  (data) => {
    // Ensure subcategory has category
    if (data.subcategory && !data.category) {
      return false;
    }
    // Ensure item has subcategory
    if (data.item && !data.subcategory) {
      return false;
    }
    return true;
  },
  {
    message: 'Category hierarchy must be maintained (category -> subcategory -> item)',
  }
);

/**
 * Request update schema
 */
export const UpdateRequestSchema = CreateRequestSchema.partial().extend({
  status: RequestStatusEnum.optional(),
});

/**
 * Request close schema
 */
export const CloseRequestSchema = z.object({
  closure_code: EntityReferenceSchema.optional(),
  closure_comments: OptionalStringSchema,
  requester_ack_resolution: z.boolean().optional(),
  requester_ack_comments: OptionalStringSchema,
}).refine(
  (data) => {
    // If requester acknowledged, comments might be required
    if (data.requester_ack_resolution === false && !data.requester_ack_comments) {
      return false;
    }
    return true;
  },
  {
    message: 'Requester acknowledgment comments required when resolution is not acknowledged',
  }
);

/**
 * Request pickup schema
 */
export const PickupRequestSchema = z.object({
  technician: EntityReferenceSchema.optional(),
});

/**
 * Request list parameters schema
 */
export const ListRequestParamsSchema = ListParamsSchema;

/**
 * Request list response schema
 */
export const RequestListResponseSchema = z.object({
  requests: z.array(RequestSchema),
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
 * Request statistics schema
 */
export const RequestStatisticsSchema = z.object({
  open: z.number().nonnegative(),
  closed: z.number().nonnegative(),
  overdue: z.number().nonnegative(),
  on_hold: z.number().nonnegative(),
});

/**
 * Request note schema
 */
export const RequestNoteSchema = z.object({
  description: NonEmptyStringSchema,
  notify_technician: z.boolean().default(false),
});

/**
 * Request time entry schema
 */
export const RequestTimeEntrySchema = z.object({
  time_spent: z.number().positive('Time spent must be positive'),
  technician: EntityReferenceSchema.optional(),
  work_description: NonEmptyStringSchema,
  work_date: z.string().datetime().optional(),
});

/**
 * Request resolution schema
 */
export const RequestResolutionSchema = z.object({
  content: NonEmptyStringSchema,
  submitted_by: UserReferenceSchema.optional(),
  submitted_on: z.string().datetime().optional(),
});

/**
 * Request validation helpers
 */
export const validateRequestPriority = (priority: string): boolean => {
  return RequestPriorityEnum.safeParse(priority).success;
};

export const validateRequestStatus = (status: string): boolean => {
  return RequestStatusEnum.safeParse(status).success;
};

export const validateRequestUrgency = (urgency: string): boolean => {
  return RequestUrgencyEnum.safeParse(urgency).success;
};

export const validateRequestImpact = (impact: string): boolean => {
  return RequestImpactEnum.safeParse(impact).success;
};

/**
 * Type exports
 */
export type Request = z.infer<typeof RequestSchema>;
export type CreateRequestParams = z.infer<typeof CreateRequestSchema>;
export type UpdateRequestParams = z.infer<typeof UpdateRequestSchema>;
export type CloseRequestParams = z.infer<typeof CloseRequestSchema>;
export type PickupRequestParams = z.infer<typeof PickupRequestSchema>;
export type ListRequestParams = z.infer<typeof ListRequestParamsSchema>;
export type RequestListResponse = z.infer<typeof RequestListResponseSchema>;
export type RequestStatistics = z.infer<typeof RequestStatisticsSchema>;
export type RequestNote = z.infer<typeof RequestNoteSchema>;
export type RequestTimeEntry = z.infer<typeof RequestTimeEntrySchema>;
export type RequestResolution = z.infer<typeof RequestResolutionSchema>;