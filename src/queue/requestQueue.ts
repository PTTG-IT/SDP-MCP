import { EventEmitter } from 'events';
import { RateLimitCoordinator } from '../api/rateLimitCoordinator.js';
import { query, queryOne, transaction } from '../db/config.js';

export interface QueuedRequest {
  id: string;
  priority: 'high' | 'normal' | 'low';
  type: 'api_request' | 'token_refresh';
  payload: any;
  createdAt: Date;
  scheduledFor?: Date;
  attempts: number;
  lastAttempt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  result?: any;
  metadata?: Record<string, any>;
}

export interface QueueOptions {
  maxConcurrent: number;
  maxRetries: number;
  retryDelay: number;
  processingTimeout: number;
  priorityWeights: {
    high: number;
    normal: number;
    low: number;
  };
}

/**
 * Priority-based request queue for managing API calls and token refreshes
 * Ensures rate limits are respected while maximizing throughput
 */
export class RequestQueue extends EventEmitter {
  private coordinator: RateLimitCoordinator;
  private processing: Map<string, QueuedRequest> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private options: QueueOptions;
  private isPaused: boolean = false;

  constructor(options?: Partial<QueueOptions>) {
    super();
    this.coordinator = RateLimitCoordinator.getInstance();
    
    this.options = {
      maxConcurrent: options?.maxConcurrent ?? 5,
      maxRetries: options?.maxRetries ?? 3,
      retryDelay: options?.retryDelay ?? 5000,
      processingTimeout: options?.processingTimeout ?? 30000,
      priorityWeights: options?.priorityWeights ?? {
        high: 3,
        normal: 2,
        low: 1
      }
    };
  }

  /**
   * Start processing queue
   */
  async start(): Promise<void> {
    console.log('Starting request queue processor');
    
    // Ensure tables exist
    await this.ensureTables();
    
    // Clean up stale requests
    await this.cleanupStaleRequests();
    
    // Start processing
    this.processingInterval = setInterval(() => {
      if (!this.isPaused) {
        this.processQueue().catch(error => {
          console.error('Queue processing error:', error);
        });
      }
    }, 1000); // Check every second
  }

  /**
   * Stop processing queue
   */
  async stop(): Promise<void> {
    console.log('Stopping request queue processor');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Wait for current processing to complete
    await this.waitForProcessingCompletion();
  }

  /**
   * Add request to queue
   */
  async enqueue(
    type: 'api_request' | 'token_refresh',
    payload: any,
    priority: 'high' | 'normal' | 'low' = 'normal',
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = this.generateRequestId();
    
    // Special handling for token refresh
    if (type === 'token_refresh') {
      // Check if we can refresh now
      const canRefresh = await this.coordinator.canRefreshToken();
      if (!canRefresh) {
        const timeUntilNext = this.coordinator.getTimeUntilNextRefresh();
        const scheduledFor = new Date(Date.now() + timeUntilNext);
        
        await query(
          `INSERT INTO request_queue 
           (id, priority, type, payload, scheduled_for, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, priority, type, JSON.stringify(payload), scheduledFor, 'pending', JSON.stringify(metadata)]
        );
        
        this.emit('enqueued', { id, type, priority, scheduledFor });
        return id;
      }
    }
    
    await query(
      `INSERT INTO request_queue 
       (id, priority, type, payload, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, priority, type, JSON.stringify(payload), 'pending', JSON.stringify(metadata)]
    );
    
    this.emit('enqueued', { id, type, priority });
    return id;
  }

  /**
   * Cancel a queued request
   */
  async cancel(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE request_queue 
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'`,
      [id]
    );
    
    const cancelled = (result as any).rowCount > 0;
    if (cancelled) {
      this.emit('cancelled', { id });
    }
    
    return cancelled;
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    // Check if we can process more requests
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }
    
    // Get next requests to process
    const requests = await this.getNextRequests(this.options.maxConcurrent - this.processing.size);
    
    // Process each request
    for (const request of requests) {
      this.processRequest(request).catch(error => {
        console.error(`Failed to process request ${request.id}:`, error);
      });
    }
  }

  /**
   * Get next requests from queue
   */
  private async getNextRequests(limit: number): Promise<QueuedRequest[]> {
    // Priority-weighted selection
    const result = await query<QueuedRequest>(
      `WITH prioritized AS (
        SELECT *,
          CASE priority
            WHEN 'high' THEN ${this.options.priorityWeights.high}
            WHEN 'normal' THEN ${this.options.priorityWeights.normal}
            WHEN 'low' THEN ${this.options.priorityWeights.low}
          END as weight
        FROM request_queue
        WHERE status = 'pending'
        AND (scheduled_for IS NULL OR scheduled_for <= CURRENT_TIMESTAMP)
        AND attempts < $1
      )
      SELECT * FROM prioritized
      ORDER BY weight DESC, created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED`,
      [this.options.maxRetries, limit]
    );
    
    return result;
  }

  /**
   * Process a single request
   */
  private async processRequest(request: QueuedRequest): Promise<void> {
    // Mark as processing
    this.processing.set(request.id, request);
    
    await query(
      `UPDATE request_queue 
       SET status = 'processing', 
           last_attempt = CURRENT_TIMESTAMP,
           attempts = attempts + 1
       WHERE id = $1`,
      [request.id]
    );
    
    this.emit('processing', { id: request.id, type: request.type });
    
    try {
      // Check rate limits
      if (request.type === 'api_request' && !this.coordinator.canMakeApiRequest()) {
        throw new Error('API rate limit exceeded');
      }
      
      if (request.type === 'token_refresh' && !await this.coordinator.canRefreshToken()) {
        throw new Error('Token refresh rate limit exceeded');
      }
      
      // Process based on type
      let result: any;
      
      if (request.type === 'api_request') {
        result = await this.processApiRequest(request.payload);
        this.coordinator.recordApiRequest();
      } else if (request.type === 'token_refresh') {
        result = await this.processTokenRefresh(request.payload);
      }
      
      // Mark as completed
      await query(
        `UPDATE request_queue 
         SET status = 'completed', 
             result = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [request.id, JSON.stringify(result)]
      );
      
      this.emit('completed', { id: request.id, type: request.type, result });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if we should retry
      const shouldRetry = request.attempts < this.options.maxRetries && 
                         !this.isPermanentError(error);
      
      if (shouldRetry) {
        // Schedule retry
        const retryDelay = this.options.retryDelay * Math.pow(2, request.attempts - 1);
        const scheduledFor = new Date(Date.now() + retryDelay);
        
        await query(
          `UPDATE request_queue 
           SET status = 'pending',
               scheduled_for = $2,
               error = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [request.id, scheduledFor, errorMessage]
        );
        
        this.emit('retry_scheduled', { 
          id: request.id, 
          attempt: request.attempts,
          scheduledFor 
        });
      } else {
        // Mark as failed
        await query(
          `UPDATE request_queue 
           SET status = 'failed',
               error = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [request.id, errorMessage]
        );
        
        this.emit('failed', { 
          id: request.id, 
          type: request.type, 
          error: errorMessage,
          attempts: request.attempts 
        });
      }
    } finally {
      this.processing.delete(request.id);
    }
  }

  /**
   * Process API request
   */
  private async processApiRequest(payload: any): Promise<any> {
    // This would be implemented by the actual API client
    // For now, return a mock response
    return { success: true, data: payload };
  }

  /**
   * Process token refresh
   */
  private async processTokenRefresh(_payload: any): Promise<any> {
    // This would be implemented by the token manager
    // For now, return a mock response
    await this.coordinator.recordTokenRefresh(true);
    return { success: true, newToken: 'mock-token' };
  }

  /**
   * Check if error is permanent
   */
  private isPermanentError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('invalid') ||
             message.includes('unauthorized') ||
             message.includes('forbidden');
    }
    return false;
  }

  /**
   * Wait for all processing to complete
   */
  private async waitForProcessingCompletion(timeout: number = 30000): Promise<void> {
    const start = Date.now();
    
    while (this.processing.size > 0) {
      if (Date.now() - start > timeout) {
        throw new Error('Timeout waiting for processing completion');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Clean up stale requests
   */
  private async cleanupStaleRequests(): Promise<void> {
    // Mark processing requests as failed if they've been stuck too long
    await query(
      `UPDATE request_queue 
       SET status = 'failed',
           error = 'Processing timeout',
           updated_at = CURRENT_TIMESTAMP
       WHERE status = 'processing'
       AND last_attempt < CURRENT_TIMESTAMP - INTERVAL '${this.options.processingTimeout} milliseconds'`
    );
    
    // Delete old completed/failed requests
    await query(
      `DELETE FROM request_queue 
       WHERE status IN ('completed', 'failed', 'cancelled')
       AND updated_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'`
    );
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    byPriority: Record<string, number>;
    avgProcessingTime: number;
    successRate: number;
  }> {
    const stats = await queryOne<{
      pending: string;
      processing: string;
      completed: string;
      failed: string;
    }>(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM request_queue
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`
    );
    
    const byPriority = await query<{ priority: string; count: string }>(
      `SELECT priority, COUNT(*) as count
       FROM request_queue
       WHERE status = 'pending'
       GROUP BY priority`
    );
    
    const processingTime = await queryOne<{ avg_time: string }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_time
       FROM request_queue
       WHERE status = 'completed'
       AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`
    );
    
    const total = parseInt(stats?.completed || '0') + parseInt(stats?.failed || '0');
    const successRate = total > 0 ? (parseInt(stats?.completed || '0') / total) * 100 : 0;
    
    return {
      pending: parseInt(stats?.pending || '0'),
      processing: parseInt(stats?.processing || '0'),
      completed: parseInt(stats?.completed || '0'),
      failed: parseInt(stats?.failed || '0'),
      byPriority: byPriority.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>),
      avgProcessingTime: parseFloat(processingTime?.avg_time || '0'),
      successRate
    };
  }

  /**
   * Pause/resume processing
   */
  pause(): void {
    this.isPaused = true;
    this.emit('paused');
  }

  resume(): void {
    this.isPaused = false;
    this.emit('resumed');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure required tables exist
   */
  private async ensureTables(): Promise<void> {
    await transaction(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS request_queue (
          id VARCHAR(255) PRIMARY KEY,
          priority VARCHAR(20) NOT NULL,
          type VARCHAR(50) NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scheduled_for TIMESTAMP,
          attempts INTEGER DEFAULT 0,
          last_attempt TIMESTAMP,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          error TEXT,
          result JSONB,
          metadata JSONB
        )
      `);
      
      // Indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_request_queue_status_priority 
        ON request_queue(status, priority, created_at)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_request_queue_scheduled 
        ON request_queue(scheduled_for) 
        WHERE scheduled_for IS NOT NULL
      `);
    });
  }
}