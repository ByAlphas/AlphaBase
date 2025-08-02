// Multi-DB manager
class AlphaBaseManager {
  constructor() {
    this.databases = {};
  }
  open(filePath, options = {}) {
    if (!this.databases[filePath]) {
      this.databases[filePath] = new AlphaBase({ ...options, filePath });
    }
    return this.databases[filePath];
  }
  close(filePath) {
    delete this.databases[filePath];
  }
  list() {
    return Object.keys(this.databases);
  }
  get(filePath) {
    return this.databases[filePath];
  }
}

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const encryption = require('./encryption');
const PerformanceOptimizer = require('./performance');
const { ConnectionPool, FileLockManager } = require('./pool');

// Native Base64 encryption/decryption helpers  
function base64Encrypt(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}
function base64Decrypt(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

const crypto = require('crypto');
const { AESEncryption, DESEncryption, TripleDESEncryption, RabbitEncryption, XOREncryption } = require('./encryption');
const { JWTAuth, AuditLogger, DataIntegrity, RSAEncryption } = require('./security');

// Global instances registry for cleanup
const globalInstances = new Set();

// Cleanup function for all instances
const cleanupAllInstances = async () => {
  const cleanupPromises = Array.from(globalInstances).map(instance => {
    if (instance && instance.cleanup) {
      return instance.cleanup().catch(() => {}); // Ignore cleanup errors
    }
  });
  await Promise.all(cleanupPromises);
  globalInstances.clear();
};

// Handle process termination
process.on('exit', () => cleanupAllInstances());
process.on('SIGINT', () => cleanupAllInstances().then(() => process.exit(0)));
process.on('SIGTERM', () => cleanupAllInstances().then(() => process.exit(0)));

/**
 * AlphaBase - A lightweight JSON database with encryption and advanced features
 * @version 3.0.0
 */
class AlphaBase {
  // Synchronous: check if key exists
  hasSync(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    this.cleanupSync();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      this._saveSync();
      return false;
    }
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  // Synchronous: clear all data
  clearSync() {
    this.data = {};
    this.ttlMeta = {};
    this._saveSync();
  }

  // Synchronous: get all data
  allSync() {
    this.cleanupSync();
    const out = {};
    for (const key of Object.keys(this.data)) {
      if (!this.ttlMeta[key] || this.ttlMeta[key] > Date.now()) {
        out[key] = this.data[key];
      }
    }
    return out;
  }

  // Internal: add change to document history (avoid circular refs)
  _addHistory(doc, change) {
    if (!doc._history) doc._history = [];
    if (!doc.updatedAt) doc.updatedAt = Date.now();
    // Avoid circular reference by not storing the full object in value
    let safeChange = { ...change, at: Date.now() };
    if (safeChange.value && typeof safeChange.value === 'object') {
      try {
        safeChange.value = JSON.parse(JSON.stringify(safeChange.value));
      } catch {
        safeChange.value = '[Unserializable]';
      }
    }
    doc._history.unshift(safeChange);
    if (doc._history.length > 3) doc._history = doc._history.slice(0, 3);
    doc.updatedAt = Date.now();
  }
  // Transaction support
  beginTransaction() {
    if (this._transaction) throw new Error('Transaction already in progress');
    this._transaction = {
      data: JSON.parse(JSON.stringify(this.data)),
      ttlMeta: JSON.parse(JSON.stringify(this.ttlMeta))
    };
  }
  commit() {
    if (!this._transaction) throw new Error('No transaction in progress');
    this._transaction = null;
    this._saveSync();
  }
  rollback() {
    if (!this._transaction) throw new Error('No transaction in progress');
    this.data = this._transaction.data;
    this.ttlMeta = this._transaction.ttlMeta;
    this._transaction = null;
    this._saveSync();
  }
  transactionSync(ops) {
    this.beginTransaction();
    try {
      this.batchSync(ops);
      this.commit();
    } catch (e) {
      this.rollback();
      throw e;
    }
  }

  // Scheduled cleanup
  startScheduledCleanup(intervalMs) {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    this._cleanupInterval = setInterval(() => {
      try { this.cleanupSync(); } catch (e) {}
    }, intervalMs);
  }
  stopScheduledCleanup() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    this._cleanupInterval = null;
  }

  /**
   * Exports a specific collection to a JSON file.
   * @param {string} collection - Collection name (key)
   * @param {string} filePath - Output file path
   */
  exportCollection(collection, filePath) {
    if (typeof collection !== 'string') throw new TypeError('Collection name must be a string');
    if (!filePath || typeof filePath !== 'string') throw new TypeError('File path must be a string');
    const data = this.data[collection];
    if (!data) throw new Error(`Collection '${collection}' not found.`);
    let out = JSON.stringify(data, null, 2);
    // Optional encryption for export
    if (arguments[2] && arguments[2].encrypt && this.password) {
      let encType = this.encryptionType;
      let encrypted;
      if (encType === 'Base64') {
        encrypted = base64Encrypt(out);
      } else {
        encrypted = encryption.encrypt(out, this.password, encType);
      }
      out = JSON.stringify({ _encrypted: true, type: encType, data: encrypted });
    }
    try {
      fs.writeFileSync(filePath, out, 'utf8');
    } catch (err) {
      throw new Error(`Failed to export collection: ${err.message}`);
    }
  }

  /**
   * Imports data from a JSON file into a collection.
   * @param {string} collection - Collection name (key)
   * @param {string} filePath - Input file path
   */
  importCollection(collection, filePath) {
    if (typeof collection !== 'string') throw new TypeError('Collection name must be a string');
    if (!filePath || typeof filePath !== 'string') throw new TypeError('File path must be a string');
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read file: ${err.message}`);
    }
    let docs;
    try {
      const parsed = JSON.parse(fileContent);
      if (parsed && parsed._encrypted && parsed.data && this.password) {
        // Auto-decrypt if password is set
        let encType = parsed.type || this.encryptionType;
        let decrypted;
        if (encType === 'Base64') {
          decrypted = base64Decrypt(parsed.data);
        } else {
          decrypted = encryption.decrypt(parsed.data, this.password, encType);
        }
        docs = JSON.parse(decrypted);
      } else {
        docs = parsed;
      }
    } catch (err) {
      throw new Error(`Invalid JSON in import file: ${err.message}`);
    }
    if (!Array.isArray(docs) && typeof docs !== 'object') {
      throw new Error('Imported data must be an array or object.');
    }
    // Create collection if it does not exist
    if (!this.data[collection]) this.data[collection] = Array.isArray(docs) ? [] : {};
    // Insert logic: if array, push; if object, assign
    if (Array.isArray(this.data[collection]) && Array.isArray(docs)) {
      this.data[collection].push(...docs);
    } else if (typeof this.data[collection] === 'object' && typeof docs === 'object' && !Array.isArray(docs)) {
      Object.assign(this.data[collection], docs);
    } else {
      throw new Error('Collection type mismatch.');
    }
    this._saveSync();
  }
  constructor(options = {}) {
    this.filePath = options.filePath || path.resolve(process.cwd(), 'alphabase.json');
    this.backupDir = options.backupDir || path.resolve(path.dirname(this.filePath), 'backups');
    this.schema = options.schema || null;
    this.password = options.password || null;
    this.encryptionType = options.encryption || 'AES';
    
    // Performance optimizations - instance-based for proper cleanup
    this.performanceMode = options.performanceMode !== false; // Default enabled
    this.optimizer = this.performanceMode ? new PerformanceOptimizer(this) : null;
    
    // Disable connection pool in test environment to prevent open handles
    const isTestEnv = process.env.NODE_ENV === 'test' || 
                      process.env.JEST_WORKER_ID || 
                      global.ALPHABASE_TEST_MODE ||
                      process.env.ALPHABASE_DISABLE_CONNECTION_POOL === 'true';
                      
    this.connectionPool = (options.useConnectionPool !== false && !isTestEnv) ? new ConnectionPool({
      maxConnections: 10,
      minConnections: 2,
      idleTimeoutMs: 30000 // Shorter timeout for tests
    }) : null;
    this.fileLockManager = options.useFileLocking !== false ? new FileLockManager() : null;
    
    // Write optimization settings
    this.batchWriteEnabled = options.batchWrite !== false;
    this.deferredWriteTimeout = options.deferredWriteTimeout || 1000;
    this.writeQueue = [];
    this.writeTimer = null;
    this.ajv = this.schema ? new Ajv() : null;
    this.validator = this.schema ? this.ajv.compile(this.schema) : null;
    
    // Security features (optional)
    this.jwtAuth = options.jwtSecret ? new JWTAuth(options.jwtSecret) : null;
    this.auditLogger = options.audit ? new AuditLogger(options.audit) : null;
    this.dataIntegrity = options.integrity !== false ? new DataIntegrity() : null;
    this.rsaEncryption = options.rsa ? new RSAEncryption() : null;
    
    // Register for cleanup
    globalInstances.add(this);
    
    this._ensureFile();
    this._loadSync();
    this._backupInterval = null;
    if (options.autoBackupInterval) {
      this.startAutoBackup(options.autoBackupInterval);
    }
    // TTL metadata
    this.ttlMeta = {};
    this._loadTTL();
  }
  

  // Internal: Ensure DB file and backup dir exist
  _ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '{}', 'utf8');
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Internal: Load DB synchronously
  _loadSync() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      let json;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        // Dosya bozuksa veya şifreli ise
        json = null;
      }
      if (json && json._encrypted && json.data) {
        // Şifreli JSON sarmalayıcı
        try {
          const decrypted = encryption.decrypt(json.data, this.password, json.type || this.encryptionType);
          const parsed = JSON.parse(decrypted);
          this.data = parsed.data || {};
          this.ttlMeta = parsed.ttlMeta || {};
        } catch (err) {
          // Şifre çözme başarısız
          this.data = {};
          this.ttlMeta = {};
        }
      } else if (json) {
        this.data = json.data || json;
        this.ttlMeta = json.ttlMeta || {};
      } else if (this.password || this.encryptionType !== 'None') {
        // Eski format: doğrudan şifreli string
        try {
          const decrypted = encryption.decrypt(raw, this.password, this.encryptionType);
          const parsed = JSON.parse(decrypted);
          this.data = parsed.data || {};
          this.ttlMeta = parsed.ttlMeta || {};
        } catch (err) {
          this.data = {};
          this.ttlMeta = {};
        }
      } else {
        this.data = {};
        this.ttlMeta = {};
      }
      this.cleanupSync();
    } catch (e) {
      this.data = {};
      this.ttlMeta = {};
    }
  }


  // Internal: Load TTL metadata from file if exists
  _loadTTL() {
    if (this.ttlMeta && typeof this.ttlMeta === 'object') {
      this.cleanupSync();
    }
  }

  // Remove expired keys (sync)
  cleanupSync() {
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(this.ttlMeta)) {
      if (this.ttlMeta[key] && this.ttlMeta[key] < now) {
        delete this.data[key];
        delete this.ttlMeta[key];
        changed = true;
      }
    }
    if (changed) this._saveSync();
  }

  // Enhanced cleanup with optimization
  async cleanup() {
    const now = Date.now();
    let changed = false;
    const expiredKeys = [];
    
    // Collect expired keys first (avoid modifying during iteration)
    for (const key of Object.keys(this.ttlMeta)) {
      if (this.ttlMeta[key] && this.ttlMeta[key] < now) {
        expiredKeys.push(key);
        changed = true;
      }
    }
    
    // Remove expired keys and clear from cache
    for (const key of expiredKeys) {
      delete this.data[key];
      delete this.ttlMeta[key];
      if (this.optimizer) {
        this.optimizer.readCache.delete(key);
      }
    }
    
    if (changed) {
      // Use sync save for better performance
      this._saveSync();
      
      // Audit expired keys cleanup
      if (this.auditLogger && expiredKeys.length > 0) {
        await this.auditLogger.log('ttl_cleanup', 'system', 'cleanup', {
          expiredKeys: expiredKeys.length,
          keys: expiredKeys.slice(0, 10) // Log first 10 keys
        });
      }
    }
  }

  getTTL(key) {
    if (!this.ttlMeta[key]) return 0;
    const remaining = this.ttlMeta[key] - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  // Internal: Validate data if schema is set
  _validate(key, value) {
    if (this.validator) {
      const valid = this.validator(value);
      if (!valid) {
        throw new Error(`Schema validation failed for key '${key}': ${JSON.stringify(this.validator.errors)}`);
      }
    }
  }

  // Optimized synchronous methods with caching
  setSync(key, value, options = {}) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    this._validate(key, value);
    
    // Performance optimization: check cache first
    if (this.optimizer) {
      const cached = this.optimizer.getCached(key);
      if (cached !== null && JSON.stringify(cached) === JSON.stringify(value)) {
        return; // No change, skip write
      }
      this.optimizer.setCached(key, value);
    }
    
    // Minimal change history & updatedAt
    if (typeof value === 'object' && value !== null) {
      this._addHistory(value, { type: 'set', value });
    }
    
    this.data[key] = value;
    if (options.ttl) {
      this.ttlMeta[key] = Date.now() + options.ttl;
    } else {
      delete this.ttlMeta[key];
    }
    
    this.cleanupSync();
    
    // Deferred write for performance
    if (this.batchWriteEnabled && !options.immediate) {
      this._queueWrite();
    } else {
      this._saveSync();
    }
  }

  // Optimized read with intelligent caching
  getSync(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    
    // Performance optimization: check cache first
    if (this.optimizer) {
      const cached = this.optimizer.getCached(key);
      if (cached !== null) {
        return cached;
      }
    }
    
    this.cleanupSync();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      this._saveSync();
      return undefined;
    }
    
    const value = this.data[key];
    
    // Cache the result for future reads
    if (this.optimizer && value !== undefined) {
      this.optimizer.setCached(key, value);
    }
    
    return value;
  }

  deleteSync(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    if (this.data[key] && typeof this.data[key] === 'object') {
      this._addHistory(this.data[key], { type: 'delete', value: this.data[key] });
    }
    delete this.data[key];
    delete this.ttlMeta[key];
    this._saveSync();
  }
  /**
   * Set TTL (ms) for a document in a collection (array or object)
   */
  setTTL(collection, id, ttlMs) {
    const col = this.data[collection];
    if (!col) throw new Error('Collection not found');
    let doc;
    if (Array.isArray(col)) {
      doc = col.find(d => d.id === id);
    } else {
      doc = col[id];
    }
    if (!doc) throw new Error('Document not found');
    if (!this.ttlMeta[collection]) this.ttlMeta[collection] = {};
    this.ttlMeta[collection][id] = Date.now() + ttlMs;
    this._saveSync();
  }

  // Deferred write queue for batch processing
  _queueWrite() {
    if (this.writeTimer) return; // Already queued
    
    this.writeTimer = setTimeout(() => {
      this._saveSync();
      this.writeTimer = null;
    }, this.deferredWriteTimeout);
  }

  // Force immediate write (flush queue)
  flushSync() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this._saveSync();
  }

  // Internal: Save DB synchronously (restored original method)
  _saveSync() {
    const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      };
    };
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let out;
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    if (effectiveEncryptionType !== 'None') {
      let encrypted;
      if (effectiveEncryptionType === 'Base64') {
        encrypted = base64Encrypt(JSON.stringify(outObj, getCircularReplacer()));
      } else {
        encrypted = encryption.encrypt(JSON.stringify(outObj, getCircularReplacer()), this.password, effectiveEncryptionType);
      }
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, getCircularReplacer(), 2);
    }
    fs.writeFileSync(this.filePath, out, 'utf8');
  }

  // Enhanced batch operations with connection pooling
  async batchAsync(ops) {
    if (!Array.isArray(ops)) throw new TypeError('Batch must be an array');
    
    let connection;
    if (this.connectionPool) {
      connection = await this.connectionPool.acquire();
    }
    
    try {
      // Acquire file lock for atomic batch operation
      if (this.fileLockManager) {
        await this.fileLockManager.acquireLock(this.filePath, true);
      }
      
      const startTime = Date.now();
      
      // Process operations in memory first
      for (const op of ops) {
        if (op.op === 'set') {
          this.data[op.key] = op.value;
          if (op.options?.ttl) {
            this.ttlMeta[op.key] = Date.now() + op.options.ttl;
          }
        } else if (op.op === 'delete') {
          delete this.data[op.key];
          delete this.ttlMeta[op.key];
        }
      }
      
      // Single atomic write
      this._saveSync();
      
      // Update performance metrics
      if (this.optimizer) {
        this.optimizer.metrics.batchedWrites += ops.length;
        this.optimizer.metrics.totalOperations += ops.length;
      }
      
      // Audit logging
      if (this.auditLogger && ops.length > 0) {
        await this.auditLogger.log('batch_operation', 'system', 'batch', {
          operations: ops.length,
          duration: Date.now() - startTime
        });
      }
      
    } finally {
      // Release file lock
      if (this.fileLockManager) {
        this.fileLockManager.releaseLock(this.filePath, true);
      }
      
      // Release connection
      if (connection && this.connectionPool) {
        this.connectionPool.release(connection);
      }
    }
  }

  cleanupSync() {
    const now = Date.now();
    let changed = false;
    // Support both old and new TTL structure
    for (const key of Object.keys(this.ttlMeta)) {
      if (typeof this.ttlMeta[key] === 'object') {
        // Per-document TTL for collections
        for (const docId of Object.keys(this.ttlMeta[key])) {
          if (this.ttlMeta[key][docId] < now) {
            if (this.data[key]) {
              if (Array.isArray(this.data[key])) {
                const idx = this.data[key].findIndex(d => d.id === docId);
                if (idx !== -1) this.data[key].splice(idx, 1);
              } else {
                delete this.data[key][docId];
              }
            }
            delete this.ttlMeta[key][docId];
            changed = true;
          }
        }
      } else if (this.ttlMeta[key] && this.ttlMeta[key] < now) {
        delete this.data[key];
        delete this.ttlMeta[key];
        changed = true;
      }
    }
    if (changed) this._saveSync();
  }
  // Enhanced statistics with performance metrics
  statsSync() {
    const stats = fs.statSync(this.filePath);
    const keys = Object.keys(this.data);
    const totalKeys = keys.length;
    let totalValueSize = 0;
    let largestValueSize = 0;
    let largestKey = '';
    
    for (const key of keys) {
      let valueSize = 0;
      try {
        valueSize = Buffer.byteLength(JSON.stringify(this.data[key]), 'utf8');
      } catch {
        valueSize = 0;
      }
      totalValueSize += valueSize;
      if (valueSize > largestValueSize) largestValueSize = valueSize;
      if (key.length > largestKey.length) largestKey = key;
    }
    
    const averageValueSize = totalKeys > 0 ? Math.round(totalValueSize / totalKeys) : 0;
    const baseStats = {
      totalKeys,
      fileSize: stats.size,
      lastModified: new Date(stats.mtime),
      memoryUsage: process.memoryUsage().heapUsed,
      averageValueSize,
      largestKey,
      largestValueSize
    };
    
    // Add performance metrics if optimizer is enabled
    if (this.optimizer) {
      return {
        ...baseStats,
        performance: this.optimizer.getPerformanceMetrics(),
        memory: this.optimizer.getMemoryStats(),
        connectionPool: this.connectionPool ? this.connectionPool.getStats() : null
      };
    }
    
    return baseStats;
  }

  importSync(data, ttlMeta = {}) {
    let importData = data;
    if (typeof data === 'string') {
      try {
        importData = JSON.parse(data);
      } catch (e) {
        // Şifreli JSON olabilir
        try {
          const parsed = JSON.parse(data);
          if (parsed._encrypted && parsed.data) {
            let encType = parsed.type || this.encryptionType;
            let decrypted;
            if (encType === 'Base64') {
              decrypted = base64Decrypt(parsed.data);
            } else {
              decrypted = encryption.decrypt(parsed.data, this.password, encType);
            }
            importData = JSON.parse(decrypted);
          } else {
            throw new Error('Invalid import string');
          }
        } catch (err) {
          throw new Error('Import failed: ' + err.message);
        }
      }
    }
    if (typeof importData !== 'object' || Array.isArray(importData)) {
      throw new TypeError('Import data must be an object or JSON string');
    }
    this.data = { ...(importData.data || importData) };
    this.ttlMeta = { ...(importData.ttlMeta || ttlMeta) };
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let out;
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    fs.writeFileSync(this.filePath, out, 'utf8');
  }

  exportSync(asString = false) {
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    if (asString) return JSON.stringify(outObj, null, 2);
    return { ...this.data };
  }

  backupSync() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${ts}.json`);
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let out;
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    if (effectiveEncryptionType !== 'None') {
      let encrypted;
      if (effectiveEncryptionType === 'Base64') {
        encrypted = base64Encrypt(JSON.stringify(outObj));
      } else {
        encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      }
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    fs.writeFileSync(backupPath, out, 'utf8');
    return backupPath;
  }

  // Asynchronous methods
  async set(key, value, options = {}) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    this._validate(key, value);
    this.data[key] = value;
    if (options.ttl) {
      this.ttlMeta[key] = Date.now() + options.ttl;
    } else {
      delete this.ttlMeta[key];
    }
    await this.cleanup();
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async get(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    await this.cleanup();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      await this._saveSync();
      return undefined;
    }
    return this.data[key];
  }

  async delete(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    delete this.data[key];
    delete this.ttlMeta[key];
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async has(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    await this.cleanup();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      await this._saveSync();
      return false;
    }
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  async clear() {
    this.data = {};
    this.ttlMeta = {};
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async all() {
    await this.cleanup();
    const out = {};
    for (const key of Object.keys(this.data)) {
      if (!this.ttlMeta[key] || this.ttlMeta[key] > Date.now()) {
        out[key] = this.data[key];
      }
    }
    return out;
  }

  async stats() {
    const stats = await fs.promises.stat(this.filePath);
    const keys = Object.keys(this.data);
    const totalKeys = keys.length;
    let totalValueSize = 0;
    let largestValueSize = 0;
    let largestKey = '';
    for (const key of keys) {
      let valueSize = 0;
      try {
        valueSize = Buffer.byteLength(JSON.stringify(this.data[key]), 'utf8');
      } catch {
        valueSize = 0;
      }
      totalValueSize += valueSize;
      if (valueSize > largestValueSize) largestValueSize = valueSize;
      if (key.length > largestKey.length) largestKey = key;
    }
    const averageValueSize = totalKeys > 0 ? Math.round(totalValueSize / totalKeys) : 0;
    return {
      totalKeys,
      fileSize: stats.size,
      lastModified: new Date(stats.mtime),
      memoryUsage: process.memoryUsage().heapUsed,
      averageValueSize,
      largestKey,
      largestValueSize
    };
  }

  async import(data, ttlMeta = {}) {
    let importData = data;
    if (typeof data === 'string') {
      try {
        importData = JSON.parse(data);
      } catch (e) {
        // Şifreli JSON olabilir
        try {
          const parsed = JSON.parse(data);
          if (parsed._encrypted && parsed.data) {
            const decrypted = encryption.decrypt(parsed.data, this.password, parsed.type || this.encryptionType);
            importData = JSON.parse(decrypted);
          } else {
            throw new Error('Invalid import string');
          }
        } catch (err) {
          throw new Error('Import failed: ' + err.message);
        }
      }
    }
    if (typeof importData !== 'object' || Array.isArray(importData)) {
      throw new TypeError('Import data must be an object or JSON string');
    }
    this.data = { ...(importData.data || importData) };
    this.ttlMeta = { ...(importData.ttlMeta || ttlMeta) };
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async export(asString = false) {
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    if (asString) return JSON.stringify(outObj, null, 2);
    return { ...this.data };
  }

  async backup() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${ts}.json`);
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(backupPath, out, 'utf8');
    return backupPath;
  }

  startAutoBackup(intervalMs) {
    if (this._backupInterval) clearInterval(this._backupInterval);
    this._backupInterval = setInterval(() => {
      try {
        this.backupSync();
      } catch (e) {
        // Ignore backup errors
      }
    }, intervalMs);
  }

  stopAutoBackup() {
    if (this._backupInterval) clearInterval(this._backupInterval);
    this._backupInterval = null;
  }

  // Security Methods (V3.0.0)
  
  /**
   * Create JWT token for authentication
   * @param {Object} payload - Token payload
   * @param {Object} options - Token options
   * @returns {string} JWT token
   */
  createToken(payload, options = {}) {
    if (!this.jwtAuth) throw new Error('JWT authentication not enabled');
    return this.jwtAuth.createToken(payload, options);
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Verification result
   */
  verifyToken(token) {
    if (!this.jwtAuth) throw new Error('JWT authentication not enabled');
    return this.jwtAuth.verifyToken(token);
  }

  /**
   * Log operation for audit trail
   * @param {string} operation - Operation type
   * @param {string} key - Key involved
   * @param {string} user - User performing operation
   * @param {Object} metadata - Additional metadata
   */
  auditLog(operation, key, user, metadata = {}) {
    if (this.auditLogger) {
      this.auditLogger.log(operation, key, user, metadata);
    }
  }

  /**
   * Get audit logs
   * @param {Object} options - Filter options
   * @returns {Array} Audit log entries
   */
  getAuditLogs(options = {}) {
    if (!this.auditLogger) throw new Error('Audit logging not enabled');
    return this.auditLogger.getLogs(options);
  }

  /**
   * Verify data integrity
   * @param {string} key - Key to verify
   * @returns {boolean} Integrity check result
   */
  verifyIntegrity(key) {
    if (!this.dataIntegrity) return true;
    const value = this.data[key];
    if (!value) return false;
    return this.dataIntegrity.verify(JSON.stringify(value), this._getStoredHash(key));
  }

  /**
   * Generate RSA key pair
   * @returns {Object} Key pair object
   */
  generateRSAKeys() {
    if (!this.rsaEncryption) throw new Error('RSA encryption not enabled');
    return this.rsaEncryption.generateKeyPair();
  }

  /**
   * Encrypt data with RSA
   * @param {string} data - Data to encrypt
   * @param {string} publicKey - RSA public key
   * @returns {string} Encrypted data
   */
  rsaEncrypt(data, publicKey) {
    if (!this.rsaEncryption) throw new Error('RSA encryption not enabled');
    return this.rsaEncryption.encrypt(data, publicKey);
  }

  /**
   * Decrypt data with RSA
   * @param {string} encryptedData - Encrypted data
   * @param {string} privateKey - RSA private key
   * @returns {string} Decrypted data
   */
  rsaDecrypt(encryptedData, privateKey) {
    if (!this.rsaEncryption) throw new Error('RSA encryption not enabled');
    return this.rsaEncryption.decrypt(encryptedData, privateKey);
  }

  // Private helper methods for integrity
  _getStoredHash(key) {
    // In a real implementation, this would retrieve stored hash from metadata
    // For now, return null to indicate no stored hash
    return null;
  }

  _storeHash(key, hash) {
    // In a real implementation, this would store hash in metadata
    // For now, this is a placeholder
  }

  /**
   * Professional shutdown method for resource cleanup
   * Ensures all resources are properly released
   */
  async shutdown() {
    try {
      // Flush any pending writes
      if (this.writeTimer) {
        clearTimeout(this.writeTimer);
        this.writeTimer = null;
        this._saveSync();
      }

      // Stop all intervals
      this.stopScheduledCleanup();
      this.stopAutoBackup();

      // Shutdown connection pool
      if (this.connectionPool) {
        await this.connectionPool.shutdown();
      }

      // Shutdown performance optimizer
      if (this.optimizer) {
        await this.optimizer.shutdown();
      }

      // Clear all caches
      if (this.optimizer) {
        this.optimizer.clearCaches();
      }

      // Remove from global instances
      globalInstances.delete(this);

      // Audit final shutdown
      if (this.auditLogger) {
        await this.auditLogger.log('database_shutdown', 'system', 'shutdown', {
          timestamp: new Date().toISOString(),
          totalKeys: Object.keys(this.data).length
        });
      }

      return true;
    } catch (error) {
      console.error('Error during shutdown:', error);
      return false;
    }
  }

  // Alias for shutdown (for cleanup compatibility)
  async cleanup() {
    return this.shutdown();
  }
}

module.exports = AlphaBase;
