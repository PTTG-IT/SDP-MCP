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
} from './common.js';

/**
 * Problem status enum
 */
export const ProblemStatusEnum = z.enum([
  'Open',
  'Closed',
  'Resolved',
  'In Progress',
  'Pending',
]);

/**
 * Problem priority enum
 */
export const ProblemPriorityEnum = z.enum(['Low', 'Medium', 'High', 'Urgent']);

/**
 * Problem impact enum
 */
export const ProblemImpactEnum = z.enum(['Low', 'Medium', 'High', 'Enterprise']);

/**
 * Problem analysis schema
 */
export const ProblemAnalysisSchema = z.object({
  root_cause: OptionalStringSchema,
  symptoms: OptionalStringSchema,
  impact_details: OptionalStringSchema,
});

/**
 * Problem resolution schema
 */
export const ProblemResolutionSchema = z.object({
  content: NonEmptyStringSchema,
  submitted_by: UserReferenceSchema.optional(),
  submitted_on: z.string().datetime().optional(),
  permanent_fix: z.boolean().optional(),
  preventive_measures: OptionalStringSchema,
});

/**
 * Associated entity schema
 */
export const AssociatedEntitySchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
});

/**
 * Problem schema
 */
export const ProblemSchema = z.object({
  id: z.string(),
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  impact: ImpactSchema.optional(),
  urgency: UrgencySchema.optional(),
  category: CategorySchema.optional(),
  subcategory: SubcategorySchema.optional(),
  item: ItemSchema.optional(),
  owner: UserReferenceSchema.optional(),
  group: GroupSchema.optional(),
  site: SiteSchema.optional(),
  due_by_time: z.string().datetime().optional(),
  created_time: z.string().datetime().optional(),
  updated_time: z.string().datetime().optional(),
  resolved_time: z.string().datetime().optional(),
  closed_time: z.string().datetime().optional(),
  analysis: ProblemAnalysisSchema.optional(),
  resolution: ProblemResolutionSchema.optional(),
  associated_requests: z.array(AssociatedEntitySchema).optional(),
  associated_changes: z.array(AssociatedEntitySchema).optional(),
  associated_assets: z.array(AssociatedEntitySchema).optional(),
  workaround: OptionalStringSchema,
  known_error: z.boolean().optional(),
  udf_fields: UDFFieldsSchema,
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Problem creation schema
 */
export const CreateProblemSchema = z.object({
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  priority: ProblemPriorityEnum.optional(),
  impact: ProblemImpactEnum.optional(),
  urgency: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional(),
  category: CategorySchema.optional(),
  subcategory: SubcategorySchema.optional(),
  item: ItemSchema.optional(),
  owner: EntityReferenceSchema.optional(),
  group: EntityReferenceSchema.optional(),
  site: EntityReferenceSchema.optional(),
  due_by_time: FutureDateTimeSchema.optional(),
  analysis: ProblemAnalysisSchema.optional(),
  workaround: OptionalStringSchema,
  known_error: z.boolean().optional(),
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
 * Problem update schema
 */
export const UpdateProblemSchema = CreateProblemSchema.partial().extend({
  status: ProblemStatusEnum.optional(),
});

/**
 * Problem analysis parameters schema
 */
export const ProblemAnalysisParamsSchema = z.object({
  root_cause: OptionalStringSchema,
  symptoms: OptionalStringSchema,
  impact_details: OptionalStringSchema,
  workaround: OptionalStringSchema,
}).refine(
  (data) => {
    // At least one field should be provided
    return data.root_cause || data.symptoms || data.impact_details || data.workaround;
  },
  {
    message: 'At least one analysis field must be provided',
  }
);

/**
 * Problem resolution parameters schema
 */
export const ProblemResolutionParamsSchema = z.object({
  content: NonEmptyStringSchema,
  permanent_fix: z.boolean().optional(),
  preventive_measures: OptionalStringSchema,
});

/**
 * Problem list parameters schema
 */
export const ListProblemParamsSchema = ListParamsSchema;

/**
 * Problem list response schema
 */
export const ProblemListResponseSchema = z.object({
  problems: z.array(ProblemSchema),
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
 * Problem statistics schema
 */
export const ProblemStatisticsSchema = z.object({
  open: z.number().nonnegative(),
  closed: z.number().nonnegative(),
  resolved: z.number().nonnegative(),
  known_errors: z.number().nonnegative(),
  high_priority: z.number().nonnegative(),
});

/**
 * Problem association schema
 */
export const ProblemAssociationSchema = z.object({
  entity_type: z.enum(['request', 'change', 'asset']),
  entity_id: z.string().min(1),
});

/**
 * Known error database entry schema
 */
export const KnownErrorSchema = z.object({
  problem_id: z.string(),
  title: NonEmptyStringSchema,
  description: OptionalStringSchema,
  root_cause: NonEmptyStringSchema,
  workaround: NonEmptyStringSchema,
  solution: OptionalStringSchema,
  created_by: UserReferenceSchema,
  created_time: z.string().datetime(),
  updated_time: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Problem validation helpers
 */
export const validateProblemPriority = (priority: string): boolean => {
  return ProblemPriorityEnum.safeParse(priority).success;
};

export const validateProblemStatus = (status: string): boolean => {
  return ProblemStatusEnum.safeParse(status).success;
};

export const validateProblemImpact = (impact: string): boolean => {
  return ProblemImpactEnum.safeParse(impact).success;
};

/**
 * Type exports
 */
export type Problem = z.infer<typeof ProblemSchema>;
export type CreateProblemParams = z.infer<typeof CreateProblemSchema>;
export type UpdateProblemParams = z.infer<typeof UpdateProblemSchema>;
export type ProblemAnalysisParams = z.infer<typeof ProblemAnalysisParamsSchema>;
export type ProblemResolutionParams = z.infer<typeof ProblemResolutionParamsSchema>;
export type ListProblemParams = z.infer<typeof ListProblemParamsSchema>;
export type ProblemListResponse = z.infer<typeof ProblemListResponseSchema>;
export type ProblemStatistics = z.infer<typeof ProblemStatisticsSchema>;
export type ProblemAssociation = z.infer<typeof ProblemAssociationSchema>;
export type KnownError = z.infer<typeof KnownErrorSchema>;