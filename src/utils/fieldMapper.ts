import { LookupsAPI } from '../api/modules/lookups.js';
import { SDPError } from './errors.js';

/**
 * Maps field names to IDs using the lookup API
 */
export class FieldMapper {
  constructor(private lookups: LookupsAPI) {}

  /**
   * Convert a field value to the proper format for SDP API
   * @param fieldType Type of field (priority, category, etc.)
   * @param value Either a name (string) or an object with id
   * @returns Properly formatted field object
   */
  async mapField(
    fieldType: 'priority' | 'category' | 'status' | 'technician' | 'request_type' | 'level' | 'mode' | 'impact' | 'urgency',
    value: string | { id: string } | { name: string } | undefined
  ): Promise<{ id: string } | undefined> {
    if (!value) return undefined;

    // If already in correct format
    if (typeof value === 'object' && 'id' in value && value.id) {
      return { id: value.id };
    }

    // If it's a name (string or object with name)
    const name = typeof value === 'string' ? value : ('name' in value ? value.name : undefined);
    
    if (!name) {
      throw new SDPError(`Invalid ${fieldType} value: ${JSON.stringify(value)}`, 'VALIDATION_ERROR');
    }

    // Look up the ID
    const id = await this.lookups.findIdByName(fieldType, name);
    
    if (!id) {
      // Get all options for helpful error message
      const options = await this.getOptionsForType(fieldType);
      const validNames = options.map(opt => opt.name).join(', ');
      
      throw new SDPError(
        `Invalid ${fieldType} "${name}". Valid options are: ${validNames}`,
        'VALIDATION_ERROR'
      );
    }

    return { id };
  }

  /**
   * Map multiple fields in an object
   * @param data Object containing fields to map
   * @param fieldMappings Mapping of field names to their types
   * @returns Object with mapped fields
   */
  async mapFields<T extends Record<string, any>>(
    data: T,
    fieldMappings: Record<string, 'priority' | 'category' | 'status' | 'technician' | 'request_type' | 'level' | 'mode' | 'impact' | 'urgency'>
  ): Promise<T> {
    const result = { ...data } as any;

    for (const [field, fieldType] of Object.entries(fieldMappings)) {
      if (field in data && data[field]) {
        result[field] = await this.mapField(fieldType, data[field]);
      }
    }

    return result as T;
  }

  /**
   * Get all options for a field type
   */
  private async getOptionsForType(fieldType: string): Promise<Array<{ id: string; name: string }>> {
    switch (fieldType) {
      case 'priority':
        return await this.lookups.getPriorities();
      case 'category':
        return await this.lookups.getCategories();
      case 'status':
        return await this.lookups.getStatuses();
      case 'technician':
        return await this.lookups.getTechnicians();
      case 'request_type':
        return await this.lookups.getRequestTypes();
      case 'level':
        return await this.lookups.getLevels();
      case 'mode':
        return await this.lookups.getModes();
      case 'impact':
        return await this.lookups.getImpacts();
      case 'urgency':
        return await this.lookups.getUrgencies();
      default:
        return [];
    }
  }

  /**
   * Map technician by email
   * @param email Technician email
   * @returns Technician object with ID
   */
  async mapTechnicianByEmail(email: string): Promise<{ id: string; email_id: string } | undefined> {
    const technicians = await this.lookups.getTechnicians();
    const technician = technicians.find(t => t.email_id.toLowerCase() === email.toLowerCase());
    
    if (!technician) {
      const validEmails = technicians.map(t => t.email_id).join(', ');
      throw new SDPError(
        `No technician found with email "${email}". Valid technician emails: ${validEmails}`,
        'VALIDATION_ERROR'
      );
    }

    return {
      id: technician.id,
      email_id: technician.email_id,
    };
  }

  /**
   * Map subcategory for a given category
   * @param categoryName Category name
   * @param subcategoryName Subcategory name
   * @returns Subcategory object with ID
   */
  async mapSubcategory(
    categoryName: string,
    subcategoryName: string
  ): Promise<{ id: string } | undefined> {
    // First get the category ID
    const categoryId = await this.lookups.findIdByName('category', categoryName);
    if (!categoryId) {
      throw new SDPError(`Category "${categoryName}" not found`, 'VALIDATION_ERROR');
    }

    // Then get subcategories for that category
    const subcategories = await this.lookups.getSubcategories(categoryId);
    const subcategory = subcategories.find(
      s => s.name.toLowerCase() === subcategoryName.toLowerCase()
    );

    if (!subcategory) {
      const validNames = subcategories.map(s => s.name).join(', ');
      throw new SDPError(
        `Invalid subcategory "${subcategoryName}" for category "${categoryName}". Valid options: ${validNames}`,
        'VALIDATION_ERROR'
      );
    }

    return { id: subcategory.id };
  }

  /**
   * Clear the lookup cache
   */
  clearCache(): void {
    this.lookups.clearCache();
  }
}