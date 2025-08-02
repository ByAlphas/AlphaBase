/**
 * AlphaBase Connection Pool & Resource Manager
 * V3.0.0 - Professional resource optimization
 */

const fs = require('fs').promises;
const EventEmitter = require('events');

class ConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxConnections = options.maxConnections || 10;
    this.minConnections = options.minConnections || 2;
    this.acquireTimeoutMs = options.acquireTimeoutMs || 30000;
    this.idleTimeoutMs = options.idleTimeoutMs || 300000; // 5 minutes
    
    this.pool = [];
    this.activeConnections = new Set();
    this.waitingQueue = [];
    this.connectionId = 0;
    
    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      timeouts: 0
    };

    // Initialize minimum connections
    this.initializePool();
    
    // Cleanup idle connections
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.idleTimeoutMs / 2);
  }

  async initializePool() {
    const promises = [];
    for (let i = 0; i < this.minConnections; i++) {
      promises.push(this.createConnection());
    }
    const connections = await Promise.all(promises);
    this.pool.push(...connections);
  }

  async createConnection() {
    const connection = {
      id: ++this.connectionId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      inUse: false,
      fileHandles: new Map(), // Cache for file descriptors
      lockQueue: new Map()    // File-level locking
    };

    this.stats.created++;
    this.emit('connection:created', connection);
    return connection;
  }

  async acquire() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stats.timeouts++;
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) this.waitingQueue.splice(index, 1);
        reject(new Error('Connection acquire timeout'));
      }, this.acquireTimeoutMs);

      this.waitingQueue.push({ resolve, reject, timeout });
      this.processQueue();
    });
  }

  async processQueue() {
    while (this.waitingQueue.length > 0 && this.pool.length > 0) {
      const connection = this.pool.pop();
      const waiter = this.waitingQueue.shift();
      
      if (waiter) {
        clearTimeout(waiter.timeout);
        connection.inUse = true;
        connection.lastUsed = Date.now();
        this.activeConnections.add(connection);
        this.stats.acquired++;
        waiter.resolve(connection);
      }
    }

    // Create new connection if pool is empty and under limit
    if (this.waitingQueue.length > 0 && 
        (this.pool.length + this.activeConnections.size) < this.maxConnections) {
      try {
        const newConnection = await this.createConnection();
        this.pool.push(newConnection);
        this.processQueue();
      } catch (error) {
        if (this.waitingQueue.length > 0) {
          const waiter = this.waitingQueue.shift();
          clearTimeout(waiter.timeout);
          waiter.reject(error);
        }
      }
    }
  }

  release(connection) {
    if (!this.activeConnections.has(connection)) {
      throw new Error('Connection not in active pool');
    }

    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.activeConnections.delete(connection);
    this.pool.push(connection);
    this.stats.released++;
    
    this.emit('connection:released', connection);
    this.processQueue();
  }

  cleanupIdleConnections() {
    const now = Date.now();
    const activeCount = this.activeConnections.size;
    const totalCount = this.pool.length + activeCount;

    if (totalCount <= this.minConnections) return;

    // Remove idle connections beyond minimum
    const toRemove = [];
    for (const connection of this.pool) {
      if (now - connection.lastUsed > this.idleTimeoutMs && 
          totalCount - toRemove.length > this.minConnections) {
        toRemove.push(connection);
      }
    }

    for (const connection of toRemove) {
      this.destroyConnection(connection);
    }
  }

  destroyConnection(connection) {
    const poolIndex = this.pool.indexOf(connection);
    if (poolIndex !== -1) {
      this.pool.splice(poolIndex, 1);
    }
    
    this.activeConnections.delete(connection);
    
    // Close file handles
    for (const [path, handle] of connection.fileHandles) {
      handle.close().catch(() => {}); // Ignore errors
    }
    connection.fileHandles.clear();
    
    this.stats.destroyed++;
    this.emit('connection:destroyed', connection);
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      activeConnections: this.activeConnections.size,
      waitingQueue: this.waitingQueue.length,
      totalConnections: this.pool.length + this.activeConnections.size
    };
  }

  async shutdown() {
    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    // Wait for active operations
    while (this.activeConnections.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Destroy all connections
    const allConnections = [...this.pool];
    for (const connection of allConnections) {
      this.destroyConnection(connection);
    }
    
    // Reject waiting requests
    for (const waiter of this.waitingQueue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('Pool shutdown'));
    }
    this.waitingQueue.length = 0;
  }
}

// File-level locking mechanism
class FileLockManager {
  constructor() {
    this.locks = new Map(); // filePath -> { exclusive: boolean, count: number, waiters: [] }
  }

  async acquireLock(filePath, exclusive = false) {
    return new Promise((resolve, reject) => {
      if (!this.locks.has(filePath)) {
        this.locks.set(filePath, { exclusive: false, count: 0, waiters: [] });
      }

      const lock = this.locks.get(filePath);

      // Can acquire immediately
      if (lock.count === 0 || (!exclusive && !lock.exclusive)) {
        lock.count++;
        if (exclusive) lock.exclusive = true;
        resolve();
        return;
      }

      // Must wait
      lock.waiters.push({ resolve, reject, exclusive });
    });
  }

  releaseLock(filePath, wasExclusive = false) {
    const lock = this.locks.get(filePath);
    if (!lock) return;

    lock.count--;
    if (wasExclusive) lock.exclusive = false;

    if (lock.count === 0 && lock.waiters.length > 0) {
      // Process waiting requests
      const waiter = lock.waiters.shift();
      lock.count++;
      if (waiter.exclusive) lock.exclusive = true;
      waiter.resolve();
    }

    // Cleanup empty locks
    if (lock.count === 0 && lock.waiters.length === 0) {
      this.locks.delete(filePath);
    }
  }
}

module.exports = { ConnectionPool, FileLockManager };
