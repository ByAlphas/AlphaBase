/**
 * LRU Cache Node
 */
interface CacheNode<T> {
  key: string;
  value: T;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
  expiresAt?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
  evictions: number;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  onEvict?: (key: string, value: unknown) => void;
}

/**
 * LRU (Least Recently Used) Cache Manager
 * Provides fast in-memory caching with automatic eviction
 * Zero external dependencies - uses native Map
 */
export class CacheManager<T = unknown> {
  private cache: Map<string, CacheNode<T>>;
  private head: CacheNode<T> | null;
  private tail: CacheNode<T> | null;
  private maxSize: number;
  private defaultTTL?: number;
  private hits: number;
  private misses: number;
  private evictions: number;
  private onEvictCallback?: (key: string, value: unknown) => void;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.ttl;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.onEvictCallback = options.onEvict;
    this.cleanupInterval = null;

    // Start periodic cleanup for expired entries
    if (this.defaultTTL) {
      this.startCleanup();
    }
  }

  /**
   * Get value from cache
   */
  public get(key: string): T | undefined {
    const node = this.cache.get(key);

    if (!node) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (node.expiresAt && Date.now() > node.expiresAt) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to head (most recently used)
    this.moveToHead(node);
    this.hits++;
    return node.value;
  }

  /**
   * Set value in cache
   */
  public set(key: string, value: T, ttl?: number): void {
    let node = this.cache.get(key);

    if (node) {
      // Update existing node
      node.value = value;
      node.expiresAt = ttl ? Date.now() + ttl : this.defaultTTL ? Date.now() + this.defaultTTL : undefined;
      this.moveToHead(node);
    } else {
      // Create new node
      node = {
        key,
        value,
        prev: null,
        next: null,
        expiresAt: ttl ? Date.now() + ttl : this.defaultTTL ? Date.now() + this.defaultTTL : undefined,
      };

      this.cache.set(key, node);
      this.addToHead(node);

      // Evict LRU if over capacity
      if (this.cache.size > this.maxSize) {
        this.evictLRU();
      }
    }
  }

  /**
   * Check if key exists in cache
   */
  public has(key: string): boolean {
    const node = this.cache.get(key);
    
    if (!node) {
      return false;
    }

    // Check if expired
    if (node.expiresAt && Date.now() > node.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   */
  public delete(key: string): boolean {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    this.removeNode(node);
    this.cache.delete(key);

    if (this.onEvictCallback) {
      this.onEvictCallback(key, node.value);
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  public clear(): void {
    if (this.onEvictCallback) {
      // Call evict callback for all entries
      for (const [key, node] of this.cache.entries()) {
        this.onEvictCallback(key, node.value);
      }
    }

    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  public stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
      evictions: this.evictions,
    };
  }

  /**
   * Get all keys in cache
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Cleanup expired entries
   */
  public cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, node] of this.cache.entries()) {
      if (node.expiresAt && now > node.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    // Don't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop periodic cleanup
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Move node to head (most recently used)
   */
  private moveToHead(node: CacheNode<T>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Add node to head
   */
  private addToHead(node: CacheNode<T>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from list
   */
  private removeNode(node: CacheNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const key = this.tail.key;
    const value = this.tail.value;

    this.removeNode(this.tail);
    this.cache.delete(key);
    this.evictions++;

    if (this.onEvictCallback) {
      this.onEvictCallback(key, value);
    }
  }

  /**
   * Destroy cache and cleanup
   */
  public destroy(): void {
    this.stopCleanup();
    this.clear();
  }
}
