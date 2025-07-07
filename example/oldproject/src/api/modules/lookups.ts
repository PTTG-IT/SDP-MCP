import { AxiosInstance } from 'axios';
import { SDPListResponse, BaseEntity } from '../types.js';

export interface Priority extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export interface Category extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  parent_category?: Category;
}

export interface Status extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  stage?: string;
  color?: string;
}

export interface Technician extends BaseEntity {
  id: string;
  name: string;
  email_id: string;
  phone?: string;
  department?: string;
  designation?: string;
  is_vip_user?: boolean;
}

export interface RequestType extends BaseEntity {
  id: string;
  name: string;
  description?: string;
}

export interface Level extends BaseEntity {
  id: string;
  name: string;
  description?: string;
}

export interface Mode extends BaseEntity {
  id: string;
  name: string;
  description?: string;
}

export interface Impact extends BaseEntity {
  id: string;
  name: string;
  description?: string;
}

export interface Urgency extends BaseEntity {
  id: string;
  name: string;
  description?: string;
}

export interface Subcategory extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  category?: Category;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class LookupsAPI {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 300000; // 5 minutes

  constructor(private axios: AxiosInstance) {}

  private async getCached<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });

    return data;
  }

  /**
   * Get all priorities
   */
  async getPriorities(): Promise<Priority[]> {
    return this.getCached('priorities', async () => {
      const response = await this.axios.get<SDPListResponse<Priority>>('/priorities');
      return response.data.priorities || [];
    });
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Category[]> {
    return this.getCached('categories', async () => {
      const response = await this.axios.get<SDPListResponse<Category>>('/categories');
      return response.data.categories || [];
    });
  }

  /**
   * Get all statuses
   */
  async getStatuses(): Promise<Status[]> {
    return this.getCached('statuses', async () => {
      const response = await this.axios.get<SDPListResponse<Status>>('/statuses');
      return response.data.statuses || [];
    });
  }

  /**
   * Get all technicians
   */
  async getTechnicians(): Promise<Technician[]> {
    return this.getCached('technicians', async () => {
      const response = await this.axios.get<SDPListResponse<Technician>>('/technicians');
      return response.data.technicians || [];
    });
  }

  /**
   * Get all request types
   */
  async getRequestTypes(): Promise<RequestType[]> {
    return this.getCached('request_types', async () => {
      const response = await this.axios.get<SDPListResponse<RequestType>>('/request_types');
      return response.data.request_types || [];
    });
  }

  /**
   * Get all levels
   */
  async getLevels(): Promise<Level[]> {
    return this.getCached('levels', async () => {
      const response = await this.axios.get<SDPListResponse<Level>>('/levels');
      return response.data.levels || [];
    });
  }

  /**
   * Get all modes
   */
  async getModes(): Promise<Mode[]> {
    return this.getCached('modes', async () => {
      const response = await this.axios.get<SDPListResponse<Mode>>('/modes');
      return response.data.modes || [];
    });
  }

  /**
   * Get all impacts
   */
  async getImpacts(): Promise<Impact[]> {
    return this.getCached('impacts', async () => {
      const response = await this.axios.get<SDPListResponse<Impact>>('/impacts');
      return response.data.impacts || [];
    });
  }

  /**
   * Get all urgencies
   */
  async getUrgencies(): Promise<Urgency[]> {
    return this.getCached('urgencies', async () => {
      const response = await this.axios.get<SDPListResponse<Urgency>>('/urgencies');
      return response.data.urgencies || [];
    });
  }

  /**
   * Get all subcategories
   */
  async getSubcategories(categoryId?: string): Promise<Subcategory[]> {
    const key = categoryId ? `subcategories_${categoryId}` : 'subcategories';
    return this.getCached(key, async () => {
      const params = categoryId ? { category_id: categoryId } : {};
      const response = await this.axios.get<SDPListResponse<Subcategory>>('/subcategories', { params });
      return response.data.subcategories || [];
    });
  }

  /**
   * Clear cache for a specific key or all cache
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Find ID by name for any lookup type
   */
  async findIdByName(type: 'priority' | 'category' | 'status' | 'technician' | 'request_type' | 'level' | 'mode' | 'impact' | 'urgency', name: string): Promise<string | undefined> {
    const nameLower = name.toLowerCase();
    
    switch (type) {
      case 'priority':
        const priorities = await this.getPriorities();
        return priorities.find(p => p.name.toLowerCase() === nameLower)?.id;
      
      case 'category':
        const categories = await this.getCategories();
        return categories.find(c => c.name.toLowerCase() === nameLower)?.id;
      
      case 'status':
        const statuses = await this.getStatuses();
        return statuses.find(s => s.name.toLowerCase() === nameLower)?.id;
      
      case 'technician':
        const technicians = await this.getTechnicians();
        return technicians.find(t => 
          t.name.toLowerCase() === nameLower || 
          t.email_id.toLowerCase() === nameLower
        )?.id;
      
      case 'request_type':
        const requestTypes = await this.getRequestTypes();
        return requestTypes.find(rt => rt.name.toLowerCase() === nameLower)?.id;
      
      case 'level':
        const levels = await this.getLevels();
        return levels.find(l => l.name.toLowerCase() === nameLower)?.id;
      
      case 'mode':
        const modes = await this.getModes();
        return modes.find(m => m.name.toLowerCase() === nameLower)?.id;
      
      case 'impact':
        const impacts = await this.getImpacts();
        return impacts.find(i => i.name.toLowerCase() === nameLower)?.id;
      
      case 'urgency':
        const urgencies = await this.getUrgencies();
        return urgencies.find(u => u.name.toLowerCase() === nameLower)?.id;
      
      default:
        throw new Error(`Unknown lookup type: ${type}`);
    }
  }
}