/**
 * Index configuration
 */
export interface IndexConfig {
  field: string;
  unique?: boolean;
  sparse?: boolean; // Don't index null/undefined values
}

/**
 * Index statistics
 */
export interface IndexStats {
  name: string;
  field: string;
  size: number;
  unique: boolean;
  sparse: boolean;
}

/**
 * Index lookup result
 */
export interface IndexLookupResult {
  keys: string[];
  count: number;
}

/**
 * Index Manager for AlphaBase
 * Provides O(1) field-based lookups using Map-based indexing
 * Zero external dependencies
 */
export class IndexManager {
  private indexes: Map<string, Map<unknown, Set<string>>>;
  private indexConfigs: Map<string, IndexConfig>;
  private dataRef: Record<string, unknown>;

  constructor(dataRef: Record<string, unknown>) {
    this.indexes = new Map();
    this.indexConfigs = new Map();
    this.dataRef = dataRef;
  }

  /**
   * Create an index on a field
   */
  public createIndex(name: string, config: IndexConfig): void {
    if (this.indexes.has(name)) {
      throw new Error(`Index '${name}' already exists`);
    }

    this.indexConfigs.set(name, config);
    const index = new Map<unknown, Set<string>>();

    // Build index from existing data
    for (const [key, value] of Object.entries(this.dataRef)) {
      this.addToIndex(name, key, value, index, config);
    }

    this.indexes.set(name, index);
  }

  /**
   * Drop an index
   */
  public dropIndex(name: string): boolean {
    if (!this.indexes.has(name)) {
      return false;
    }

    this.indexes.delete(name);
    this.indexConfigs.delete(name);
    return true;
  }

  /**
   * Check if index exists
   */
  public hasIndex(name: string): boolean {
    return this.indexes.has(name);
  }

  /**
   * Get all index names
   */
  public listIndexes(): string[] {
    return Array.from(this.indexes.keys());
  }

  /**
   * Get index statistics
   */
  public getIndexStats(name: string): IndexStats | null {
    const index = this.indexes.get(name);
    const config = this.indexConfigs.get(name);

    if (!index || !config) {
      return null;
    }

    return {
      name,
      field: config.field,
      size: index.size,
      unique: config.unique || false,
      sparse: config.sparse || false,
    };
  }

  /**
   * Lookup keys by indexed field value (O(1))
   */
  public lookup(indexName: string, value: unknown): IndexLookupResult {
    const index = this.indexes.get(indexName);

    if (!index) {
      throw new Error(`Index '${indexName}' does not exist`);
    }

    const keySet = index.get(value);

    if (!keySet) {
      return { keys: [], count: 0 };
    }

    const keys = Array.from(keySet);
    return { keys, count: keys.length };
  }

  /**
   * Range lookup for numeric/date fields
   */
  public range(
    indexName: string, 
    min?: number | Date, 
    max?: number | Date
  ): IndexLookupResult {
    const index = this.indexes.get(indexName);

    if (!index) {
      throw new Error(`Index '${indexName}' does not exist`);
    }

    const allKeys = new Set<string>();
    const minVal = min instanceof Date ? min.getTime() : min;
    const maxVal = max instanceof Date ? max.getTime() : max;

    for (const [value, keySet] of index.entries()) {
      const numValue = value instanceof Date ? value.getTime() : Number(value);

      if (isNaN(numValue)) {
        continue;
      }

      const inRange = 
        (minVal === undefined || numValue >= minVal) &&
        (maxVal === undefined || numValue <= maxVal);

      if (inRange) {
        for (const key of keySet) {
          allKeys.add(key);
        }
      }
    }

    const keys = Array.from(allKeys);
    return { keys, count: keys.length };
  }

  /**
   * Update index when data is set
   */
  public onSet(key: string, value: unknown): void {
    // Remove from all indexes first
    this.onDelete(key);

    // Add to all indexes
    for (const [indexName, index] of this.indexes.entries()) {
      const config = this.indexConfigs.get(indexName)!;
      this.addToIndex(indexName, key, value, index, config);
    }
  }

  /**
   * Update index when data is deleted
   */
  public onDelete(key: string): void {
    // Track which indexes contain this key for efficient deletion
    for (const index of this.indexes.values()) {
      // Only iterate value sets that might contain the key
      for (const keySet of index.values()) {
        if (keySet.has(key)) {
          keySet.delete(key);
          // Continue to next index since key can only be in one value set per index
          break;
        }
      }
    }
  }

  /**
   * Rebuild an index from scratch
   */
  public rebuildIndex(name: string): void {
    const config = this.indexConfigs.get(name);

    if (!config) {
      throw new Error(`Index '${name}' does not exist`);
    }

    const index = new Map<unknown, Set<string>>();

    for (const [key, value] of Object.entries(this.dataRef)) {
      this.addToIndex(name, key, value, index, config);
    }

    this.indexes.set(name, index);
  }

  /**
   * Rebuild all indexes
   */
  public rebuildAll(): void {
    for (const name of this.indexes.keys()) {
      this.rebuildIndex(name);
    }
  }

  /**
   * Clear all indexes
   */
  public clear(): void {
    this.indexes.clear();
    this.indexConfigs.clear();
  }

  /**
   * Clear index data but keep index definitions
   * Useful when clearing database but want to keep indexes
   */
  public clearData(): void {
    for (const index of this.indexes.values()) {
      index.clear();
    }
  }

  /**
   * Add entry to index
   */
  private addToIndex(
    indexName: string,
    key: string,
    value: unknown,
    index: Map<unknown, Set<string>>,
    config: IndexConfig
  ): void {
    const fieldValue = this.getFieldValue(value, config.field);

    // Skip null/undefined if sparse
    if (config.sparse && (fieldValue === null || fieldValue === undefined)) {
      return;
    }

    // Handle unique constraint
    if (config.unique && index.has(fieldValue)) {
      const existingKeys = index.get(fieldValue)!;
      if (existingKeys.size > 0 && !existingKeys.has(key)) {
        throw new Error(
          `Unique constraint violation on index '${indexName}': value '${fieldValue}' already exists`
        );
      }
    }

    let keySet = index.get(fieldValue);

    if (!keySet) {
      keySet = new Set();
      index.set(fieldValue, keySet);
    }

    keySet.add(key);
  }

  /**
   * Get field value from object (supports nested fields)
   */
  private getFieldValue(obj: unknown, field: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }

    const parts = field.split('.');
    let current: any = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Get all indexed values for a field
   */
  public getIndexedValues(indexName: string): unknown[] {
    const index = this.indexes.get(indexName);

    if (!index) {
      throw new Error(`Index '${indexName}' does not exist`);
    }

    return Array.from(index.keys());
  }

  /**
   * Get memory usage estimate
   */
  public getMemoryUsage(): { indexes: number; totalEntries: number } {
    let totalEntries = 0;

    for (const index of this.indexes.values()) {
      for (const keySet of index.values()) {
        totalEntries += keySet.size;
      }
    }

    return {
      indexes: this.indexes.size,
      totalEntries,
    };
  }
}
