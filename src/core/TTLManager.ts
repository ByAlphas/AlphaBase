import { TTLError, ValidationError } from '../errors';

/**
 * TTL metadata for keys
 */
interface TTLMetadata {
  [key: string]: number; // key -> expiration timestamp
}

/**
 * TTL (Time To Live) Manager
 * Handles automatic key expiration and cleanup
 */
export class TTLManager {
  private readonly dataRef: Record<string, unknown>;
  private ttlMeta: TTLMetadata;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(dataRef: Record<string, unknown>) {
    this.dataRef = dataRef;
    this.ttlMeta = {};
    this.cleanupInterval = null;
  }

  /**
   * Set TTL for a key (milliseconds)
   */
  public set(key: string, ttlMs: number): void {
    if (typeof key !== 'string') {
      throw new ValidationError('Key must be a string', { key });
    }

    if (typeof ttlMs !== 'number') {
      throw new ValidationError('TTL must be a number', { ttlMs });
    }

    if (!this.dataRef.hasOwnProperty(key)) {
      throw new TTLError(`Key '${key}' does not exist`, { key });
    }

    // Negative TTL removes the expiration
    if (ttlMs < 0) {
      this.remove(key);
      return;
    }

    this.ttlMeta[key] = Date.now() + ttlMs;
  }

  /**
   * Get remaining TTL for a key (milliseconds)
   * Returns -1 if no TTL set, 0 if expired
   */
  public get(key: string): number {
    if (!this.ttlMeta[key]) {
      return -1;
    }

    const remaining = this.ttlMeta[key] - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Remove TTL from a key
   */
  public remove(key: string): void {
    delete this.ttlMeta[key];
  }

  /**
   * Check if key has expired
   */
  public isExpired(key: string): boolean {
    if (!this.ttlMeta[key]) {
      return false;
    }

    return this.ttlMeta[key] <= Date.now();
  }

  /**
   * Remove expired keys synchronously
   * Returns number of keys removed
   */
  public cleanupSync(): number {
    const now = Date.now();
    let removed = 0;

    const expiredKeys = Object.keys(this.ttlMeta).filter(
      key => this.ttlMeta[key] <= now
    );

    for (const key of expiredKeys) {
      delete this.dataRef[key];
      delete this.ttlMeta[key];
      removed++;
    }

    return removed;
  }

  /**
   * Remove expired keys asynchronously
   * Returns number of keys removed
   */
  public async cleanupExpired(): Promise<number> {
    return this.cleanupSync();
  }

  /**
   * Start automatic scheduled cleanup
   */
  public startScheduledCleanup(intervalMs: number): void {
    if (typeof intervalMs !== 'number' || intervalMs <= 0) {
      throw new ValidationError('Interval must be a positive number', { intervalMs });
    }

    if (this.cleanupInterval) {
      this.stopScheduledCleanup();
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupSync();
    }, intervalMs);
  }

  /**
   * Stop scheduled cleanup
   */
  public stopScheduledCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get all keys with TTL
   */
  public getAllWithTTL(): Array<{ key: string; expiresAt: number; remainingMs: number }> {
    const now = Date.now();
    return Object.entries(this.ttlMeta).map(([key, expiresAt]) => ({
      key,
      expiresAt,
      remainingMs: Math.max(0, expiresAt - now)
    }));
  }

  /**
   * Get TTL statistics
   */
  public stats(): {
    total: number;
    expired: number;
    active: number;
  } {
    const now = Date.now();
    const total = Object.keys(this.ttlMeta).length;
    const expired = Object.values(this.ttlMeta).filter(exp => exp < now).length;

    return {
      total,
      expired,
      active: total - expired
    };
  }

  /**
   * Export TTL metadata
   */
  public export(): TTLMetadata {
    return { ...this.ttlMeta };
  }

  /**
   * Import TTL metadata
   */
  public import(metadata: TTLMetadata): void {
    if (typeof metadata !== 'object' || metadata === null) {
      throw new ValidationError('Metadata must be an object', { metadata });
    }

    this.ttlMeta = { ...metadata };
    this.cleanupSync();
  }

  /**
   * Clear all TTL metadata
   */
  public clear(): void {
    this.ttlMeta = {};
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopScheduledCleanup();
  }
}
