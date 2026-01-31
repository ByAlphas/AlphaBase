import { Readable, Transform } from 'stream';
import { ValidationError } from '../errors';

/**
 * Streaming options
 */
export interface StreamingOptions {
  batchSize?: number;
  highWaterMark?: number;
  encoding?: BufferEncoding;
  transform?: (data: unknown) => unknown;
}

/**
 * Streaming API
 * Provides streaming capabilities for large datasets
 */
export class StreamingAPI {
  private readonly dataRef: Record<string, unknown>;

  constructor(dataRef: Record<string, unknown>) {
    this.dataRef = dataRef;
  }

  /**
   * Create a readable stream of all entries
   */
  public createReadStream(options: StreamingOptions = {}): Readable {
    const {
      batchSize = 500,
      highWaterMark = 16384,
      transform
    } = options;

    // Capture data reference at stream creation time
    const dataRef = this.dataRef;
    const entries = Object.entries(dataRef);
    let index = 0;

    return new Readable({
      objectMode: true,
      highWaterMark,
      read() {
        if (index >= entries.length) {
          this.push(null); // End stream
          return;
        }

        const batch = entries.slice(index, index + batchSize);
        index += batchSize;

        for (const [key, value] of batch) {
          const data = transform ? transform({ key, value }) : { key, value };
          this.push(data);
        }
      }
    });
  }

  /**
   * Create a readable stream of keys only
   */
  public createKeyStream(options: StreamingOptions = {}): Readable {
    const {
      batchSize = 1000,
      highWaterMark = 16384
    } = options;

    const keys = Object.keys(this.dataRef);
    let index = 0;

    return new Readable({
      objectMode: true,
      highWaterMark,
      read() {
        if (index >= keys.length) {
          this.push(null);
          return;
        }

        const batch = keys.slice(index, index + batchSize);
        index += batchSize;

        for (const key of batch) {
          this.push(key);
        }
      }
    });
  }

  /**
   * Create a readable stream of values only
   */
  public createValueStream(options: StreamingOptions = {}): Readable {
    const {
      batchSize = 500,
      highWaterMark = 16384,
      transform
    } = options;

    const values = Object.values(this.dataRef);
    let index = 0;

    return new Readable({
      objectMode: true,
      highWaterMark,
      read() {
        if (index >= values.length) {
          this.push(null);
          return;
        }

        const batch = values.slice(index, index + batchSize);
        index += batchSize;

        for (const value of batch) {
          const data = transform ? transform(value) : value;
          this.push(data);
        }
      }
    });
  }

  /**
   * Create a transform stream for filtering
   */
  public createFilterStream(predicate: (key: string, value: unknown) => boolean): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk: { key: string; value: unknown }, _encoding, callback) {
        try {
          if (predicate(chunk.key, chunk.value)) {
            this.push(chunk);
          }
          callback();
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  /**
   * Create a transform stream for mapping
   */
  public createMapStream(mapper: (key: string, value: unknown) => unknown): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk: { key: string; value: unknown }, _encoding, callback) {
        try {
          const mapped = mapper(chunk.key, chunk.value);
          this.push(mapped);
          callback();
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  /**
   * Create a transform stream for batching
   */
  public createBatchStream(batchSize: number): Transform {
    if (typeof batchSize !== 'number' || batchSize <= 0) {
      throw new ValidationError('Batch size must be a positive number', { batchSize });
    }

    let batch: unknown[] = [];

    return new Transform({
      objectMode: true,
      transform(chunk, _encoding, callback) {
        batch.push(chunk);

        if (batch.length >= batchSize) {
          this.push([...batch]);
          batch = [];
        }

        callback();
      },
      flush(callback) {
        if (batch.length > 0) {
          this.push(batch);
        }
        callback();
      }
    });
  }

  /**
   * Create a transform stream for JSON serialization
   */
  public createJsonStream(pretty: boolean = false): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk, _encoding, callback) {
        try {
          const json = pretty
            ? JSON.stringify(chunk, null, 2)
            : JSON.stringify(chunk);
          this.push(json + '\n');
          callback();
        } catch (error) {
          callback(error as Error);
        }
      }
    });
  }

  /**
   * Stream to array
   */
  public static async streamToArray(stream: Readable): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const results: unknown[] = [];

      stream.on('data', (chunk) => {
        results.push(chunk);
      });

      stream.on('end', () => {
        resolve(results);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Pipe stream to writable
   */
  public static pipeStream(readable: Readable, writable: NodeJS.WritableStream): Promise<void> {
    return new Promise((resolve, reject) => {
      readable.pipe(writable);

      readable.on('error', reject);
      writable.on('error', reject);
      writable.on('finish', resolve);
    });
  }

  /**
   * Count items in stream
   */
  public static async countStream(stream: Readable): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;

      stream.on('data', () => {
        count++;
      });

      stream.on('end', () => {
        resolve(count);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Stream forEach
   */
  public static async forEachStream(
    stream: Readable,
    callback: (chunk: unknown, index: number) => void | Promise<void>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let index = 0;

      stream.on('data', async (chunk) => {
        try {
          await callback(chunk, index++);
        } catch (error) {
          stream.destroy();
          reject(error);
        }
      });

      stream.on('end', () => {
        resolve();
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Create a chunked export stream
   */
  public createExportStream(chunkSize: number = 1000): Readable {
    const entries = Object.entries(this.dataRef);
    let index = 0;

    return new Readable({
      read() {
        if (index >= entries.length) {
          this.push(null);
          return;
        }

        const chunk = entries.slice(index, index + chunkSize);
        index += chunkSize;

        const obj: Record<string, unknown> = {};
        for (const [key, value] of chunk) {
          obj[key] = value;
        }

        this.push(JSON.stringify(obj) + '\n');
      }
    });
  }

  /**
   * Stream with backpressure handling
   */
  public createBackpressureStream(
    processor: (key: string, value: unknown) => Promise<unknown>,
    concurrency: number = 10
  ): Transform {
    let processing = 0;
    const queue: Array<{ chunk: any; callback: Function }> = [];

    const processNext = async (stream: Transform) => {
      if (queue.length === 0 || processing >= concurrency) {
        return;
      }

      const { chunk, callback } = queue.shift()!;
      processing++;

      try {
        const result = await processor(chunk.key, chunk.value);
        stream.push(result);
        callback();
      } catch (error) {
        callback(error);
      } finally {
        processing--;
        processNext(stream);
      }
    };

    return new Transform({
      objectMode: true,
      async transform(chunk, _encoding, callback) {
        queue.push({ chunk, callback });
        processNext(this);
      },
      async flush(callback) {
        // Wait for all processing to complete
        const checkDone = () => {
          if (processing === 0 && queue.length === 0) {
            callback();
          } else {
            setTimeout(checkDone, 10);
          }
        };
        checkDone();
      }
    });
  }
}
