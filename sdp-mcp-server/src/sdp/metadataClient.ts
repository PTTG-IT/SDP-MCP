/**
 * Service Desk Plus API Metadata Client
 * Fetches valid values for priorities, categories, statuses, etc.
 */

import { SDPClient } from './simpleClient.js';
import { logger } from '../monitoring/simpleLogging.js';

interface MetadataItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface MetadataCache {
  priorities: MetadataItem[] | null;
  statuses: MetadataItem[] | null;
  categories: MetadataItem[] | null;
  urgencies: MetadataItem[] | null;
  impacts: MetadataItem[] | null;
  requesters: MetadataItem[] | null;
  technicians: MetadataItem[] | null;
  templates: MetadataItem[] | null;
  closureCodes: MetadataItem[] | null;
  changeTypes: MetadataItem[] | null;
  risks: MetadataItem[] | null;
}

export class SDPMetadataClient {
  private cache: MetadataCache = {
    priorities: null,
    statuses: null,
    categories: null,
    urgencies: null,
    impacts: null,
    requesters: null,
    technicians: null,
    templates: null,
    closureCodes: null,
    changeTypes: null,
    risks: null,
  };

  private cacheTTL = 3600000; // 1 hour cache TTL
  private cacheTimestamps: Record<string, number> = {};

  constructor(private client: SDPClient) {}

  /**
   * Check if cache is valid
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * Get all priorities
   */
  async getPriorities(): Promise<MetadataItem[]> {
    if (this.cache.priorities && this.isCacheValid('priorities')) {
      return this.cache.priorities;
    }

    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/priorities',
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 100,
              start_index: 0,
            },
          }),
        },
      });

      this.cache.priorities = response.priorities || [];
      this.cacheTimestamps.priorities = Date.now();
      
      logger.info(`Loaded ${this.cache.priorities.length} priorities`);
      return this.cache.priorities;
    } catch (error) {
      logger.error('Failed to fetch priorities:', error);
      return [];
    }
  }

  /**
   * Get all statuses
   */
  async getStatuses(): Promise<MetadataItem[]> {
    if (this.cache.statuses && this.isCacheValid('statuses')) {
      return this.cache.statuses;
    }

    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/statuses',
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 100,
              start_index: 0,
            },
          }),
        },
      });

      this.cache.statuses = response.statuses || [];
      this.cacheTimestamps.statuses = Date.now();
      
      logger.info(`Loaded ${this.cache.statuses.length} statuses`);
      return this.cache.statuses;
    } catch (error) {
      logger.error('Failed to fetch statuses:', error);
      return [];
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<MetadataItem[]> {
    if (this.cache.categories && this.isCacheValid('categories')) {
      return this.cache.categories;
    }

    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/categories',
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 100,
              start_index: 0,
            },
          }),
        },
      });

      this.cache.categories = response.categories || [];
      this.cacheTimestamps.categories = Date.now();
      
      logger.info(`Loaded ${this.cache.categories.length} categories`);
      return this.cache.categories;
    } catch (error) {
      logger.error('Failed to fetch categories:', error);
      return [];
    }
  }

  /**
   * Get urgencies
   */
  async getUrgencies(): Promise<MetadataItem[]> {
    if (this.cache.urgencies && this.isCacheValid('urgencies')) {
      return this.cache.urgencies;
    }

    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/urgencies',
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 100,
              start_index: 0,
            },
          }),
        },
      });

      this.cache.urgencies = response.urgencies || [];
      this.cacheTimestamps.urgencies = Date.now();
      
      logger.info(`Loaded ${this.cache.urgencies.length} urgencies`);
      return this.cache.urgencies;
    } catch (error) {
      logger.error('Failed to fetch urgencies:', error);
      return [];
    }
  }

  /**
   * Get impacts
   */
  async getImpacts(): Promise<MetadataItem[]> {
    if (this.cache.impacts && this.isCacheValid('impacts')) {
      return this.cache.impacts;
    }

    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/impacts',
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 100,
              start_index: 0,
            },
          }),
        },
      });

      this.cache.impacts = response.impacts || [];
      this.cacheTimestamps.impacts = Date.now();
      
      logger.info(`Loaded ${this.cache.impacts.length} impacts`);
      return this.cache.impacts;
    } catch (error) {
      logger.error('Failed to fetch impacts:', error);
      return [];
    }
  }

  /**
   * Get closure codes
   */
  async getClosureCodes(): Promise<MetadataItem[]> {
    if (this.cache.closureCodes && this.isCacheValid('closureCodes')) {
      return this.cache.closureCodes;
    }

    try {
      const response = await this.client.request({
        method: 'GET',
        url: '/closure_codes',
        params: {
          input_data: JSON.stringify({
            list_info: {
              row_count: 100,
              start_index: 0,
            },
          }),
        },
      });

      this.cache.closureCodes = response.closure_codes || [];
      this.cacheTimestamps.closureCodes = Date.now();
      
      logger.info(`Loaded ${this.cache.closureCodes.length} closure codes`);
      return this.cache.closureCodes;
    } catch (error) {
      logger.error('Failed to fetch closure codes:', error);
      return [];
    }
  }

  /**
   * Get all metadata at once
   */
  async getAllMetadata(): Promise<{
    priorities: MetadataItem[];
    statuses: MetadataItem[];
    categories: MetadataItem[];
    urgencies: MetadataItem[];
    impacts: MetadataItem[];
    closureCodes: MetadataItem[];
  }> {
    const [priorities, statuses, categories, urgencies, impacts, closureCodes] = await Promise.all([
      this.getPriorities(),
      this.getStatuses(),
      this.getCategories(),
      this.getUrgencies(),
      this.getImpacts(),
      this.getClosureCodes(),
    ]);

    return {
      priorities,
      statuses,
      categories,
      urgencies,
      impacts,
      closureCodes,
    };
  }

  /**
   * Find metadata item by name (case-insensitive)
   */
  findByName(items: MetadataItem[], name: string): MetadataItem | undefined {
    return items.find(item => 
      item.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = {
      priorities: null,
      statuses: null,
      categories: null,
      urgencies: null,
      impacts: null,
      requesters: null,
      technicians: null,
      templates: null,
      closureCodes: null,
      changeTypes: null,
      risks: null,
    };
    this.cacheTimestamps = {};
    logger.info('Metadata cache cleared');
  }
}