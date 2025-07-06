import { query, queryOne, transaction } from '../db/config.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface InstanceInfo {
  instanceId: string;
  hostname: string;
  pid: number;
  startTime: Date;
  lastHeartbeat: Date;
  role: 'primary' | 'secondary';
  status: 'active' | 'inactive' | 'unhealthy';
  metadata: Record<string, any>;
}

export interface CoordinationEvent {
  type: 'instance_joined' | 'instance_left' | 'role_changed' | 'token_refresh_started' | 'token_refresh_completed';
  instanceId: string;
  timestamp: Date;
  data?: any;
}

/**
 * Cross-instance coordination for distributed rate limiting
 * Ensures only one instance handles token refresh at a time
 */
export class InstanceCoordinator extends EventEmitter {
  private instanceId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private electionInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatFrequency = 10000; // 10 seconds
  private readonly inactiveThreshold = 30000; // 30 seconds
  // private readonly electionDelay = 5000; // 5 seconds

  constructor() {
    super();
    // Generate unique instance ID
    this.instanceId = this.generateInstanceId();
  }

  /**
   * Start coordination
   */
  async start(): Promise<void> {
    console.log(`Starting instance coordinator with ID: ${this.instanceId}`);
    
    // Register instance
    await this.registerInstance();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Start leader election
    await this.startLeaderElection();
    
    // Clean up stale instances
    await this.cleanupStaleInstances();
    
    // Emit join event
    await this.recordEvent('instance_joined', {
      hostname: this.getHostname(),
      pid: process.pid
    });
  }

  /**
   * Stop coordination
   */
  async stop(): Promise<void> {
    console.log('Stopping instance coordinator');
    
    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.electionInterval) {
      clearInterval(this.electionInterval);
      this.electionInterval = null;
    }
    
    // Unregister instance
    await this.unregisterInstance();
    
    // Emit leave event
    await this.recordEvent('instance_left', {});
  }

  /**
   * Register this instance
   */
  private async registerInstance(): Promise<void> {
    await query(
      `INSERT INTO instance_registry 
       (instance_id, hostname, pid, start_time, last_heartbeat, role, status, metadata)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)
       ON CONFLICT (instance_id) DO UPDATE SET
         last_heartbeat = CURRENT_TIMESTAMP,
         status = 'active'`,
      [
        this.instanceId,
        this.getHostname(),
        process.pid,
        new Date(),
        'secondary',
        'active',
        JSON.stringify({
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        })
      ]
    );
  }

  /**
   * Unregister this instance
   */
  private async unregisterInstance(): Promise<void> {
    await query(
      `UPDATE instance_registry 
       SET status = 'inactive', last_heartbeat = CURRENT_TIMESTAMP
       WHERE instance_id = $1`,
      [this.instanceId]
    );
  }

  /**
   * Start heartbeat to keep instance active
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await query(
          `UPDATE instance_registry 
           SET last_heartbeat = CURRENT_TIMESTAMP
           WHERE instance_id = $1`,
          [this.instanceId]
        );
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, this.heartbeatFrequency);
  }

  /**
   * Start leader election process
   */
  private async startLeaderElection(): Promise<void> {
    // Initial election
    await this.runElection();
    
    // Periodic re-election
    this.electionInterval = setInterval(async () => {
      await this.runElection();
    }, this.heartbeatFrequency * 3); // Run less frequently than heartbeat
  }

  /**
   * Run leader election
   */
  private async runElection(): Promise<void> {
    try {
      // Get current primary
      const currentPrimary = await this.getCurrentPrimary();
      
      // If no primary or primary is unhealthy, elect new one
      if (!currentPrimary || currentPrimary.status !== 'active') {
        await this.electNewPrimary();
      }
      
      // Check if we are primary
      const ourRole = await this.getOurRole();
      this.emit('role', ourRole);
      
    } catch (error) {
      console.error('Election failed:', error);
    }
  }

  /**
   * Elect new primary instance
   */
  private async electNewPrimary(): Promise<void> {
    await transaction(async (client) => {
      // Get all active instances
      const activeInstances = await client.query(
        `SELECT * FROM instance_registry 
         WHERE status = 'active' 
         AND last_heartbeat > CURRENT_TIMESTAMP - INTERVAL '${this.inactiveThreshold} milliseconds'
         ORDER BY start_time ASC
         FOR UPDATE`
      );
      
      if (activeInstances.rows.length === 0) {
        return;
      }
      
      // Oldest instance becomes primary
      const newPrimary = activeInstances.rows[0];
      
      // Update roles
      await client.query(
        `UPDATE instance_registry SET role = 'secondary' WHERE role = 'primary'`
      );
      
      await client.query(
        `UPDATE instance_registry SET role = 'primary' WHERE instance_id = $1`,
        [newPrimary.instance_id]
      );
      
      // Record event
      await this.recordEvent('role_changed', {
        newPrimary: newPrimary.instance_id,
        previousPrimary: null
      });
      
      console.log(`New primary elected: ${newPrimary.instance_id}`);
    });
  }

  /**
   * Get current primary instance
   */
  async getCurrentPrimary(): Promise<InstanceInfo | null> {
    const result = await queryOne<InstanceInfo>(
      `SELECT * FROM instance_registry 
       WHERE role = 'primary' 
       AND status = 'active'
       AND last_heartbeat > CURRENT_TIMESTAMP - INTERVAL '${this.inactiveThreshold} milliseconds'`
    );
    
    return result;
  }

  /**
   * Check if this instance is primary
   */
  async isPrimary(): Promise<boolean> {
    const result = await queryOne<{ role: string }>(
      `SELECT role FROM instance_registry WHERE instance_id = $1`,
      [this.instanceId]
    );
    
    return result?.role === 'primary';
  }

  /**
   * Get our current role
   */
  private async getOurRole(): Promise<'primary' | 'secondary'> {
    const result = await queryOne<{ role: string }>(
      `SELECT role FROM instance_registry WHERE instance_id = $1`,
      [this.instanceId]
    );
    
    return (result?.role as 'primary' | 'secondary') || 'secondary';
  }

  /**
   * Clean up stale instances
   */
  private async cleanupStaleInstances(): Promise<void> {
    const staleThreshold = this.inactiveThreshold * 2;
    
    await query(
      `UPDATE instance_registry 
       SET status = 'unhealthy'
       WHERE last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '${staleThreshold} milliseconds'
       AND status = 'active'`
    );
  }

  /**
   * Acquire exclusive lock for token refresh
   */
  async acquireTokenRefreshLock(timeoutMs: number = 30000): Promise<boolean> {
    // Only primary can refresh tokens
    if (!await this.isPrimary()) {
      return false;
    }
    
    try {
      await query(
        `INSERT INTO distributed_locks 
         (lock_name, locked_by, locked_at, expires_at, metadata)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '${timeoutMs} milliseconds', $3)
         ON CONFLICT (lock_name) 
         DO UPDATE SET 
           locked_by = EXCLUDED.locked_by,
           locked_at = EXCLUDED.locked_at,
           expires_at = EXCLUDED.expires_at
         WHERE distributed_locks.expires_at < CURRENT_TIMESTAMP`,
        [
          'token_refresh',
          this.instanceId,
          JSON.stringify({ pid: process.pid, hostname: this.getHostname() })
        ]
      );
      
      // Verify we got the lock
      const lock = await queryOne<{ locked_by: string }>(
        `SELECT locked_by FROM distributed_locks 
         WHERE lock_name = $1 AND expires_at > CURRENT_TIMESTAMP`,
        ['token_refresh']
      );
      
      const hasLock = lock?.locked_by === this.instanceId;
      
      if (hasLock) {
        await this.recordEvent('token_refresh_started', {});
      }
      
      return hasLock;
      
    } catch (error) {
      console.error('Failed to acquire token refresh lock:', error);
      return false;
    }
  }

  /**
   * Release token refresh lock
   */
  async releaseTokenRefreshLock(): Promise<void> {
    await query(
      `DELETE FROM distributed_locks 
       WHERE lock_name = $1 AND locked_by = $2`,
      ['token_refresh', this.instanceId]
    );
    
    await this.recordEvent('token_refresh_completed', {});
  }

  /**
   * Get all active instances
   */
  async getActiveInstances(): Promise<InstanceInfo[]> {
    const result = await query<InstanceInfo>(
      `SELECT * FROM instance_registry 
       WHERE status = 'active'
       AND last_heartbeat > CURRENT_TIMESTAMP - INTERVAL '${this.inactiveThreshold} milliseconds'
       ORDER BY role DESC, start_time ASC`
    );
    
    return result;
  }

  /**
   * Record coordination event
   */
  private async recordEvent(type: CoordinationEvent['type'], data?: any): Promise<void> {
    await query(
      `INSERT INTO coordination_events 
       (event_type, instance_id, event_data)
       VALUES ($1, $2, $3)`,
      [type, this.instanceId, JSON.stringify(data)]
    );
    
    this.emit('coordination_event', {
      type,
      instanceId: this.instanceId,
      timestamp: new Date(),
      data
    });
  }

  /**
   * Get recent coordination events
   */
  async getRecentEvents(minutes: number = 10): Promise<CoordinationEvent[]> {
    const result = await query<{
      event_type: string;
      instance_id: string;
      created_at: Date;
      event_data: any;
    }>(
      `SELECT event_type, instance_id, created_at, event_data
       FROM coordination_events
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${minutes} minutes'
       ORDER BY created_at DESC`
    );
    
    return result.map(row => ({
      type: row.event_type as CoordinationEvent['type'],
      instanceId: row.instance_id,
      timestamp: row.created_at,
      data: row.event_data
    }));
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(): string {
    const hostname = this.getHostname();
    const pid = process.pid;
    const random = crypto.randomBytes(4).toString('hex');
    return `${hostname}-${pid}-${random}`;
  }

  /**
   * Get hostname
   */
  private getHostname(): string {
    return process.env.HOSTNAME || require('os').hostname();
  }

  /**
   * Get coordination status
   */
  async getStatus(): Promise<{
    instanceId: string;
    role: 'primary' | 'secondary';
    activeInstances: number;
    isPrimary: boolean;
    currentPrimary: string | null;
    lastElection: Date | null;
  }> {
    const [isPrimary, activeInstances, currentPrimary, lastElection] = await Promise.all([
      this.isPrimary(),
      this.getActiveInstances(),
      this.getCurrentPrimary(),
      this.getLastElectionTime()
    ]);
    
    return {
      instanceId: this.instanceId,
      role: isPrimary ? 'primary' : 'secondary',
      activeInstances: activeInstances.length,
      isPrimary,
      currentPrimary: currentPrimary?.instanceId || null,
      lastElection
    };
  }

  /**
   * Get last election time
   */
  private async getLastElectionTime(): Promise<Date | null> {
    const result = await queryOne<{ created_at: Date }>(
      `SELECT created_at FROM coordination_events
       WHERE event_type = 'role_changed'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    
    return result?.created_at || null;
  }

  /**
   * Create required database tables
   */
  static async ensureTables(): Promise<void> {
    await transaction(async (client) => {
      // Instance registry table
      await client.query(`
        CREATE TABLE IF NOT EXISTS instance_registry (
          instance_id VARCHAR(255) PRIMARY KEY,
          hostname VARCHAR(255) NOT NULL,
          pid INTEGER NOT NULL,
          start_time TIMESTAMP NOT NULL,
          last_heartbeat TIMESTAMP NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'secondary',
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          metadata JSONB
        )
      `);
      
      // Coordination events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS coordination_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          instance_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          event_data JSONB
        )
      `);
      
      // Indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_instance_registry_status 
        ON instance_registry(status, last_heartbeat)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_coordination_events_type_time 
        ON coordination_events(event_type, created_at DESC)
      `);
    });
  }
}