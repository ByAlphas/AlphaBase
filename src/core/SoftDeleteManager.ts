/**
 * Soft delete metadata
 */
export interface SoftDeleteMetadata {
  _deleted: boolean;
  _deletedAt?: Date;
  _deletedBy?: string;
}

/**
 * Soft delete options
 */
export interface SoftDeleteOptions {
  deletedBy?: string;
  permanentDelete?: boolean;
}

/**
 * Restore options
 */
export interface RestoreOptions {
  restoredBy?: string;
}

/**
 * Query options for soft-deleted items
 */
export interface QueryOptions {
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

/**
 * Soft Delete Manager for AlphaBase
 * Provides soft delete functionality with restore capability
 * Items are marked as deleted but not physically removed
 */
export class SoftDeleteManager {
  private dataRef: Record<string, unknown>;
  private onPhysicalDelete?: (key: string) => void;

  constructor(dataRef: Record<string, unknown>, onPhysicalDelete?: (key: string) => void) {
    this.dataRef = dataRef;
    this.onPhysicalDelete = onPhysicalDelete;
  }

  /**
   * Soft delete a key
   */
  public softDelete(key: string, options: SoftDeleteOptions = {}): boolean {
    const value = this.dataRef[key];

    if (value === undefined) {
      return false;
    }

    // If it's already an object, add metadata
    if (typeof value === 'object' && value !== null) {
      (value as any)._deleted = true;
      (value as any)._deletedAt = new Date();
      
      if (options.deletedBy) {
        (value as any)._deletedBy = options.deletedBy;
      }
    } else {
      // Wrap primitive in object
      this.dataRef[key] = {
        _value: value,
        _deleted: true,
        _deletedAt: new Date(),
        _deletedBy: options.deletedBy,
      };
    }

    return true;
  }

  /**
   * Restore a soft-deleted key
   */
  public restore(key: string, options: RestoreOptions = {}): boolean {
    const value = this.dataRef[key];

    if (value === undefined) {
      return false;
    }

    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const obj = value as any;

    if (!obj._deleted) {
      return false; // Not deleted
    }

    // Remove soft delete metadata
    delete obj._deleted;
    delete obj._deletedAt;
    delete obj._deletedBy;

    // If it was a wrapped primitive, unwrap it
    if (obj._value !== undefined && Object.keys(obj).length === 1) {
      this.dataRef[key] = obj._value;
    }

    // Add restore metadata
    if (options.restoredBy) {
      obj._restoredAt = new Date();
      obj._restoredBy = options.restoredBy;
    }

    return true;
  }

  /**
   * Permanently delete a key
   */
  public permanentDelete(key: string): boolean {
    if (this.dataRef[key] === undefined) {
      return false;
    }

    delete this.dataRef[key];

    if (this.onPhysicalDelete) {
      this.onPhysicalDelete(key);
    }

    return true;
  }

  /**
   * Check if a key is soft-deleted
   */
  public isDeleted(key: string): boolean {
    const value = this.dataRef[key];

    if (value === undefined) {
      return false;
    }

    if (typeof value !== 'object' || value === null) {
      return false;
    }

    return (value as any)._deleted === true;
  }

  /**
   * Get all soft-deleted keys
   */
  public listDeleted(): string[] {
    const deletedKeys: string[] = [];

    for (const [key, value] of Object.entries(this.dataRef)) {
      if (typeof value === 'object' && value !== null && (value as any)._deleted === true) {
        deletedKeys.push(key);
      }
    }

    return deletedKeys;
  }

  /**
   * Get soft delete metadata
   */
  public getDeleteInfo(key: string): SoftDeleteMetadata | null {
    const value = this.dataRef[key];

    if (value === undefined || typeof value !== 'object' || value === null) {
      return null;
    }

    const obj = value as any;

    if (!obj._deleted) {
      return null;
    }

    return {
      _deleted: obj._deleted,
      _deletedAt: obj._deletedAt,
      _deletedBy: obj._deletedBy,
    };
  }

  /**
   * Permanently delete all soft-deleted keys
   */
  public purgeDeleted(): number {
    const deletedKeys = this.listDeleted();
    
    for (const key of deletedKeys) {
      this.permanentDelete(key);
    }

    return deletedKeys.length;
  }

  /**
   * Get value, respecting soft delete status
   */
  public getValue(key: string, options: QueryOptions = {}): unknown | undefined {
    const value = this.dataRef[key];

    if (value === undefined) {
      return undefined;
    }

    const isDeleted = this.isDeleted(key);

    // Return based on options
    if (options.onlyDeleted && !isDeleted) {
      return undefined;
    }

    if (!options.includeDeleted && isDeleted) {
      return undefined;
    }

    return value;
  }

  /**
   * Get all keys respecting soft delete
   */
  public getKeys(options: QueryOptions = {}): string[] {
    const keys: string[] = [];

    for (const key of Object.keys(this.dataRef)) {
      const isDeleted = this.isDeleted(key);

      if (options.onlyDeleted && !isDeleted) {
        continue;
      }

      if (!options.includeDeleted && isDeleted) {
        continue;
      }

      keys.push(key);
    }

    return keys;
  }

  /**
   * Count soft-deleted items
   */
  public countDeleted(): number {
    return this.listDeleted().length;
  }

  /**
   * Count active (non-deleted) items
   */
  public countActive(): number {
    let count = 0;

    for (const value of Object.values(this.dataRef)) {
      if (typeof value === 'object' && value !== null && (value as any)._deleted === true) {
        continue;
      }
      count++;
    }

    return count;
  }

  /**
   * Clean up old soft-deleted items
   */
  public purgeOldDeleted(maxAgeMs: number): number {
    const now = Date.now();
    let purged = 0;

    for (const [key, value] of Object.entries(this.dataRef)) {
      if (typeof value === 'object' && value !== null) {
        const obj = value as any;
        
        if (obj._deleted && obj._deletedAt) {
          const age = now - new Date(obj._deletedAt).getTime();
          
          if (age > maxAgeMs) {
            this.permanentDelete(key);
            purged++;
          }
        }
      }
    }

    return purged;
  }

  /**
   * Batch soft delete
   */
  public batchSoftDelete(keys: string[], options: SoftDeleteOptions = {}): number {
    let deleted = 0;

    for (const key of keys) {
      if (this.softDelete(key, options)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Batch restore
   */
  public batchRestore(keys: string[], options: RestoreOptions = {}): number {
    let restored = 0;

    for (const key of keys) {
      if (this.restore(key, options)) {
        restored++;
      }
    }

    return restored;
  }

  /**
   * Clear all soft delete manager data
   */
  public clear(): void {
    // This manager doesn't maintain separate state
    // All state is in dataRef
  }
}
