import { z } from 'zod';

/**
 * Common schemas used across multiple SDP modules
 */

/**
 * ID reference schema - used for referencing entities by ID
 */
export const IdReferenceSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

/**
 * Name reference schema - used for referencing entities by name
 */
export const NameReferenceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

/**
 * Email reference schema - used for referencing users by email
 */
export const EmailReferenceSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Entity reference schema - can reference by ID, name, or email
 */
export const EntityReferenceSchema = z.union([
  IdReferenceSchema,
  NameReferenceSchema,
  EmailReferenceSchema,
]);

/**
 * User reference schema - for requester, technician, etc.
 */
export const UserReferenceSchema = z.union([
  IdReferenceSchema,
  EmailReferenceSchema,
  z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
]);

/**
 * Status schema
 */
export const StatusSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

/**
 * Priority schema
 */
export const PrioritySchema = z.object({
  id: z.string().optional(),
  name: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
});

/**
 * Impact schema
 */
export const ImpactSchema = z.object({
  id: z.string().optional(),
  name: z.enum(['Low', 'Affecting Department', 'Affecting Business', 'Affecting Group', 'Medium', 'High', 'Enterprise']).optional(),
});

/**
 * Urgency schema
 */
export const UrgencySchema = z.object({
  id: z.string().optional(),
  name: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional(),
});

/**
 * Category hierarchy schemas
 */
export const CategorySchema = z.union([
  IdReferenceSchema,
  NameReferenceSchema,
]);

export const SubcategorySchema = z.union([
  IdReferenceSchema,
  NameReferenceSchema,
]);

export const ItemSchema = z.union([
  IdReferenceSchema,
  NameReferenceSchema,
]);

/**
 * Group schema
 */
export const GroupSchema = z.union([
  IdReferenceSchema,
  NameReferenceSchema,
]);

/**
 * Site schema
 */
export const SiteSchema = z.union([
  IdReferenceSchema,
  NameReferenceSchema,
]);

/**
 * Department schema
 */
export const DepartmentSchema = z.union([
  IdReferenceSchema,
  NameReferenceSchema,
]);

/**
 * Attachment schema
 */
export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().positive(),
  content_type: z.string().optional(),
  created_time: z.string().datetime().optional(),
});

/**
 * Cost/Budget schema
 */
export const CostSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default('USD'),
});

/**
 * Time period schema
 */
export const TimePeriodSchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
}).refine(data => new Date(data.end_time) > new Date(data.start_time), {
  message: 'End time must be after start time',
});

/**
 * Pagination parameters
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  page_size: z.number().int().positive().max(100).default(100),
});

/**
 * Sort parameters
 */
export const SortSchema = z.object({
  sort_field: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Search parameters
 */
export const SearchSchema = z.object({
  search_fields: z.record(z.string(), z.string()).optional(),
  filter_by: z.string().optional(),
});

/**
 * List parameters combining pagination, sort, and search
 */
export const ListParamsSchema = PaginationSchema
  .merge(SortSchema)
  .merge(SearchSchema)
  .extend({
    include_details: z.boolean().optional(),
  });

/**
 * UDF (User Defined Fields) schema
 */
export const UDFFieldsSchema = z.record(z.string(), z.any()).optional();

/**
 * Response status schema
 */
export const ResponseStatusSchema = z.object({
  status_code: z.number(),
  status: z.enum(['success', 'failure']),
  messages: z.array(z.object({
    status_code: z.string(),
    message: z.string(),
    type: z.string().optional(),
    field: z.string().optional(),
  })).optional(),
});

/**
 * Page info schema
 */
export const PageInfoSchema = z.object({
  page: z.number(),
  page_size: z.number(),
  total_count: z.number(),
  has_more_rows: z.boolean(),
});

/**
 * Date/Time validation helpers
 */
export const FutureDateTimeSchema = z.string().datetime().refine(
  (val) => new Date(val) > new Date(),
  { message: 'Date must be in the future' }
);

export const PastDateTimeSchema = z.string().datetime().refine(
  (val) => new Date(val) < new Date(),
  { message: 'Date must be in the past' }
);

/**
 * Common field validators
 */
export const NonEmptyStringSchema = z.string().min(1, 'This field cannot be empty');
export const OptionalStringSchema = z.string().optional();
export const EmailSchema = z.string().email('Invalid email format');
export const URLSchema = z.string().url('Invalid URL format');
export const PhoneSchema = z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number format');

/**
 * Approval schema
 */
export const ApprovalSchema = z.object({
  id: z.string(),
  approver: UserReferenceSchema,
  status: z.enum(['Pending', 'Approved', 'Rejected', 'On Hold']),
  comments: z.string().optional(),
  approved_time: z.string().datetime().optional(),
  level: z.string().optional(),
});

/**
 * History/Audit entry schema
 */
export const HistoryEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  performed_by: UserReferenceSchema,
  performed_time: z.string().datetime(),
  comments: z.string().optional(),
  old_value: z.any().optional(),
  new_value: z.any().optional(),
});

/**
 * Notification preference schema
 */
export const NotificationPreferenceSchema = z.object({
  email: z.boolean().default(true),
  sms: z.boolean().default(false),
  push: z.boolean().default(false),
});

/**
 * Create a nullable version of any schema
 */
export function nullable<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.null()]);
}

/**
 * Create an optional nullable version of any schema
 */
export function optionalNullable<T extends z.ZodTypeAny>(schema: T) {
  return z.union([schema, z.null()]).optional();
}