import { logger } from '../monitoring/logging.js';
import type { SDPClient } from '../sdp/client.js';

/**
 * Pagination options
 */
export interface PaginationOptions {
  pageSize?: number;
  maxPages?: number;
  maxItems?: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  pagesFetched: number;
  hasMore: boolean;
}

/**
 * Page fetcher function type
 */
type PageFetcher<T> = (offset: number, limit: number) => Promise<{
  data: T[];
  total?: number;
  hasMore?: boolean;
}>;

/**
 * Utility for handling paginated API responses
 */
export class Paginator {
  /**
   * Fetch all pages of data
   */
  static async fetchAll<T>(
    fetcher: PageFetcher<T>,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const {
      pageSize = 100,
      maxPages = 100,
      maxItems = 10000,
    } = options;

    const items: T[] = [];
    let pagesFetched = 0;
    let totalCount = 0;
    let hasMore = true;
    let offset = 0;

    while (hasMore && pagesFetched < maxPages && items.length < maxItems) {
      try {
        const limit = Math.min(pageSize, maxItems - items.length);
        const page = await fetcher(offset, limit);
        
        items.push(...page.data);
        pagesFetched++;
        
        if (page.total !== undefined) {
          totalCount = page.total;
        }
        
        hasMore = page.hasMore !== false && page.data.length === limit;
        offset += limit;
        
        logger.debug('Fetched page', {
          pageNumber: pagesFetched,
          itemsInPage: page.data.length,
          totalItems: items.length,
          hasMore,
        });
      } catch (error) {
        logger.error('Error fetching page', {
          pageNumber: pagesFetched + 1,
          offset,
          error,
        });
        throw error;
      }
    }

    return {
      items,
      totalCount: totalCount || items.length,
      pagesFetched,
      hasMore: hasMore && items.length >= maxItems,
    };
  }

  /**
   * Create a page fetcher for Service Desk Plus list endpoints
   */
  static createSDPFetcher<T>(
    client: SDPClient,
    endpoint: string,
    entityName: string,
    params?: Record<string, any>
  ): PageFetcher<T> {
    return async (offset: number, limit: number) => {
      const inputData = {
        list_info: {
          row_count: limit,
          start_index: offset,
          ...(params?.list_info || {}),
        },
        ...(params || {}),
      };

      const response = await client.get(endpoint, {
        params: {
          input_data: JSON.stringify(inputData),
        },
      });

      const data = response.data;
      const listInfo = data.list_info || {};
      const entities = data[entityName] || [];

      return {
        data: entities,
        total: listInfo.total_count,
        hasMore: listInfo.has_more_rows,
      };
    };
  }

  /**
   * Stream pages with a callback
   */
  static async stream<T>(
    fetcher: PageFetcher<T>,
    callback: (items: T[], pageNumber: number) => Promise<void>,
    options: PaginationOptions = {}
  ): Promise<void> {
    const {
      pageSize = 100,
      maxPages = 100,
    } = options;

    let pageNumber = 0;
    let hasMore = true;
    let offset = 0;

    while (hasMore && pageNumber < maxPages) {
      const page = await fetcher(offset, pageSize);
      
      if (page.data.length > 0) {
        await callback(page.data, pageNumber + 1);
      }
      
      pageNumber++;
      hasMore = page.hasMore !== false && page.data.length === pageSize;
      offset += pageSize;
    }
  }

  /**
   * Create a cursor-based paginator
   */
  static createCursor<T>(
    fetcher: PageFetcher<T>,
    pageSize: number = 100
  ): CursorPaginator<T> {
    return new CursorPaginator(fetcher, pageSize);
  }
}

/**
 * Cursor-based paginator for manual page control
 */
export class CursorPaginator<T> {
  private offset: number = 0;
  private hasMore: boolean = true;
  private totalCount?: number;

  constructor(
    private fetcher: PageFetcher<T>,
    private pageSize: number = 100
  ) {}

  /**
   * Check if there are more pages
   */
  hasNextPage(): boolean {
    return this.hasMore;
  }

  /**
   * Get the current offset
   */
  getCurrentOffset(): number {
    return this.offset;
  }

  /**
   * Get total count if available
   */
  getTotalCount(): number | undefined {
    return this.totalCount;
  }

  /**
   * Fetch the next page
   */
  async nextPage(): Promise<T[]> {
    if (!this.hasMore) {
      return [];
    }

    const page = await this.fetcher(this.offset, this.pageSize);
    
    if (page.total !== undefined) {
      this.totalCount = page.total;
    }
    
    this.hasMore = page.hasMore !== false && page.data.length === this.pageSize;
    this.offset += page.data.length;
    
    return page.data;
  }

  /**
   * Reset the cursor to the beginning
   */
  reset(): void {
    this.offset = 0;
    this.hasMore = true;
    this.totalCount = undefined;
  }

  /**
   * Skip to a specific offset
   */
  seekTo(offset: number): void {
    this.offset = Math.max(0, offset);
    this.hasMore = true;
  }
}

/**
 * Pagination helper for tool responses
 */
export class PaginationHelper {
  /**
   * Format pagination info for tool response
   */
  static formatPaginationInfo(result: PaginatedResult<any>): string {
    const lines = [
      `Total items: ${result.totalCount}`,
      `Items returned: ${result.items.length}`,
      `Pages fetched: ${result.pagesFetched}`,
    ];

    if (result.hasMore) {
      lines.push('More items available (reached limit)');
    }

    return lines.join('\n');
  }

  /**
   * Create pagination metadata
   */
  static createMetadata(result: PaginatedResult<any>): Record<string, any> {
    return {
      pagination: {
        total: result.totalCount,
        returned: result.items.length,
        pages: result.pagesFetched,
        has_more: result.hasMore,
      },
    };
  }

  /**
   * Split results into chunks for display
   */
  static chunk<T>(items: T[], chunkSize: number = 10): T[][] {
    const chunks: T[][] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
}