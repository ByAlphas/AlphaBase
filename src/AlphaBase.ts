import { Database, DatabaseOptions } from './core/Database';
import { TransactionManager } from './core/TransactionManager';
import { TTLManager } from './core/TTLManager';
import { BackupManager, BackupOptions } from './core/BackupManager';
import { EventManager, EventType, EventHandler, EventData } from './core/EventManager';
import { CacheManager, CacheOptions } from './core/CacheManager';
import { IndexManager, IndexConfig } from './core/IndexManager';
import { SoftDeleteManager, SoftDeleteOptions, RestoreOptions } from './core/SoftDeleteManager';
import { SchemaValidator } from './validation/SchemaValidator';
import { InputSanitizer } from './validation/InputSanitizer';
import { QueryBuilder } from './query/QueryBuilder';
import { QueryEngine } from './query/QueryEngine';
import { StreamingAPI, StreamingOptions } from './streaming/StreamingAPI';
import { DatabaseMetrics } from './monitoring/MetricsCollector';
import { DatabaseHealthCheck } from './monitoring/HealthCheck';
import { ValidationError, KeyNotFoundError } from './errors';

/**
 * AlphaBase configuration options
 */
export interface AlphaBaseOptions extends DatabaseOptions {
  schema?: object;
  enableMetrics?: boolean;
  enableHealthChecks?: boolean;
  enableEvents?: boolean;
  cache?: CacheOptions | boolean;
  enableSoftDelete?: boolean;
}

/**
 * AlphaBase v4.0.0
 * A lightweight, feature-rich JSON database with TypeScript support
 */
export class AlphaBase {
  private readonly db: Database;
  private readonly transactionManager: TransactionManager;
  private readonly ttl: TTLManager;
  private readonly backup: BackupManager;
  private readonly validator: SchemaValidator;
  private readonly queryEngine: QueryEngine;
  private readonly streaming: StreamingAPI;
  private readonly metrics: DatabaseMetrics | null;
  private readonly health: DatabaseHealthCheck | null;
  private readonly events: EventManager | null;
  private readonly cache: CacheManager | null;
  private readonly indexes: IndexManager;
  private readonly softDeleteManager: SoftDeleteManager | null;

  constructor(options: AlphaBaseOptions = {}) {
    // Initialize database
    this.db = new Database(options);
    
    // Get reference to internal data for managers
    const dataRef = (this.db as any).data as Record<string, unknown>;

    // Initialize managers
    this.transactionManager = new TransactionManager(dataRef);
    this.ttl = new TTLManager(dataRef);
    this.backup = new BackupManager(dataRef, (this.db as any).backupDir);
    this.validator = new SchemaValidator();
    this.queryEngine = new QueryEngine(dataRef);
    this.streaming = new StreamingAPI(dataRef);
    this.indexes = new IndexManager(dataRef);

    // Initialize monitoring (optional)
    this.metrics = options.enableMetrics !== false ? new DatabaseMetrics() : null;
    this.health = options.enableHealthChecks !== false 
      ? new DatabaseHealthCheck(dataRef) 
      : null;

    // Initialize events (optional)
    this.events = options.enableEvents !== false ? new EventManager() : null;

    // Initialize cache (optional)
    if (options.cache === false) {
      this.cache = null;
    } else if (typeof options.cache === 'object') {
      this.cache = new CacheManager(options.cache);
    } else {
      // Default cache enabled with 1000 items
      this.cache = new CacheManager({ maxSize: 1000 });
    }

    // Initialize soft delete (optional)
    this.softDeleteManager = options.enableSoftDelete !== false 
      ? new SoftDeleteManager(dataRef, (key) => this.indexes.onDelete(key)) 
      : null;

    // Register schema if provided
    if (options.schema) {
      this.validator.registerSchema('default', options.schema);
    }
  }

  // ===== Async Initialization =====

  /**
   * Initialize database asynchronously (recommended)
   * This method should be called after construction for non-blocking initialization
   */
  public async initialize(): Promise<void> {
    return this.db.initialize();
  }

  /**
   * Save database to file asynchronously (recommended)
   */
  public async save(): Promise<void> {
    return this.db.save();
  }

  /**
   * Load database from file asynchronously (recommended)
   */
  public async load(): Promise<void> {
    return this.db.load();
  }

  // ===== Core Database Operations =====

  /**
   * Get value by key
   */
  public get<T = unknown>(key: string): T {
    this.metrics?.recordRead();
    const start = Date.now();

    try {
      // Emit before:get event
      this.events?.emit('before:get', { key, value: undefined });

      // Check cache first
      if (this.cache) {
        const cached = this.cache.get(key);
        if (cached !== undefined) {
          this.events?.emit('after:get', { key, value: cached });
          return cached as T;
        }
      }

      // Check soft delete
      let value: T;
      if (this.softDeleteManager) {
        // Check if key exists (not deleted)
        if (!this.db.has(key)) {
          // Key doesn't exist at all - will throw KeyNotFoundError
          value = this.db.get(key) as T;
        } else if (this.softDeleteManager.isDeleted(key)) {
          // Key exists but is soft-deleted - treat as not found
          throw new KeyNotFoundError(key);
        } else {
          // Key exists and not deleted
          value = this.db.get(key) as T;
        }
      } else {
        value = this.db.get(key) as T;
      }

      // Store in cache
      if (this.cache && value !== undefined) {
        this.cache.set(key, value);
      }

      // Emit after:get event
      this.events?.emit('after:get', { key, value });

      this.metrics?.observeHistogram('alphabase_operation_duration_seconds', (Date.now() - start) / 1000);
      return value;
    } catch (error) {
      this.metrics?.recordError();
      this.events?.emit('error', { error: error as Error, operation: 'get', key });
      throw error;
    }
  }

  /**
   * Set multiple key-value pairs at once (bulk insert)
   * Optimized for performance with large datasets
   */
  public bulkSet(entries: Record<string, unknown>, options?: { ttl?: number }): void {
    this.metrics?.recordWrite();
    const start = Date.now();

    try {
      // Start transaction for atomicity
      this.transactionManager.begin();
      
      // Bulk insert
      for (const [key, value] of Object.entries(entries)) {
        // Emit before:set event
        this.events?.emit('before:set', { key, value, ttl: options?.ttl });

        // Validate against schema if registered
        if (this.validator.listSchemas().includes('default')) {
          this.validator.validate('default', value);
        }

        this.db.set(key, value);

        // Update cache
        if (this.cache) {
          this.cache.set(key, value, options?.ttl);
        }

        // Update indexes
        this.indexes.onSet(key, value);

        if (options?.ttl) {
          this.ttl.set(key, options.ttl);
        }

        // Emit after:set event
        this.events?.emit('after:set', { key, value, ttl: options?.ttl });
      }
      
      this.transactionManager.commit();
      this.metrics?.observeHistogram('alphabase_operation_duration_seconds', (Date.now() - start) / 1000);
    } catch (error) {
      this.transactionManager.rollback();
      this.metrics?.recordError();
      throw error;
    }
  }

  /**
   * Set value for key
   */
  public set(key: string, value: unknown, options?: { ttl?: number }): void {
    this.metrics?.recordWrite();
    const start = Date.now();

    try {
      // Emit before:set event
      this.events?.emit('before:set', { key, value, ttl: options?.ttl });

      // Validate against schema if registered
      if (this.validator.listSchemas().includes('default')) {
        this.validator.validate('default', value);
      }

      this.db.set(key, value);

      // Update cache
      if (this.cache) {
        this.cache.set(key, value, options?.ttl);
      }

      // Update indexes
      this.indexes.onSet(key, value);

      if (options?.ttl) {
        this.ttl.set(key, options.ttl);
      }

      // Emit after:set event
      this.events?.emit('after:set', { key, value, ttl: options?.ttl });

      this.metrics?.observeHistogram('alphabase_operation_duration_seconds', (Date.now() - start) / 1000);
    } catch (error) {
      this.metrics?.recordError();
      this.events?.emit('error', { error: error as Error, operation: 'set', key });
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  public has(key: string): boolean {
    this.metrics?.recordRead();
    
    if (this.softDeleteManager) {
      return this.softDeleteManager.getValue(key) !== undefined && !this.ttl.isExpired(key);
    }
    
    return this.db.has(key) && !this.ttl.isExpired(key);
  }

  /**
   * Delete key
   */
  public delete(key: string): boolean {
    this.metrics?.recordDelete();
    const start = Date.now();

    try {
      // Emit before:delete event
      this.events?.emit('before:delete', { key, existed: this.db.has(key) });

      this.ttl.remove(key);
      
      // Clear from cache
      if (this.cache) {
        this.cache.delete(key);
      }

      // Update indexes
      this.indexes.onDelete(key);

      const result = this.db.delete(key);

      // Emit after:delete event
      this.events?.emit('after:delete', { key, existed: result });

      this.metrics?.observeHistogram('alphabase_operation_duration_seconds', (Date.now() - start) / 1000);
      return result;
    } catch (error) {
      this.metrics?.recordError();
      this.events?.emit('error', { error: error as Error, operation: 'delete', key });
      throw error;
    }
  }

  /**
   * Get all keys
   */
  public keys(): string[] {
    // Filter out expired keys
    return this.db.keys().filter(key => !this.ttl.isExpired(key));
  }

  /**
   * Get all values
   */
  public values(): unknown[] {
    const keys = this.keys();
    return keys.map(key => this.db.get(key));
  }

  /**
   * Get all entries
   */
  public entries(): Array<[string, unknown]> {
    const keys = this.keys();
    return keys.map(key => [key, this.db.get(key)] as [string, unknown]);
  }

  /**
   * Get all data
   */
  public all(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of this.keys()) {
      result[key] = this.db.get(key);
    }
    return result;
  }

  /**
   * Clear all data
   */
  public clear(): void {
    this.db.clear();
    this.ttl.clear();
    
    // Clear cache and index data (but keep index definitions)
    if (this.cache) {
      this.cache.clear();
    }
    this.indexes.clearData();
    
    // Emit clear event
    this.events?.emit('clear', {});
  }

  /**
   * Get database size
   */
  public size(): number {
    return this.keys().length;
  }

  /**
   * Batch operations
   */
  public batch(operations: Array<{ type: 'set' | 'delete'; key: string; value?: unknown; ttl?: number }>): void {
    const dbOps = operations.map(op => ({
      type: op.type,
      key: op.key,
      value: op.value
    }));

    this.db.batch(dbOps);

    // Apply TTL for set operations
    for (const op of operations) {
      if (op.type === 'set' && op.ttl) {
        this.ttl.set(op.key, op.ttl);
      }
    }
  }

  // ===== Transaction Operations =====

  /**
   * Begin transaction
   */
  public beginTransaction(): void {
    this.transactionManager.begin();
    
    // Emit begin event
    this.events?.emit('transaction:begin', {});
  }

  /**
   * Commit transaction
   */
  public commit(): void {
    this.transactionManager.commit();
    
    // Emit commit event
    this.events?.emit('transaction:commit', {});
  }

  /**
   * Rollback transaction
   */
  public rollback(): void {
    // First clear cache to avoid stale data
    if (this.cache) {
      this.cache.clear();
    }
    
    // Rollback transaction
    this.transactionManager.rollback();
    
    // Rebuild indexes after rollback (data has changed)
    this.indexes.rebuildAll();
    
    // Emit rollback event
    this.events?.emit('transaction:rollback', {});
  }

  /**
   * Execute operations in transaction
   */
  public async executeTransaction<T>(operations: () => Promise<T>): Promise<T> {
    return this.transactionManager.execute(operations);
  }

  // ===== TTL Operations =====

  /**
   * Set TTL for key
   */
  public setTTL(key: string, ttlMs: number): void {
    this.ttl.set(key, ttlMs);
  }

  /**
   * Get remaining TTL
   * Returns -1 if no TTL set, 0 if expired, throws if key doesn't exist
   */
  public getTTL(key: string): number {
    if (!this.has(key)) {
      throw new KeyNotFoundError(key);
    }
    return this.ttl.get(key);
  }

  /**
   * Remove TTL from key
   */
  public removeTTL(key: string): void {
    this.ttl.remove(key);
  }

  /**
   * Cleanup expired keys
   */
  public async cleanup(): Promise<number> {
    return this.ttl.cleanupExpired();
  }

  /**
   * Start scheduled cleanup
   */
  public startScheduledCleanup(intervalMs: number): void {
    this.ttl.startScheduledCleanup(intervalMs);
  }

  /**
   * Stop scheduled cleanup
   */
  public stopScheduledCleanup(): void {
    this.ttl.stopScheduledCleanup();
  }

  // ===== Backup Operations =====

  /**
   * Create backup (synchronous - legacy)
   * @deprecated Use createBackupAsync() for non-blocking operation
   */
  public createBackup(options?: BackupOptions): { filename: string; filePath: string } {
    return this.backup.create(options);
  }

  /**
   * Create backup asynchronously (recommended)
   */
  public async createBackupAsync(options?: BackupOptions): Promise<{ filename: string; filePath: string }> {
    return this.backup.createAsync(options);
  }

  /**
   * Restore from backup (synchronous - legacy)
   * @deprecated Use restoreBackupAsync() for non-blocking operation
   */
  public restore(backupFile: string): void {
    this.backup.restore(backupFile);
    
    // Clear cache and rebuild indexes
    if (this.cache) {
      this.cache.clear();
    }
    this.indexes.rebuildAll();
  }

  /**
   * Restore from backup asynchronously (recommended)
   */
  public async restoreBackupAsync(backupFile: string): Promise<void> {
    await this.backup.restoreAsync(backupFile);
    
    // Clear cache and rebuild indexes
    if (this.cache) {
      this.cache.clear();
    }
    this.indexes.rebuildAll();
  }

  /**
   * List backups (synchronous - legacy)
   * @deprecated Use listBackupsAsync() for non-blocking operation
   */
  public listBackups(): Array<{ filename: string; filePath: string; timestamp: Date }> {
    return this.backup.list();
  }

  /**
   * List backups asynchronously (recommended)
   */
  public async listBackupsAsync(): Promise<Array<{ filename: string; filePath: string; timestamp: Date }>> {
    return this.backup.listAsync();
  }

  /**
   * Start auto backup
   */
  public startAutoBackup(intervalMs: number, options?: BackupOptions): void {
    this.backup.startAutoBackup(intervalMs, options);
  }

  /**
   * Stop auto backup
   */
  public stopAutoBackup(): void {
    this.backup.stopAutoBackup();
  }

  /**
   * Export to file
   */
  public export(filePath: string, options?: BackupOptions): void {
    this.backup.export(filePath, options);
  }

  /**
   * Import from file
   */
  public import(filePath: string, merge: boolean = false): number {
    return this.backup.import(filePath, merge);
  }

  // ===== Query Operations =====

  /**
   * Create query builder
   */
  public query(): QueryBuilder {
    return new QueryBuilder();
  }

  /**
   * Execute query
   */
  public executeQuery(query: QueryBuilder) {
    return this.queryEngine.execute(query);
  }

  /**
   * Find documents
   */
  public find(query: QueryBuilder) {
    return this.queryEngine.execute(query);
  }

  /**
   * Find one document
   */
  public findOne(query: QueryBuilder) {
    return this.queryEngine.findOne(query);
  }

  /**
   * Count documents
   */
  public count(query?: QueryBuilder): number {
    return query ? this.queryEngine.count(query) : this.size();
  }

  // ===== Streaming Operations =====

  /**
   * Create read stream
   */
  public createReadStream(options?: StreamingOptions) {
    return this.streaming.createReadStream(options);
  }

  /**
   * Create key stream
   */
  public createKeyStream(options?: StreamingOptions) {
    return this.streaming.createKeyStream(options);
  }

  /**
   * Create value stream
   */
  public createValueStream(options?: StreamingOptions) {
    return this.streaming.createValueStream(options);
  }

  // ===== Validation Operations =====

  /**
   * Register schema
   */
  public registerSchema(name: string, schema: object): void {
    this.validator.registerSchema(name, schema);
  }

  /**
   * Validate data
   */
  public validate(schemaName: string, data: unknown): void {
    this.validator.validate(schemaName, data);
  }

  /**
   * Sanitize input
   */
  public sanitize(input: unknown): unknown {
    return InputSanitizer.sanitizeObject(input);
  }

  // ===== Metrics & Health =====

  /**
   * Get metrics
   */
  public getMetrics(): ReturnType<DatabaseMetrics['getAllMetrics']> | null {
    if (!this.metrics) {
      throw new ValidationError('Metrics are not enabled', {});
    }
    return this.metrics.getAllMetrics();
  }

  /**
   * Export metrics in Prometheus format
   */
  public exportMetrics(): string {
    if (!this.metrics) {
      throw new ValidationError('Metrics are not enabled', {});
    }
    return this.metrics.exportPrometheus();
  }

  /**
   * Get health check
   */
  public async healthCheck() {
    if (!this.health) {
      throw new ValidationError('Health checks are not enabled', {});
    }
    return this.health.check();
  }

  /**
   * Get database stats
   */
  public stats() {
    const dbStats = this.db.stats();
    const ttlStats = this.ttl.stats();

    // Update metrics if enabled
    if (this.metrics) {
      this.metrics.updateStats({
        keys: dbStats.keys,
        size: dbStats.size,
        ttlKeys: ttlStats.total
      });
    }

    return {
      ...dbStats,
      ttl: ttlStats
    };
  }

  // ===== Cleanup =====

  /**
   * Cleanup all resources
   */
  public async close(): Promise<void> {
    await Promise.all([
      this.db.cleanup(),
      this.ttl.cleanup(),
      this.backup.cleanup()
    ]);

    // Cleanup new managers
    if (this.cache) {
      this.cache.destroy();
    }
    if (this.events) {
      this.events.clear();
    }
  }

  // ===== Event System =====

  /**
   * Subscribe to an event
   */
  public on<T = EventData>(event: EventType, handler: EventHandler<T>): void {
    if (!this.events) {
      throw new ValidationError('Events are not enabled', {});
    }
    this.events.on(event, handler);
  }

  /**
   * Subscribe to an event (once)
   */
  public once<T = EventData>(event: EventType, handler: EventHandler<T>): void {
    if (!this.events) {
      throw new ValidationError('Events are not enabled', {});
    }
    this.events.once(event, handler);
  }

  /**
   * Unsubscribe from an event
   */
  public off<T = EventData>(event: EventType, handler: EventHandler<T>): void {
    if (!this.events) {
      throw new ValidationError('Events are not enabled', {});
    }
    this.events.off(event, handler);
  }

  // ===== Cache =====

  /**
   * Clear cache
   */
  public clearCache(): void {
    if (!this.cache) {
      throw new ValidationError('Cache is not enabled', {});
    }
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public cacheStats() {
    if (!this.cache) {
      throw new ValidationError('Cache is not enabled', {});
    }
    return this.cache.stats();
  }

  // ===== Indexing =====

  /**
   * Create an index on a field
   */
  public createIndex(name: string, config: IndexConfig): void {
    this.indexes.createIndex(name, config);
  }

  /**
   * Drop an index
   */
  public dropIndex(name: string): boolean {
    return this.indexes.dropIndex(name);
  }

  /**
   * Lookup by index
   */
  public lookupIndex(indexName: string, value: unknown) {
    return this.indexes.lookup(indexName, value);
  }

  /**
   * Range query by index
   */
  public rangeIndex(indexName: string, min?: number | Date, max?: number | Date) {
    return this.indexes.range(indexName, min, max);
  }

  /**
   * List all indexes
   */
  public listIndexes(): string[] {
    return this.indexes.listIndexes();
  }

  /**
   * Get index statistics
   */
  public indexStats(name: string) {
    return this.indexes.getIndexStats(name);
  }

  // ===== Soft Delete =====

  /**
   * Soft delete a key
   */
  public softDelete(key: string, options?: SoftDeleteOptions): boolean {
    if (!this.softDeleteManager) {
      throw new ValidationError('Soft delete is not enabled', {});
    }
    return this.softDeleteManager.softDelete(key, options);
  }

  /**
   * Restore a soft-deleted key
   */
  public restoreSoftDelete(key: string, options?: RestoreOptions): boolean {
    if (!this.softDeleteManager) {
      throw new ValidationError('Soft delete is not enabled', {});
    }
    return this.softDeleteManager.restore(key, options);
  }

  /**
   * Check if key is soft-deleted
   */
  public isDeleted(key: string): boolean {
    if (!this.softDeleteManager) {
      return false;
    }
    return this.softDeleteManager.isDeleted(key);
  }

  /**
   * List all soft-deleted keys
   */
  public listDeleted(): string[] {
    if (!this.softDeleteManager) {
      throw new ValidationError('Soft delete is not enabled', {});
    }
    return this.softDeleteManager.listDeleted();
  }

  /**
   * Permanently delete all soft-deleted keys
   */
  public purgeDeleted(): number {
    if (!this.softDeleteManager) {
      throw new ValidationError('Soft delete is not enabled', {});
    }
    return this.softDeleteManager.purgeDeleted();
  }
}

