/**
 * AlphaBase V3.0.0 Performance Configuration
 * Professional optimization settings
 */

module.exports = {
  // Performance optimization settings
  performance: {
    // Enable performance mode (caching, batching, pooling)
    enabled: true,
    
    // Write optimization
    batchWrite: true,
    deferredWriteTimeout: 1000, // ms
    
    // Connection pooling
    useConnectionPool: true,
    maxConnections: 20,
    minConnections: 3,
    idleTimeoutMs: 300000, // 5 minutes
    
    // File locking
    useFileLocking: true,
    
    // Cache settings
    cache: {
      maxReadCacheSize: 1000,
      readCacheTTL: 30000, // 30 seconds
      writeBatchSize: 10,
      writeBatchTimeout: 1000 // 1 second
    }
  },

  // Memory management
  memory: {
    // Auto cleanup settings
    autoCleanupInterval: 60000, // 1 minute
    maxMemoryThreshold: 100 * 1024 * 1024, // 100MB
    
    // Cache eviction
    cacheEvictionPercent: 20, // Remove 20% when full
    
    // Garbage collection hints
    enableGCHints: true,
    gcInterval: 300000 // 5 minutes
  },

  // I/O optimization
  io: {
    // Use atomic writes (temp file + rename)
    atomicWrites: true,
    
    // File buffer size
    bufferSize: 64 * 1024, // 64KB
    
    // Compression for large values
    compression: {
      enabled: false, // Disabled by default
      threshold: 1024, // Compress values > 1KB
      algorithm: 'gzip'
    }
  },

  // Monitoring and metrics
  monitoring: {
    // Enable performance metrics collection
    enabled: true,
    
    // Metrics collection interval
    interval: 30000, // 30 seconds
    
    // Keep metrics history
    historySize: 100,
    
    // Alert thresholds
    alerts: {
      highMemoryUsage: 80, // percent
      slowOperations: 1000, // ms
      highCacheMissRate: 50 // percent
    }
  },

  // Development vs Production presets
  presets: {
    development: {
      performance: { enabled: true },
      memory: { autoCleanupInterval: 10000 },
      monitoring: { enabled: true, interval: 5000 }
    },
    
    production: {
      performance: { 
        enabled: true,
        cache: { maxReadCacheSize: 5000, readCacheTTL: 60000 }
      },
      memory: { 
        autoCleanupInterval: 300000,
        maxMemoryThreshold: 500 * 1024 * 1024 // 500MB
      },
      monitoring: { enabled: true, interval: 60000 }
    },
    
    highPerformance: {
      performance: {
        enabled: true,
        maxConnections: 50,
        cache: { 
          maxReadCacheSize: 10000, 
          readCacheTTL: 120000,
          writeBatchSize: 50
        }
      },
      memory: {
        maxMemoryThreshold: 1024 * 1024 * 1024, // 1GB
        autoCleanupInterval: 600000 // 10 minutes
      },
      io: {
        compression: { enabled: true, threshold: 512 }
      }
    }
  }
};
