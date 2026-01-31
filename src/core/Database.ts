import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { ValidationError, FileOperationError, KeyNotFoundError } from '../errors';

/**
 * Configuration options for Database
 */
export interface DatabaseOptions {
  filePath?: string;
  backupDir?: string;
  autoBackupInterval?: number;
  enableAutoBackup?: boolean;
  performanceMode?: boolean;
  batchWrite?: boolean;
  deferredWriteTimeout?: number;
}

/**
 * Core database class handling file I/O and data operations
 */
export class Database {
  private readonly filePath: string;
  private readonly backupDir: string;
  private data: Record<string, unknown>;
  private backupInterval: NodeJS.Timeout | null;
  private writeQueue: Array<() => void>;
  private writeTimer: NodeJS.Timeout | null;
  private readonly batchWriteEnabled: boolean;
  private readonly deferredWriteTimeout: number;
  private initPromise: Promise<void> | null;

  constructor(options: DatabaseOptions = {}) {
    this.filePath = options.filePath || path.resolve(process.cwd(), 'alphabase.json');
    this.backupDir = options.backupDir || path.resolve(path.dirname(this.filePath), 'backups');
    this.data = {};
    this.backupInterval = null;
    this.writeQueue = [];
    this.writeTimer = null;
    this.batchWriteEnabled = options.batchWrite !== false;
    this.deferredWriteTimeout = options.deferredWriteTimeout || 1000;
    this.initPromise = null;

    // Synchronous initialization for backward compatibility
    this.ensureFile();
    this.loadSync();

    if (options.autoBackupInterval && options.enableAutoBackup !== false) {
      this.startAutoBackup(options.autoBackupInterval);
    }
  }

  /**
   * Async initialization (recommended for new code)
   * Call this method after construction for non-blocking initialization
   */
  public async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await this.ensureFileAsync();
      await this.load();
    })();

    return this.initPromise;
  }

  /**
   * Ensure database file and backup directory exist (synchronous - legacy)
   * @deprecated Use ensureFileAsync() instead
   */
  private ensureFile(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, '{}', 'utf8');
      }
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to initialize database: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure database file and backup directory exist (async - recommended)
   */
  private async ensureFileAsync(): Promise<void> {
    try {
      try {
        await fsPromises.access(this.filePath);
      } catch {
        await fsPromises.writeFile(this.filePath, '{}', 'utf8');
      }

      try {
        await fsPromises.access(this.backupDir);
      } catch {
        await fsPromises.mkdir(this.backupDir, { recursive: true });
      }
    } catch (error) {
      throw new FileOperationError('ensure_file', this.filePath, error as Error);
    }
  }

  /**
   * Load database from file synchronously (legacy)
   * @deprecated Use load() instead
   */
  private loadSync(): void {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const loadedData = parsed.data || parsed;
      
      // Clear existing data while preserving reference
      for (const key of Object.keys(this.data)) {
        delete this.data[key];
      }
      
      // Copy loaded data
      Object.assign(this.data, loadedData);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Clear data while preserving reference
        for (const key of Object.keys(this.data)) {
          delete this.data[key];
        }
      } else {
        throw new FileOperationError('load', this.filePath, error as Error);
      }
    }
  }

  /**
   * Load database from file asynchronously (recommended)
   */
  public async load(): Promise<void> {
    try {
      const raw = await fsPromises.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const loadedData = parsed.data || parsed;
      
      // Clear existing data while preserving reference
      for (const key of Object.keys(this.data)) {
        delete this.data[key];
      }
      
      // Copy loaded data
      Object.assign(this.data, loadedData);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Clear data while preserving reference
        for (const key of Object.keys(this.data)) {
          delete this.data[key];
        }
      } else {
        throw new FileOperationError('load', this.filePath, error as Error);
      }
    }
  }

  /**
   * Save database to file synchronously (legacy)
   * @deprecated Use save() instead
   */
  private saveSync(): void {
    try {
      const content = JSON.stringify({ data: this.data }, null, 2);
      fs.writeFileSync(this.filePath, content, 'utf8');
    } catch (error) {
      throw new FileOperationError('save', this.filePath, error as Error);
    }
  }

  /**
   * Save database to file asynchronously (recommended)
   */
  public async save(): Promise<void> {
    try {
      const content = JSON.stringify({ data: this.data }, null, 2);
      await fsPromises.writeFile(this.filePath, content, 'utf8');
    } catch (error) {
      throw new FileOperationError('save', this.filePath, error as Error);
    }
  }

  /**
   * Deferred write with batching for performance
   */
  private deferredWrite(): void {
    if (!this.batchWriteEnabled) {
      this.saveSync();
      return;
    }

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }

    this.writeTimer = setTimeout(() => {
      this.saveSync();
      this.writeTimer = null;
    }, this.deferredWriteTimeout);
  }

  /**
   * Deferred write with batching for performance (async)
   * Can be used by external callers for async write operations
   */
  public async deferredWriteAsync(): Promise<void> {
    if (!this.batchWriteEnabled) {
      await this.save();
      return;
    }

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }

    return new Promise<void>((resolve) => {
      this.writeTimer = setTimeout(async () => {
        await this.save();
        this.writeTimer = null;
        resolve();
      }, this.deferredWriteTimeout);
    });
  }

  /**
   * Get value by key
   */
  public get(key: string): unknown {
    if (typeof key !== 'string') {
      throw new ValidationError('Key must be a string', { key });
    }

    if (!this.has(key)) {
      throw new KeyNotFoundError(key);
    }

    return this.data[key];
  }

  /**
   * Set value for key
   */
  public set(key: string, value: unknown): void {
    if (typeof key !== 'string') {
      throw new ValidationError('Key must be a string', { key });
    }

    this.data[key] = value;
    this.deferredWrite();
  }

  /**
   * Check if key exists
   */
  public has(key: string): boolean {
    if (typeof key !== 'string') {
      throw new ValidationError('Key must be a string', { key });
    }

    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  /**
   * Delete key
   */
  public delete(key: string): boolean {
    if (typeof key !== 'string') {
      throw new ValidationError('Key must be a string', { key });
    }

    if (!this.has(key)) {
      return false;
    }

    delete this.data[key];
    this.deferredWrite();
    return true;
  }

  /**
   * Get all keys
   */
  public keys(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Get all values
   */
  public values(): unknown[] {
    return Object.values(this.data);
  }

  /**
   * Get all entries as [key, value] pairs
   */
  public entries(): Array<[string, unknown]> {
    return Object.entries(this.data);
  }

  /**
   * Get all data
   */
  public all(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Clear all data
   */
  public clear(): void {
    // Clear all keys while keeping the same object reference
    // This is important for managers that hold a reference to this.data
    for (const key of Object.keys(this.data)) {
      delete this.data[key];
    }
    this.saveSync();
  }

  /**
   * Get database size (number of keys)
   */
  public size(): number {
    return Object.keys(this.data).length;
  }

  /**
   * Batch operations for better performance
   */
  public batch(operations: Array<{ type: 'set' | 'delete'; key: string; value?: unknown }>): void {
    for (const op of operations) {
      if (op.type === 'set') {
        if (op.value === undefined) {
          throw new ValidationError('Value is required for set operation', { operation: op });
        }
        this.data[op.key] = op.value;
      } else if (op.type === 'delete') {
        delete this.data[op.key];
      } else {
        throw new ValidationError(`Unknown operation type: ${op.type}`, { operation: op });
      }
    }
    this.saveSync();
  }

  /**
   * Start automatic backup
   */
  public startAutoBackup(intervalMs: number): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(() => {
      this.createBackup();
    }, intervalMs);
  }

  /**
   * Stop automatic backup
   */
  public stopAutoBackup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
  }

  /**
   * Create backup of database
   */
  public createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.json`);

    try {
      const content = JSON.stringify({ data: this.data }, null, 2);
      fs.writeFileSync(backupFile, content, 'utf8');
      return backupFile;
    } catch (error) {
      throw new FileOperationError('backup', backupFile, error as Error);
    }
  }

  /**
   * Restore from backup file
   */
  public restore(backupFile: string): void {
    try {
      const raw = fs.readFileSync(backupFile, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = parsed.data || parsed;
      this.saveSync();
    } catch (error) {
      throw new FileOperationError('restore', backupFile, error as Error);
    }
  }

  /**
   * List all backup files
   */
  public listBackups(): string[] {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      return fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .sort()
        .reverse();
    } catch (error) {
      throw new FileOperationError('list_backups', this.backupDir, error as Error);
    }
  }

  /**
   * Export database to file
   */
  public export(filePath: string): void {
    try {
      const content = JSON.stringify({ data: this.data }, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new FileOperationError('export', filePath, error as Error);
    }
  }

  /**
   * Import database from file
   */
  public import(filePath: string, merge: boolean = false): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const importedData = parsed.data || parsed;

      if (merge) {
        this.data = { ...this.data, ...importedData };
      } else {
        this.data = importedData;
      }

      this.saveSync();
    } catch (error) {
      throw new FileOperationError('import', filePath, error as Error);
    }
  }

  /**
   * Get database statistics
   */
  public stats(): {
    keys: number;
    size: number;
    filePath: string;
    backupDir: string;
    backupCount: number;
  } {
    const content = JSON.stringify({ data: this.data });
    const sizeInBytes = Buffer.byteLength(content, 'utf8');

    return {
      keys: this.size(),
      size: sizeInBytes,
      filePath: this.filePath,
      backupDir: this.backupDir,
      backupCount: this.listBackups().length
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopAutoBackup();

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    // Final save
    if (this.writeQueue.length > 0 || this.writeTimer) {
      this.saveSync();
    }
  }
}
