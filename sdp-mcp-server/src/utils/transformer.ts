import { logger } from '../monitoring/logging.js';

/**
 * Transform MCP tool input to SDP API format
 */
export class RequestTransformer {
  /**
   * Transform create request input
   */
  static transformCreateRequest(input: any): any {
    const transformed: any = {
      subject: input.subject,
      description: input.description,
    };

    // Transform requester
    if (input.requester) {
      transformed.requester = this.transformEntityReference(input.requester);
    }

    // Transform category
    if (input.category) {
      transformed.category = this.transformEntityReference(input.category);
    }

    // Transform priority
    if (input.priority) {
      transformed.priority = this.transformEntityReference(input.priority);
    }

    // Transform status
    if (input.status) {
      transformed.status = this.transformEntityReference(input.status);
    }

    // Transform site
    if (input.site) {
      transformed.site = this.transformEntityReference(input.site);
    }

    // Transform group
    if (input.group) {
      transformed.group = this.transformEntityReference(input.group);
    }

    // Transform technician
    if (input.technician) {
      transformed.technician = this.transformEntityReference(input.technician);
    }

    // Transform impact
    if (input.impact) {
      transformed.impact = this.transformEntityReference(input.impact);
    }

    // Transform urgency
    if (input.urgency) {
      transformed.urgency = this.transformEntityReference(input.urgency);
    }

    // Transform level
    if (input.level) {
      transformed.level = this.transformEntityReference(input.level);
    }

    // Transform mode
    if (input.mode) {
      transformed.mode = this.transformEntityReference(input.mode);
    }

    // Add UDF fields if present
    if (input.udf_fields) {
      transformed.udf_fields = input.udf_fields;
    }

    return { request: transformed };
  }

  /**
   * Transform update request input
   */
  static transformUpdateRequest(input: any): any {
    // Similar to create but exclude fields that can't be updated
    const transformed = this.transformCreateRequest(input);
    
    // Remove fields that can't be updated
    delete transformed.request.requester;
    
    return transformed;
  }

  /**
   * Transform entity reference (id, name, or email)
   */
  static transformEntityReference(ref: any): any {
    if (typeof ref === 'string') {
      // If it's just a string, assume it's a name
      return { name: ref };
    } else if (typeof ref === 'number') {
      // If it's a number, assume it's an ID
      return { id: String(ref) };
    } else if (typeof ref === 'object') {
      const transformed: any = {};
      
      if (ref.id) {
        transformed.id = String(ref.id);
      }
      if (ref.name) {
        transformed.name = ref.name;
      }
      if (ref.email) {
        transformed.email_id = ref.email;
      }
      
      return transformed;
    }
    
    return ref;
  }

  /**
   * Transform list parameters
   */
  static transformListParams(params: any): any {
    const inputData: any = {
      list_info: {
        row_count: params.limit || 100,
        start_index: params.offset || 0,
      },
    };

    // Add sorting
    if (params.sort_by) {
      inputData.list_info.sort_field = params.sort_by;
      inputData.list_info.sort_order = params.sort_order || 'asc';
    }

    // Add search fields
    if (params.search_fields) {
      inputData.list_info.search_fields = params.search_fields;
    }

    // Add filters
    if (params.filter_by) {
      inputData.list_info.filter_by = params.filter_by;
    }

    // Add field requirements
    if (params.fields_required) {
      inputData.fields_required = params.fields_required;
    }

    return {
      input_data: JSON.stringify(inputData),
    };
  }

  /**
   * Transform search criteria to SDP filter format
   */
  static transformSearchCriteria(criteria: Record<string, any>): any {
    const filters: any[] = [];

    for (const [key, value] of Object.entries(criteria)) {
      if (value === null || value === undefined) {
        continue;
      }

      // Map common fields to SDP field names
      const fieldMap: Record<string, string> = {
        status: 'status.name',
        priority: 'priority.name',
        category: 'category.name',
        requester: 'requester.name',
        technician: 'technician.name',
        created_after: 'created_time',
        created_before: 'created_time',
        updated_after: 'last_updated_time',
        updated_before: 'last_updated_time',
      };

      const sdpField = fieldMap[key] || key;
      
      // Handle date ranges
      if (key.endsWith('_after')) {
        filters.push({
          name: sdpField,
          operation: 'gte',
          value: this.formatDateValue(value),
        });
      } else if (key.endsWith('_before')) {
        filters.push({
          name: sdpField,
          operation: 'lte',
          value: this.formatDateValue(value),
        });
      } else if (Array.isArray(value)) {
        // Handle array values (IN operation)
        filters.push({
          name: sdpField,
          operation: 'in',
          values: value,
        });
      } else if (typeof value === 'object' && value.operation) {
        // Handle custom operations
        filters.push({
          name: sdpField,
          operation: value.operation,
          value: value.value,
        });
      } else {
        // Default to equality
        filters.push({
          name: sdpField,
          operation: 'is',
          value: String(value),
        });
      }
    }

    return filters;
  }

  /**
   * Format date value for SDP API
   */
  static formatDateValue(date: string | Date): string {
    if (date instanceof Date) {
      return date.getTime().toString();
    } else if (typeof date === 'string') {
      return new Date(date).getTime().toString();
    }
    return date;
  }
}

/**
 * Transform SDP API responses to consistent format
 */
export class ResponseTransformer {
  /**
   * Transform single entity response
   */
  static transformEntity(entity: any, entityType: string): any {
    if (!entity) {
      return null;
    }

    const transformed: any = {
      id: entity.id,
      display_id: entity.display_id,
      ...this.extractCommonFields(entity),
    };

    // Add entity-specific fields
    switch (entityType) {
      case 'request':
        this.addRequestFields(transformed, entity);
        break;
      case 'problem':
        this.addProblemFields(transformed, entity);
        break;
      case 'change':
        this.addChangeFields(transformed, entity);
        break;
      case 'project':
        this.addProjectFields(transformed, entity);
        break;
      case 'asset':
        this.addAssetFields(transformed, entity);
        break;
    }

    return transformed;
  }

  /**
   * Transform list response
   */
  static transformList(response: any, entityType: string): any {
    const listInfo = response.list_info || {};
    const entities = response[`${entityType}s`] || [];

    return {
      data: entities.map((entity: any) => 
        this.transformEntity(entity, entityType)
      ),
      pagination: {
        total: listInfo.total_count || 0,
        page_size: listInfo.row_count || entities.length,
        page: Math.floor((listInfo.start_index || 0) / (listInfo.row_count || 1)) + 1,
        has_more: listInfo.has_more || false,
      },
      sort: {
        field: listInfo.sort_field,
        order: listInfo.sort_order,
      },
    };
  }

  /**
   * Extract common fields present in all entities
   */
  private static extractCommonFields(entity: any): any {
    const fields: any = {};

    // Timestamps
    if (entity.created_time) {
      fields.created_at = this.transformTimestamp(entity.created_time);
    }
    if (entity.created_date) {
      fields.created_at = this.transformTimestamp(entity.created_date);
    }
    if (entity.last_updated_time) {
      fields.updated_at = this.transformTimestamp(entity.last_updated_time);
    }
    if (entity.last_updated_date) {
      fields.updated_at = this.transformTimestamp(entity.last_updated_date);
    }

    // User references
    if (entity.created_by) {
      fields.created_by = this.transformUser(entity.created_by);
    }
    if (entity.last_updated_by) {
      fields.updated_by = this.transformUser(entity.last_updated_by);
    }

    // Description/notes
    if (entity.description) {
      fields.description = entity.description;
    }
    if (entity.notes) {
      fields.notes = entity.notes;
    }

    // Attachments
    if (entity.attachments) {
      fields.attachments = entity.attachments;
    }

    // UDF fields
    if (entity.udf_fields) {
      fields.custom_fields = entity.udf_fields;
    }

    return fields;
  }

  /**
   * Add request-specific fields
   */
  private static addRequestFields(transformed: any, entity: any): void {
    transformed.subject = entity.subject;
    transformed.status = this.transformReference(entity.status);
    transformed.priority = this.transformReference(entity.priority);
    transformed.category = this.transformReference(entity.category);
    transformed.subcategory = this.transformReference(entity.subcategory);
    transformed.requester = this.transformUser(entity.requester);
    transformed.technician = this.transformUser(entity.technician);
    transformed.group = this.transformReference(entity.group);
    transformed.site = this.transformReference(entity.site);
    transformed.impact = this.transformReference(entity.impact);
    transformed.urgency = this.transformReference(entity.urgency);
    transformed.level = this.transformReference(entity.level);
    transformed.mode = this.transformReference(entity.mode);
    
    if (entity.due_by_time) {
      transformed.due_date = this.transformTimestamp(entity.due_by_time);
    }
    
    if (entity.is_overdue !== undefined) {
      transformed.is_overdue = entity.is_overdue;
    }
  }

  /**
   * Add problem-specific fields
   */
  private static addProblemFields(transformed: any, entity: any): void {
    transformed.title = entity.title;
    transformed.status = this.transformReference(entity.status);
    transformed.priority = this.transformReference(entity.priority);
    transformed.impact = this.transformReference(entity.impact);
    transformed.root_cause = entity.root_cause;
    transformed.symptoms = entity.symptoms;
    transformed.requester = this.transformUser(entity.requester);
    transformed.technician = this.transformUser(entity.technician);
    
    if (entity.analysis_info) {
      transformed.analysis = entity.analysis_info;
    }
  }

  /**
   * Add change-specific fields
   */
  private static addChangeFields(transformed: any, entity: any): void {
    transformed.title = entity.title;
    transformed.status = this.transformReference(entity.status);
    transformed.priority = this.transformReference(entity.priority);
    transformed.change_type = this.transformReference(entity.change_type);
    transformed.risk = this.transformReference(entity.risk);
    transformed.impact = this.transformReference(entity.impact);
    transformed.urgency = this.transformReference(entity.urgency);
    transformed.requester = this.transformUser(entity.requester);
    transformed.change_manager = this.transformUser(entity.change_manager);
    transformed.change_owner = this.transformUser(entity.change_owner);
    
    if (entity.scheduled_start_time) {
      transformed.scheduled_start = this.transformTimestamp(entity.scheduled_start_time);
    }
    if (entity.scheduled_end_time) {
      transformed.scheduled_end = this.transformTimestamp(entity.scheduled_end_time);
    }
    if (entity.approval_status) {
      transformed.approval_status = this.transformReference(entity.approval_status);
    }
  }

  /**
   * Add project-specific fields
   */
  private static addProjectFields(transformed: any, entity: any): void {
    transformed.title = entity.title;
    transformed.status = this.transformReference(entity.status);
    transformed.priority = this.transformReference(entity.priority);
    transformed.project_type = this.transformReference(entity.project_type);
    transformed.owner = this.transformUser(entity.owner);
    transformed.project_manager = this.transformUser(entity.project_manager);
    
    if (entity.scheduled_start) {
      transformed.start_date = this.transformTimestamp(entity.scheduled_start);
    }
    if (entity.scheduled_end) {
      transformed.end_date = this.transformTimestamp(entity.scheduled_end);
    }
    if (entity.actual_start) {
      transformed.actual_start_date = this.transformTimestamp(entity.actual_start);
    }
    if (entity.actual_end) {
      transformed.actual_end_date = this.transformTimestamp(entity.actual_end);
    }
    if (entity.percentage_completion !== undefined) {
      transformed.progress = entity.percentage_completion;
    }
  }

  /**
   * Add asset-specific fields
   */
  private static addAssetFields(transformed: any, entity: any): void {
    transformed.name = entity.name;
    transformed.asset_tag = entity.asset_tag;
    transformed.serial_number = entity.serial_number;
    transformed.product = this.transformReference(entity.product);
    transformed.vendor = this.transformReference(entity.vendor);
    transformed.asset_type = this.transformReference(entity.asset_type);
    transformed.asset_state = this.transformReference(entity.asset_state);
    transformed.location = this.transformReference(entity.location);
    transformed.department = this.transformReference(entity.department);
    transformed.assigned_to = this.transformUser(entity.user);
    
    if (entity.purchase_date) {
      transformed.purchase_date = this.transformTimestamp(entity.purchase_date);
    }
    if (entity.expiry_date) {
      transformed.expiry_date = this.transformTimestamp(entity.expiry_date);
    }
    if (entity.cost) {
      transformed.cost = entity.cost;
    }
  }

  /**
   * Transform user reference
   */
  private static transformUser(user: any): any {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email_id || user.email,
      is_technician: user.is_technician || false,
      is_vip: user.is_vipuser || false,
    };
  }

  /**
   * Transform generic reference
   */
  private static transformReference(ref: any): any {
    if (!ref) {
      return null;
    }

    if (typeof ref === 'string') {
      return { name: ref };
    }

    return {
      id: ref.id,
      name: ref.name,
      color: ref.color,
    };
  }

  /**
   * Transform timestamp to ISO format
   */
  private static transformTimestamp(timestamp: any): string | null {
    if (!timestamp) {
      return null;
    }

    if (timestamp.value) {
      return new Date(parseInt(timestamp.value)).toISOString();
    } else if (typeof timestamp === 'number') {
      return new Date(timestamp).toISOString();
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp).toISOString();
    }

    return null;
  }
}