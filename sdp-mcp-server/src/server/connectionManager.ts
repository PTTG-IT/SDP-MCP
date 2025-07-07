import { EventEmitter } from 'events';
import { logger } from '../monitoring/logging.js';
import { auditLogger } from '../monitoring/auditLogger.js';
import type { ConnectionInfo, TenantConnectionState } from './types.js';

/**
 * Connection Manager
 * Tracks and manages client connections
 */
export interface ConnectionManager {
  addConnection(info: ConnectionInfo): void;
  removeConnection(connectionId: string): void;
  updateActivity(connectionId: string): void;
  getConnection(connectionId: string): ConnectionInfo | undefined;
  getActiveConnections(): ConnectionInfo[];
  getActiveTenants(): string[];
  getTenantConnections(tenantId: string): ConnectionInfo[];
  getTenantState(tenantId: string): TenantConnectionState | undefined;
  start(): void;
  stop(): void;
}

/**
 * Create connection manager
 */
export function createConnectionManager(): ConnectionManager {
  const connections = new Map<string, ConnectionInfo>();
  const tenantStates = new Map<string, TenantConnectionState>();
  const eventEmitter = new EventEmitter();
  let cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Add a new connection
   */
  function addConnection(info: ConnectionInfo): void {
    connections.set(info.id, info);
    
    // Update tenant state
    let tenantState = tenantStates.get(info.tenantId);
    if (!tenantState) {
      tenantState = {
        tenantId: info.tenantId,
        connections: [],
        activeTools: [],
        lastActivity: new Date(),
        totalRequests: 0,
        totalErrors: 0,
      };
      tenantStates.set(info.tenantId, tenantState);
    }

    // Add to tenant connections
    const existingIndex = tenantState.connections.findIndex(c => c.id === info.id);
    if (existingIndex === -1) {
      tenantState.connections.push(info);
    }

    logger.info('Connection added', {
      connectionId: info.id,
      tenantId: info.tenantId,
      clientId: info.clientId,
      transport: info.transport,
    });

    // Log to audit
    auditLogger.log({
      tenantId: info.tenantId,
      eventType: 'mcp.connection.added',
      eventCategory: 'connection',
      actorType: 'client',
      actorId: info.clientId,
      action: 'connect',
      result: 'success',
      metadata: {
        connectionId: info.id,
        transport: info.transport,
        remoteAddress: info.remoteAddress,
        userAgent: info.userAgent,
      },
    }).catch(error => {
      logger.error('Failed to log connection event', { error });
    });

    // Emit event
    eventEmitter.emit('connection:added', info);
  }

  /**
   * Remove a connection
   */
  function removeConnection(connectionId: string): void {
    const connection = connections.get(connectionId);
    if (!connection) {
      return;
    }

    connections.delete(connectionId);

    // Update tenant state
    const tenantState = tenantStates.get(connection.tenantId);
    if (tenantState) {
      tenantState.connections = tenantState.connections.filter(
        c => c.id !== connectionId
      );

      // Remove tenant state if no more connections
      if (tenantState.connections.length === 0) {
        tenantStates.delete(connection.tenantId);
      }
    }

    logger.info('Connection removed', {
      connectionId,
      tenantId: connection.tenantId,
      clientId: connection.clientId,
    });

    // Log to audit
    auditLogger.log({
      tenantId: connection.tenantId,
      eventType: 'mcp.connection.removed',
      eventCategory: 'connection',
      actorType: 'client',
      actorId: connection.clientId,
      action: 'disconnect',
      result: 'success',
      metadata: {
        connectionId,
        duration: Date.now() - connection.connectedAt.getTime(),
      },
    }).catch(error => {
      logger.error('Failed to log disconnection event', { error });
    });

    // Emit event
    eventEmitter.emit('connection:removed', connection);
  }

  /**
   * Update connection activity
   */
  function updateActivity(connectionId: string): void {
    const connection = connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();

      // Update tenant state
      const tenantState = tenantStates.get(connection.tenantId);
      if (tenantState) {
        tenantState.lastActivity = new Date();
      }
    }
  }

  /**
   * Get a specific connection
   */
  function getConnection(connectionId: string): ConnectionInfo | undefined {
    return connections.get(connectionId);
  }

  /**
   * Get all active connections
   */
  function getActiveConnections(): ConnectionInfo[] {
    return Array.from(connections.values());
  }

  /**
   * Get list of active tenant IDs
   */
  function getActiveTenants(): string[] {
    return Array.from(tenantStates.keys());
  }

  /**
   * Get connections for a specific tenant
   */
  function getTenantConnections(tenantId: string): ConnectionInfo[] {
    const tenantState = tenantStates.get(tenantId);
    return tenantState ? [...tenantState.connections] : [];
  }

  /**
   * Get tenant connection state
   */
  function getTenantState(tenantId: string): TenantConnectionState | undefined {
    return tenantStates.get(tenantId);
  }

  /**
   * Cleanup stale connections
   */
  function cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [id, connection] of connections) {
      const lastActivityTime = connection.lastActivity.getTime();
      if (now - lastActivityTime > staleThreshold) {
        logger.warn('Removing stale connection', {
          connectionId: id,
          lastActivity: connection.lastActivity,
        });
        removeConnection(id);
      }
    }
  }

  /**
   * Start the connection manager
   */
  function start(): void {
    logger.info('Starting connection manager');

    // Start cleanup interval
    cleanupInterval = setInterval(() => {
      cleanupStaleConnections();
    }, 60000); // Check every minute

    // Log current state
    logger.info('Connection manager started', {
      activeConnections: connections.size,
      activeTenants: tenantStates.size,
    });
  }

  /**
   * Stop the connection manager
   */
  function stop(): void {
    logger.info('Stopping connection manager');

    // Clear cleanup interval
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }

    // Log final state
    logger.info('Connection manager stopped', {
      totalConnections: connections.size,
      totalTenants: tenantStates.size,
    });

    // Clear all connections
    connections.clear();
    tenantStates.clear();
  }

  // Public API
  return {
    addConnection,
    removeConnection,
    updateActivity,
    getConnection,
    getActiveConnections,
    getActiveTenants,
    getTenantConnections,
    getTenantState,
    start,
    stop,
  };
}

/**
 * Connection monitor for tracking metrics
 */
export function createConnectionMonitor(connectionManager: ConnectionManager) {
  return {
    /**
     * Get connection metrics
     */
    getMetrics(): {
      totalConnections: number;
      totalTenants: number;
      connectionsByTransport: Record<string, number>;
      connectionsByTenant: Record<string, number>;
    } {
      const connections = connectionManager.getActiveConnections();
      const connectionsByTransport: Record<string, number> = {};
      const connectionsByTenant: Record<string, number> = {};

      for (const connection of connections) {
        // Count by transport
        connectionsByTransport[connection.transport] = 
          (connectionsByTransport[connection.transport] || 0) + 1;

        // Count by tenant
        connectionsByTenant[connection.tenantId] = 
          (connectionsByTenant[connection.tenantId] || 0) + 1;
      }

      return {
        totalConnections: connections.length,
        totalTenants: connectionManager.getActiveTenants().length,
        connectionsByTransport,
        connectionsByTenant,
      };
    },

    /**
     * Get tenant metrics
     */
    getTenantMetrics(tenantId: string): {
      connections: number;
      totalRequests: number;
      totalErrors: number;
      lastActivity?: Date;
    } | null {
      const state = connectionManager.getTenantState(tenantId);
      if (!state) {
        return null;
      }

      return {
        connections: state.connections.length,
        totalRequests: state.totalRequests,
        totalErrors: state.totalErrors,
        lastActivity: state.lastActivity,
      };
    },
  };
}