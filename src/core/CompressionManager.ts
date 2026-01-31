import * as zlib from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);
const brotliCompressAsync = promisify(zlib.brotliCompress);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);

/**
 * Compression algorithm types
 */
export type CompressionAlgorithm = 'gzip' | 'brotli' | 'none';

/**
 * Compression options
 */
export interface CompressionOptions {
  /** Compression algorithm to use */
  algorithm?: CompressionAlgorithm;
  /** Compression level (1-9 for gzip, 0-11 for brotli) */
  level?: number;
  /** Minimum size threshold for compression (bytes) */
  threshold?: number;
}

/**
 * Compressed data structure
 */
export interface CompressedData {
  /** Compressed data buffer */
  data: Buffer;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression algorithm used */
  algorithm: CompressionAlgorithm;
  /** Compression ratio (compressed/original) */
  ratio: number;
}

/**
 * Compression Manager
 * Provides data compression/decompression services
 */
export class CompressionManager {
  private readonly options: Required<CompressionOptions>;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      algorithm: options.algorithm ?? 'gzip',
      level: options.level ?? 6,
      threshold: options.threshold ?? 1024 // 1KB default threshold
    };

    // Validate compression level
    if (this.options.algorithm === 'gzip') {
      this.options.level = Math.max(1, Math.min(9, this.options.level));
    } else if (this.options.algorithm === 'brotli') {
      this.options.level = Math.max(0, Math.min(11, this.options.level));
    }
  }

  /**
   * Compress data (async)
   */
  public async compress(data: string | Buffer): Promise<CompressedData> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const originalSize = buffer.length;

    // Skip compression if below threshold
    if (originalSize < this.options.threshold) {
      return {
        data: buffer,
        originalSize,
        compressedSize: originalSize,
        algorithm: 'none',
        ratio: 1
      };
    }

    let compressed: Buffer;

    if (this.options.algorithm === 'gzip') {
      compressed = await gzipAsync(buffer, { level: this.options.level });
    } else if (this.options.algorithm === 'brotli') {
      compressed = await brotliCompressAsync(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level
        }
      });
    } else {
      compressed = buffer;
    }

    const compressedSize = compressed.length;
    const ratio = compressedSize / originalSize;

    // If compression didn't help, return original
    if (ratio >= 0.95) {
      return {
        data: buffer,
        originalSize,
        compressedSize: originalSize,
        algorithm: 'none',
        ratio: 1
      };
    }

    return {
      data: compressed,
      originalSize,
      compressedSize,
      algorithm: this.options.algorithm,
      ratio
    };
  }

  /**
   * Compress data (sync)
   */
  public compressSync(data: string | Buffer): CompressedData {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const originalSize = buffer.length;

    // Skip compression if below threshold
    if (originalSize < this.options.threshold) {
      return {
        data: buffer,
        originalSize,
        compressedSize: originalSize,
        algorithm: 'none',
        ratio: 1
      };
    }

    let compressed: Buffer;

    if (this.options.algorithm === 'gzip') {
      compressed = zlib.gzipSync(buffer, { level: this.options.level });
    } else if (this.options.algorithm === 'brotli') {
      compressed = zlib.brotliCompressSync(buffer, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level
        }
      });
    } else {
      compressed = buffer;
    }

    const compressedSize = compressed.length;
    const ratio = compressedSize / originalSize;

    // If compression didn't help, return original
    if (ratio >= 0.95) {
      return {
        data: buffer,
        originalSize,
        compressedSize: originalSize,
        algorithm: 'none',
        ratio: 1
      };
    }

    return {
      data: compressed,
      originalSize,
      compressedSize,
      algorithm: this.options.algorithm,
      ratio
    };
  }

  /**
   * Decompress data (async)
   */
  public async decompress(
    data: Buffer,
    algorithm: CompressionAlgorithm
  ): Promise<Buffer> {
    if (algorithm === 'none') {
      return data;
    }

    if (algorithm === 'gzip') {
      return await gunzipAsync(data);
    } else if (algorithm === 'brotli') {
      return await brotliDecompressAsync(data);
    }

    throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }

  /**
   * Decompress data (sync)
   */
  public decompressSync(
    data: Buffer,
    algorithm: CompressionAlgorithm
  ): Buffer {
    if (algorithm === 'none') {
      return data;
    }

    if (algorithm === 'gzip') {
      return zlib.gunzipSync(data);
    } else if (algorithm === 'brotli') {
      return zlib.brotliDecompressSync(data);
    }

    throw new Error(`Unsupported compression algorithm: ${algorithm}`);
  }

  /**
   * Compress JSON object
   */
  public async compressJSON(obj: unknown): Promise<CompressedData> {
    const json = JSON.stringify(obj);
    return this.compress(json);
  }

  /**
   * Compress JSON object (sync)
   */
  public compressJSONSync(obj: unknown): CompressedData {
    const json = JSON.stringify(obj);
    return this.compressSync(json);
  }

  /**
   * Decompress to JSON object
   */
  public async decompressJSON<T = unknown>(
    data: Buffer,
    algorithm: CompressionAlgorithm
  ): Promise<T> {
    const decompressed = await this.decompress(data, algorithm);
    const json = decompressed.toString('utf8');
    return JSON.parse(json);
  }

  /**
   * Decompress to JSON object (sync)
   */
  public decompressJSONSync<T = unknown>(
    data: Buffer,
    algorithm: CompressionAlgorithm
  ): T {
    const decompressed = this.decompressSync(data, algorithm);
    const json = decompressed.toString('utf8');
    return JSON.parse(json);
  }

  /**
   * Get compression statistics for data
   */
  public static analyzeCompression(data: string | Buffer): {
    gzip: { size: number; ratio: number };
    brotli: { size: number; ratio: number };
    none: { size: number; ratio: number };
    best: CompressionAlgorithm;
  } {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const originalSize = buffer.length;

    const gzipSize = zlib.gzipSync(buffer).length;
    const brotliSize = zlib.brotliCompressSync(buffer).length;

    const gzipRatio = gzipSize / originalSize;
    const brotliRatio = brotliSize / originalSize;

    let best: CompressionAlgorithm = 'none';
    let bestSize = originalSize;

    if (gzipSize < bestSize) {
      best = 'gzip';
      bestSize = gzipSize;
    }

    if (brotliSize < bestSize) {
      best = 'brotli';
      bestSize = brotliSize;
    }

    return {
      gzip: { size: gzipSize, ratio: gzipRatio },
      brotli: { size: brotliSize, ratio: brotliRatio },
      none: { size: originalSize, ratio: 1 },
      best
    };
  }
}

/**
 * Memory Pool for reducing GC pressure
 */
export class MemoryPool {
  private readonly pools: Map<number, Buffer[]>;
  private readonly maxPoolSize: number;
  private hits: number;
  private misses: number;

  constructor(maxPoolSize: number = 10) {
    this.pools = new Map();
    this.maxPoolSize = maxPoolSize;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get buffer from pool or allocate new one
   */
  public acquire(size: number): Buffer {
    // Round up to nearest power of 2 for better pooling
    const poolSize = Math.pow(2, Math.ceil(Math.log2(size)));
    
    const pool = this.pools.get(poolSize);
    
    if (pool && pool.length > 0) {
      this.hits++;
      return pool.pop()!;
    }

    this.misses++;
    return Buffer.allocUnsafe(poolSize);
  }

  /**
   * Return buffer to pool
   */
  public release(buffer: Buffer): void {
    const size = buffer.length;
    
    let pool = this.pools.get(size);
    
    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }

    if (pool.length < this.maxPoolSize) {
      // Clear buffer before returning to pool
      buffer.fill(0);
      pool.push(buffer);
    }
  }

  /**
   * Clear all pools
   */
  public clear(): void {
    this.pools.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get pool statistics
   */
  public getStats() {
    const totalBuffers = Array.from(this.pools.values())
      .reduce((sum, pool) => sum + pool.length, 0);
    
    const totalSize = Array.from(this.pools.entries())
      .reduce((sum, [size, pool]) => sum + size * pool.length, 0);

    return {
      pools: this.pools.size,
      buffers: totalBuffers,
      totalSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }
}
