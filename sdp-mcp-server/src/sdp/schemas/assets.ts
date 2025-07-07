import { z } from 'zod';
import {
  UserReferenceSchema,
  StatusSchema,
  DepartmentSchema,
  AttachmentSchema,
  UDFFieldsSchema,
  ListParamsSchema,
  NonEmptyStringSchema,
  OptionalStringSchema,
  EntityReferenceSchema,
  CostSchema,
} from './common.js';

/**
 * Asset state enum
 */
export const AssetStateEnum = z.enum([
  'In Use',
  'In Stock',
  'In Repair',
  'Disposed',
  'Expired',
  'Loaned',
]);

/**
 * Asset type category enum
 */
export const AssetTypeCategoryEnum = z.enum([
  'Hardware',
  'Software',
  'Document',
  'Contract',
]);

/**
 * Asset criticality enum
 */
export const AssetCriticalityEnum = z.enum(['Low', 'Medium', 'High', 'Critical']);

/**
 * Asset location schema
 */
export const AssetLocationSchema = z.union([
  z.object({ id: z.string() }),
  z.object({ name: z.string() }),
  z.object({
    building: z.string(),
    floor: z.string().optional(),
    room: z.string().optional(),
  }),
]);

/**
 * Asset relationship schema
 */
export const AssetRelationshipSchema = z.object({
  id: z.string(),
  name: z.string(),
  relationship_type: z.enum([
    'Parent',
    'Child',
    'Connected To',
    'Depends On',
    'Used By',
    'Installed On',
  ]),
});

/**
 * Asset contract schema
 */
export const AssetContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  contract_number: z.string(),
  expiry_date: z.string().datetime().optional(),
});

/**
 * Asset history entry schema
 */
export const AssetHistoryEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  performed_by: UserReferenceSchema,
  performed_time: z.string().datetime(),
  comments: OptionalStringSchema,
  field_changes: z.array(z.object({
    field: z.string(),
    old_value: z.any(),
    new_value: z.any(),
  })).optional(),
});

/**
 * Asset configuration schema
 */
export const AssetConfigurationSchema = z.record(z.string(), z.any());

/**
 * Base asset schema
 */
export const AssetSchema = z.object({
  id: z.string(),
  name: NonEmptyStringSchema,
  asset_tag: OptionalStringSchema,
  serial_number: OptionalStringSchema,
  state: z.object({
    id: z.string().optional(),
    name: AssetStateEnum.optional(),
  }).optional(),
  asset_type: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  product: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  vendor: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  location: AssetLocationSchema.optional(),
  department: DepartmentSchema.optional(),
  assigned_to: UserReferenceSchema.optional(),
  impact: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  criticality: z.object({
    id: z.string().optional(),
    name: AssetCriticalityEnum.optional(),
  }).optional(),
  acquisition_date: z.string().datetime().optional(),
  expiry_date: z.string().datetime().optional(),
  warranty_expiry_date: z.string().datetime().optional(),
  cost: CostSchema.optional(),
  salvage_value: CostSchema.optional(),
  configuration: AssetConfigurationSchema.optional(),
  relationships: z.object({
    parent_asset: z.object({
      id: z.string(),
      name: z.string(),
    }).optional(),
    child_assets: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })).optional(),
    connected_assets: z.array(AssetRelationshipSchema).optional(),
  }).optional(),
  contracts: z.array(AssetContractSchema).optional(),
  history: z.array(AssetHistoryEntrySchema).optional(),
  udf_fields: UDFFieldsSchema,
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * Computer asset schema (extends Asset)
 */
export const ComputerAssetSchema = AssetSchema.extend({
  os_name: OptionalStringSchema,
  os_version: OptionalStringSchema,
  cpu_model: OptionalStringSchema,
  cpu_speed: OptionalStringSchema,
  cpu_count: z.number().positive().optional(),
  memory_size: z.number().positive().optional(),
  disk_space: z.number().positive().optional(),
  mac_address: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional(),
  ip_address: z.string().ip().optional(),
  domain: OptionalStringSchema,
  last_logged_user: OptionalStringSchema,
  last_scan_time: z.string().datetime().optional(),
});

/**
 * Asset creation schema
 */
export const CreateAssetSchema = z.object({
  name: NonEmptyStringSchema,
  asset_tag: OptionalStringSchema,
  serial_number: OptionalStringSchema,
  state: AssetStateEnum.optional(),
  asset_type: EntityReferenceSchema.optional(),
  product: EntityReferenceSchema.optional(),
  vendor: EntityReferenceSchema.optional(),
  location: AssetLocationSchema.optional(),
  department: EntityReferenceSchema.optional(),
  assigned_to: EntityReferenceSchema.optional(),
  impact: z.enum(['Low', 'Medium', 'High']).optional(),
  criticality: AssetCriticalityEnum.optional(),
  acquisition_date: z.string().datetime().optional(),
  expiry_date: z.string().datetime().optional(),
  warranty_expiry_date: z.string().datetime().optional(),
  cost: z.object({
    amount: z.number().nonnegative(),
    currency: z.string().length(3).default('USD'),
  }).optional(),
  configuration: AssetConfigurationSchema.optional(),
  udf_fields: UDFFieldsSchema,
}).refine(
  (data) => {
    // Ensure asset tag or serial number is provided
    if (!data.asset_tag && !data.serial_number) {
      return false;
    }
    return true;
  },
  {
    message: 'Either asset tag or serial number must be provided',
  }
);

/**
 * Asset update schema
 */
export const UpdateAssetSchema = CreateAssetSchema.partial();

/**
 * Asset scan parameters schema
 */
export const AssetScanParamsSchema = z.object({
  scan_type: z.enum(['full', 'incremental']).default('full'),
  ip_range: z.string().optional(),
  domain: z.string().optional(),
}).refine(
  (data) => {
    // At least one scan target must be provided
    return data.ip_range || data.domain;
  },
  {
    message: 'Either IP range or domain must be provided for scanning',
  }
);

/**
 * Asset relationship parameters schema
 */
export const AssetRelationshipParamsSchema = z.object({
  relationship_type: z.enum([
    'Parent',
    'Child',
    'Connected To',
    'Depends On',
    'Used By',
    'Installed On',
  ]),
  target_asset_id: z.string().min(1),
  description: OptionalStringSchema,
});

/**
 * Asset list parameters schema
 */
export const ListAssetParamsSchema = ListParamsSchema;

/**
 * Asset list response schema
 */
export const AssetListResponseSchema = z.object({
  assets: z.array(AssetSchema),
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
 * Computer asset list response schema
 */
export const ComputerAssetListResponseSchema = z.object({
  computers: z.array(ComputerAssetSchema),
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
 * Asset statistics schema
 */
export const AssetStatisticsSchema = z.object({
  total: z.number().nonnegative(),
  in_use: z.number().nonnegative(),
  in_stock: z.number().nonnegative(),
  expired: z.number().nonnegative(),
  critical: z.number().nonnegative(),
});

/**
 * Asset depreciation schema
 */
export const AssetDepreciationSchema = z.object({
  method: z.enum(['Straight Line', 'Declining Balance', 'Sum of Years']),
  useful_life_years: z.number().positive(),
  current_value: CostSchema,
  depreciation_rate: z.number().min(0).max(100),
  accumulated_depreciation: CostSchema,
});

/**
 * Asset maintenance schema
 */
export const AssetMaintenanceSchema = z.object({
  id: z.string(),
  type: z.enum(['Preventive', 'Corrective', 'Predictive']),
  description: NonEmptyStringSchema,
  scheduled_date: z.string().datetime(),
  completed_date: z.string().datetime().optional(),
  performed_by: UserReferenceSchema.optional(),
  cost: CostSchema.optional(),
  next_maintenance_date: z.string().datetime().optional(),
});

/**
 * Asset validation helpers
 */
export const validateAssetState = (state: string): boolean => {
  return AssetStateEnum.safeParse(state).success;
};

export const validateAssetCriticality = (criticality: string): boolean => {
  return AssetCriticalityEnum.safeParse(criticality).success;
};

export const validateAssetTypeCategory = (category: string): boolean => {
  return AssetTypeCategoryEnum.safeParse(category).success;
};

/**
 * Type exports
 */
export type Asset = z.infer<typeof AssetSchema>;
export type ComputerAsset = z.infer<typeof ComputerAssetSchema>;
export type CreateAssetParams = z.infer<typeof CreateAssetSchema>;
export type UpdateAssetParams = z.infer<typeof UpdateAssetSchema>;
export type AssetScanParams = z.infer<typeof AssetScanParamsSchema>;
export type AssetRelationshipParams = z.infer<typeof AssetRelationshipParamsSchema>;
export type ListAssetParams = z.infer<typeof ListAssetParamsSchema>;
export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;
export type ComputerAssetListResponse = z.infer<typeof ComputerAssetListResponseSchema>;
export type AssetStatistics = z.infer<typeof AssetStatisticsSchema>;
export type AssetDepreciation = z.infer<typeof AssetDepreciationSchema>;
export type AssetMaintenance = z.infer<typeof AssetMaintenanceSchema>;