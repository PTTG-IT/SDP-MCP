import { SDPClient } from '../client.js';
import { SDPValidationError } from '../../utils/errors.js';
import { logger } from '../../monitoring/logging.js';
import { cacheable, createCacheInvalidator } from '../../utils/cache.js';

/**
 * Asset state types
 */
export enum AssetState {
  IN_USE = 'In Use',
  IN_STOCK = 'In Stock',
  IN_REPAIR = 'In Repair',
  DISPOSED = 'Disposed',
  EXPIRED = 'Expired',
  LOANED = 'Loaned',
}

/**
 * Asset type categories
 */
export enum AssetTypeCategory {
  HARDWARE = 'Hardware',
  SOFTWARE = 'Software',
  DOCUMENT = 'Document',
  CONTRACT = 'Contract',
}

/**
 * Asset criticality
 */
export enum AssetCriticality {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

/**
 * Asset interface
 */
export interface Asset {
  id: string;
  name: string;
  asset_tag?: string;
  serial_number?: string;
  state?: {
    id?: string;
    name?: string;
  };
  asset_type?: {
    id?: string;
    name?: string;
  };
  product?: {
    id?: string;
    name?: string;
  };
  vendor?: {
    id?: string;
    name?: string;
  };
  location?: {
    id?: string;
    name?: string;
  };
  department?: {
    id?: string;
    name?: string;
  };
  assigned_to?: {
    id?: string;
    name?: string;
    email?: string;
  };
  impact?: {
    id?: string;
    name?: string;
  };
  criticality?: {
    id?: string;
    name?: string;
  };
  acquisition_date?: string;
  expiry_date?: string;
  warranty_expiry_date?: string;
  cost?: {
    amount?: number;
    currency?: string;
  };
  salvage_value?: {
    amount?: number;
    currency?: string;
  };
  configuration?: Record<string, any>;
  relationships?: {
    parent_asset?: {
      id: string;
      name: string;
    };
    child_assets?: Array<{
      id: string;
      name: string;
    }>;
    connected_assets?: Array<{
      id: string;
      name: string;
      relationship_type: string;
    }>;
  };
  contracts?: Array<{
    id: string;
    name: string;
    contract_number: string;
  }>;
  history?: Array<{
    id: string;
    action: string;
    performed_by: {
      id: string;
      name: string;
    };
    performed_time: string;
    comments?: string;
  }>;
  udf_fields?: Record<string, any>;
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
  }>;
}

/**
 * Asset creation parameters
 */
export interface CreateAssetParams {
  name: string;
  asset_tag?: string;
  serial_number?: string;
  state?: string;
  asset_type?: { id: string } | { name: string };
  product?: { id: string } | { name: string };
  vendor?: { id: string } | { name: string };
  location?: { id: string } | { name: string };
  department?: { id: string } | { name: string };
  assigned_to?: { id: string } | { email: string };
  impact?: string;
  criticality?: string;
  acquisition_date?: string;
  expiry_date?: string;
  warranty_expiry_date?: string;
  cost?: {
    amount: number;
    currency?: string;
  };
  configuration?: Record<string, any>;
  udf_fields?: Record<string, any>;
}

/**
 * Asset update parameters
 */
export interface UpdateAssetParams extends Partial<CreateAssetParams> {}

/**
 * Asset list parameters
 */
export interface ListAssetParams {
  page?: number;
  page_size?: number;
  search_fields?: Record<string, string>;
  filter_by?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  include_details?: boolean;
}

/**
 * Asset scan parameters
 */
export interface AssetScanParams {
  scan_type?: 'full' | 'incremental';
  ip_range?: string;
  domain?: string;
}

/**
 * Asset relationship parameters
 */
export interface AssetRelationshipParams {
  relationship_type: string;
  target_asset_id: string;
  description?: string;
}

/**
 * Asset list response
 */
export interface AssetListResponse {
  assets: Asset[];
  response_status: {
    status_code: number;
    status: string;
  };
  page_info?: {
    page: number;
    page_size: number;
    total_count: number;
    has_more_rows: boolean;
  };
}

/**
 * Computer asset interface (extends Asset)
 */
export interface ComputerAsset extends Asset {
  os_name?: string;
  os_version?: string;
  cpu_model?: string;
  cpu_speed?: string;
  cpu_count?: number;
  memory_size?: number;
  disk_space?: number;
  mac_address?: string;
  ip_address?: string;
  domain?: string;
  last_logged_user?: string;
  last_scan_time?: string;
}

/**
 * Service Desk Plus Assets API Module
 */
export class AssetsAPI {
  private readonly client: SDPClient;
  private readonly cacheInvalidator = createCacheInvalidator('assets');

  constructor(client: SDPClient) {
    this.client = client;
  }

  /**
   * Create a new asset
   */
  async create(params: CreateAssetParams): Promise<Asset> {
    logger.info('Creating asset', { name: params.name });

    // Validate required fields
    if (!params.name) {
      throw new SDPValidationError('Name is required', 'name');
    }

    // Format asset data
    const assetData = {
      asset: {
        name: params.name,
        asset_tag: params.asset_tag,
        serial_number: params.serial_number,
        state: params.state ? { name: params.state } : undefined,
        asset_type: params.asset_type,
        product: params.product,
        vendor: params.vendor,
        location: params.location,
        department: params.department,
        assigned_to: params.assigned_to,
        impact: params.impact ? { name: params.impact } : undefined,
        criticality: params.criticality ? { name: params.criticality } : undefined,
        acquisition_date: params.acquisition_date,
        expiry_date: params.expiry_date,
        warranty_expiry_date: params.warranty_expiry_date,
        cost: params.cost,
        configuration: params.configuration,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.post<{ asset: Asset }>(
      '/api/v3/assets',
      assetData
    );

    // Invalidate list cache
    await this.cacheInvalidator.invalidateOperation('list');

    return response.asset;
  }

  /**
   * Get asset by ID
   */
  @cacheable('assets', 'get')
  async get(id: string): Promise<Asset> {
    logger.info('Getting asset', { id });

    const response = await this.client.get<{ asset: Asset }>(
      `/api/v3/assets/${id}`
    );

    return response.asset;
  }

  /**
   * Update an asset
   */
  async update(id: string, params: UpdateAssetParams): Promise<Asset> {
    logger.info('Updating asset', { id, params });

    // Format update data
    const assetData = {
      asset: {
        name: params.name,
        asset_tag: params.asset_tag,
        serial_number: params.serial_number,
        state: params.state ? { name: params.state } : undefined,
        asset_type: params.asset_type,
        product: params.product,
        vendor: params.vendor,
        location: params.location,
        department: params.department,
        assigned_to: params.assigned_to,
        impact: params.impact ? { name: params.impact } : undefined,
        criticality: params.criticality ? { name: params.criticality } : undefined,
        acquisition_date: params.acquisition_date,
        expiry_date: params.expiry_date,
        warranty_expiry_date: params.warranty_expiry_date,
        cost: params.cost,
        configuration: params.configuration,
        udf_fields: params.udf_fields,
      },
    };

    const response = await this.client.put<{ asset: Asset }>(
      `/api/v3/assets/${id}`,
      assetData
    );

    // Invalidate caches
    await this.cacheInvalidator.invalidateOperation('get');
    await this.cacheInvalidator.invalidateOperation('list');

    return response.asset;
  }

  /**
   * Delete an asset
   */
  async delete(id: string): Promise<void> {
    logger.info('Deleting asset', { id });

    await this.client.delete(`/api/v3/assets/${id}`);

    // Invalidate caches
    await this.cacheInvalidator.invalidateAll();
  }

  /**
   * List assets
   */
  @cacheable('assets', 'list')
  async list(params: ListAssetParams = {}): Promise<AssetListResponse> {
    logger.info('Listing assets', { params });

    // Build query parameters
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 100,
    };

    if (params.search_fields) {
      queryParams.search_fields = JSON.stringify(params.search_fields);
    }

    if (params.filter_by) {
      queryParams.filter_by = params.filter_by;
    }

    if (params.sort_field) {
      queryParams.sort_field = params.sort_field;
      queryParams.sort_order = params.sort_order || 'asc';
    }

    if (params.include_details) {
      queryParams.include_details = true;
    }

    const response = await this.client.get<AssetListResponse>(
      '/api/v3/assets',
      { params: queryParams }
    );

    return response;
  }

  /**
   * List computer assets
   */
  @cacheable('assets', 'listComputers')
  async listComputers(params: ListAssetParams = {}): Promise<{ computers: ComputerAsset[] }> {
    logger.info('Listing computer assets', { params });

    const queryParams: Record<string, any> = {
      page: params.page || 1,
      page_size: params.page_size || 100,
    };

    const response = await this.client.get<{ computers: ComputerAsset[] }>(
      '/api/v3/asset_computers',
      { params: queryParams }
    );

    return response;
  }

  /**
   * Assign asset to user
   */
  async assign(assetId: string, userId: string): Promise<Asset> {
    logger.info('Assigning asset', { assetId, userId });

    return this.update(assetId, {
      assigned_to: { id: userId },
      state: AssetState.IN_USE,
    });
  }

  /**
   * Unassign asset
   */
  async unassign(assetId: string): Promise<Asset> {
    logger.info('Unassigning asset', { assetId });

    return this.update(assetId, {
      assigned_to: undefined,
      state: AssetState.IN_STOCK,
    });
  }

  /**
   * Move asset to location
   */
  async moveToLocation(assetId: string, locationId: string): Promise<Asset> {
    logger.info('Moving asset to location', { assetId, locationId });

    return this.update(assetId, {
      location: { id: locationId },
    });
  }

  /**
   * Add asset relationship
   */
  async addRelationship(assetId: string, params: AssetRelationshipParams): Promise<void> {
    logger.info('Adding asset relationship', { assetId, params });

    await this.client.post(
      `/api/v3/assets/${assetId}/relationships`,
      {
        relationship: {
          type: params.relationship_type,
          target_asset: { id: params.target_asset_id },
          description: params.description,
        },
      }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Associate contract with asset
   */
  async associateContract(assetId: string, contractId: string): Promise<void> {
    logger.info('Associating contract with asset', { assetId, contractId });

    await this.client.post(
      `/api/v3/assets/${assetId}/contracts`,
      { contract: { id: contractId } }
    );

    // Invalidate cache
    await this.cacheInvalidator.invalidateOperation('get');
  }

  /**
   * Scan for assets
   */
  async scan(params: AssetScanParams = {}): Promise<{ scan_id: string }> {
    logger.info('Scanning for assets', { params });

    const scanData = {
      scan: {
        type: params.scan_type || 'full',
        ip_range: params.ip_range,
        domain: params.domain,
      },
    };

    const response = await this.client.post<{ scan_id: string }>(
      '/api/v3/assets/scan',
      scanData
    );

    return response;
  }

  /**
   * Search assets
   */
  async search(criteria: Record<string, any>): Promise<AssetListResponse> {
    logger.info('Searching assets', { criteria });

    // Convert search criteria to filter format
    const searchFields = Object.entries(criteria).reduce((acc, [key, value]) => {
      acc[key] = { value, condition: 'contains' };
      return acc;
    }, {} as Record<string, any>);

    return this.list({ search_fields: searchFields });
  }

  /**
   * Get assets by state
   */
  async getByState(state: AssetState): Promise<AssetListResponse> {
    return this.list({
      filter_by: `state.name:'${state}'`,
    });
  }

  /**
   * Get assets by type
   */
  async getByType(assetTypeId: string): Promise<AssetListResponse> {
    return this.list({
      filter_by: `asset_type.id:${assetTypeId}`,
    });
  }

  /**
   * Get assets assigned to user
   */
  async getByUser(userId: string): Promise<AssetListResponse> {
    return this.list({
      filter_by: `assigned_to.id:${userId}`,
    });
  }

  /**
   * Get assets by location
   */
  async getByLocation(locationId: string): Promise<AssetListResponse> {
    return this.list({
      filter_by: `location.id:${locationId}`,
    });
  }

  /**
   * Get expired assets
   */
  async getExpiredAssets(): Promise<AssetListResponse> {
    const now = new Date().toISOString();
    return this.list({
      filter_by: `expiry_date:<'${now}'`,
      sort_field: 'expiry_date',
      sort_order: 'asc',
    });
  }

  /**
   * Get assets with expiring warranty
   */
  async getExpiringWarranty(days: number = 30): Promise<AssetListResponse> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const now = new Date().toISOString();
    const future = futureDate.toISOString();

    return this.list({
      filter_by: `warranty_expiry_date:>'${now}' AND warranty_expiry_date:<'${future}'`,
      sort_field: 'warranty_expiry_date',
      sort_order: 'asc',
    });
  }

  /**
   * Get critical assets
   */
  async getCriticalAssets(): Promise<AssetListResponse> {
    return this.list({
      filter_by: `criticality.name:'Critical' OR criticality.name:'High'`,
    });
  }

  /**
   * Get asset statistics
   */
  async getStatistics(): Promise<{
    total: number;
    in_use: number;
    in_stock: number;
    expired: number;
    critical: number;
  }> {
    const [all, inUse, inStock, expired, critical] = await Promise.all([
      this.list({ page_size: 1 }), // Just to get total count
      this.getByState(AssetState.IN_USE),
      this.getByState(AssetState.IN_STOCK),
      this.getExpiredAssets(),
      this.getCriticalAssets(),
    ]);

    return {
      total: all.page_info?.total_count || 0,
      in_use: inUse.page_info?.total_count || 0,
      in_stock: inStock.page_info?.total_count || 0,
      expired: expired.page_info?.total_count || 0,
      critical: critical.page_info?.total_count || 0,
    };
  }

  /**
   * Dispose asset
   */
  async dispose(id: string, reason?: string): Promise<Asset> {
    logger.info('Disposing asset', { id, reason });

    return this.update(id, {
      state: AssetState.DISPOSED,
      udf_fields: reason ? { disposal_reason: reason } : undefined,
    });
  }
}