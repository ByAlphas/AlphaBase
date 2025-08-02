/**
 * AlphaBase Performance Optimization Module
 * V3.0.0 - Advanced memory management and caching
 */

class PerformanceOptimizer {
  constructor(database) {
    this.db = database;
    this.writeCache = new Map(); // Write batching cache
    this.readCache = new Map();  // Read cache with TTL
    this.cacheConfig = {
      maxReadCacheSize: 1000,
      readCacheTTL: 30000, // 30 seconds
      writeBatchSize: 10,
      writeBatchTimeout: 1000, // 1 second
    };
    this.writeBatchTimer = null;
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchedWrites: 0,
      totalOperations: 0
    };
  }

  // Read cache with intelligent TTL
  getCached(key) {
    const cached = this.readCache.get(key);
    if (cached && Date.now() < cached.expires) {
      this.metrics.cacheHits++;
      return cached.value;
    }
    if (cached) {
      this.readCache.delete(key);
    }
    this.metrics.cacheMisses++;
    return null;
  }

  // Cache optimization with memory management
  setCached(key, value) {
    // Prevent memory bloat
    if (this.readCache.size >= this.cacheConfig.maxReadCacheSize) {
      this.evictOldestCacheEntries();
    }

    this.readCache.set(key, {
      value: this.deepClone(value),
      expires: Date.now() + this.cacheConfig.readCacheTTL,
      lastAccess: Date.now()
    });
  }

  // Memory-efficient deep clone
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  // LRU cache eviction
  evictOldestCacheEntries() {
    const entries = Array.from(this.readCache.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    const toRemove = Math.floor(this.cacheConfig.maxReadCacheSize * 0.2); // Remove 20%
    for (let i = 0; i < toRemove; i++) {
      this.readCache.delete(entries[i][0]);
    }
  }

  // Write batching for improved I/O performance
  batchWrite(key, value, options = {}) {
    this.writeCache.set(key, { value, options, timestamp: Date.now() });

    if (this.writeCache.size >= this.cacheConfig.writeBatchSize) {
      this.flushWrites();
    } else if (!this.writeBatchTimer) {
      this.writeBatchTimer = setTimeout(() => {
        this.flushWrites();
      }, this.cacheConfig.writeBatchTimeout);
    }
  }

  // Flush batched writes
  async flushWrites() {
    if (this.writeCache.size === 0) return;

    const operations = Array.from(this.writeCache.entries());
    this.writeCache.clear();
    
    if (this.writeBatchTimer) {
      clearTimeout(this.writeBatchTimer);
      this.writeBatchTimer = null;
    }

    // Batch operations for single file write
    const batchOps = operations.map(([key, data]) => ({
      op: 'set',
      key,
      value: data.value,
      options: data.options
    }));

    await this.db.batchAsync(batchOps);
    this.metrics.batchedWrites += operations.length;
  }

  // Memory usage monitoring
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
      readCacheSize: this.readCache.size,
      writeCacheSize: this.writeCache.size,
      cacheHitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
    };
  }

  // Performance metrics
  getPerformanceMetrics() {
    return {
      ...this.metrics,
      cacheHitRatio: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      avgBatchSize: this.metrics.batchedWrites / (this.metrics.totalOperations || 1)
    };
  }

  // Clear all caches
  clearCaches() {
    this.readCache.clear();
    this.writeCache.clear();
    if (this.writeBatchTimer) {
      clearTimeout(this.writeBatchTimer);
      this.writeBatchTimer = null;
    }
  }

  // Cleanup on shutdown
  async shutdown() {
    await this.flushWrites();
    this.clearCaches();
  }
}

module.exports = PerformanceOptimizer;
