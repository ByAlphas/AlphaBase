import { AlphaBase } from '../src/AlphaBase';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

describe('AlphaBase - Streaming API', () => {
  let db: AlphaBase;
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    // Create unique test directory for each test
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDir = path.join(__dirname, `test-streaming-${timestamp}-${random}`);
    dbPath = path.join(testDir, 'streaming-test.json');
    
    fs.mkdirSync(testDir, { recursive: true });

    db = new AlphaBase({ filePath: dbPath });

    // Add test data
    for (let i = 1; i <= 50; i++) {
      db.set(`item:${i}`, {
        id: i,
        name: `Item ${i}`,
        value: i * 10,
        category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C'
      });
    }
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Stream Creation', () => {
    test('should create a read stream', () => {
      const stream = db.createReadStream();
      expect(stream).toBeInstanceOf(Readable);
    });

    test('should create a key stream', () => {
      const stream = db.createKeyStream();
      expect(stream).toBeInstanceOf(Readable);
    });

    test('should create a value stream', () => {
      const stream = db.createValueStream();
      expect(stream).toBeInstanceOf(Readable);
    });
  });

  describe('Read Stream', () => {
    test('should stream all entries', (done) => {
      const stream = db.createReadStream();
      const entries: any[] = [];

      stream.on('data', (chunk) => {
        entries.push(chunk);
      });

      stream.on('end', () => {
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0]).toHaveProperty('key');
        expect(entries[0]).toHaveProperty('value');
        done();
      });

      stream.on('error', done);
    });

    test('should handle backpressure', (done) => {
      const stream = db.createReadStream({ highWaterMark: 5 });
      let dataCount = 0;
      let paused = false;

      stream.on('data', () => {
        dataCount++;
        if (dataCount === 10 && !paused) {
          paused = true;
          stream.pause();
          setTimeout(() => {
            stream.resume();
          }, 50);
        }
      });

      stream.on('end', () => {
        expect(dataCount).toBeGreaterThan(0);
        expect(paused).toBe(true);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Key Stream', () => {
    test('should stream only keys', (done) => {
      const stream = db.createKeyStream();
      const keys: string[] = [];

      stream.on('data', (key) => {
        keys.push(key);
      });

      stream.on('end', () => {
        expect(keys.length).toBeGreaterThan(0);
        expect(typeof keys[0]).toBe('string');
        expect(keys[0]).toMatch(/^item:\d+$/);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Value Stream', () => {
    test('should stream only values', (done) => {
      const stream = db.createValueStream();
      const values: any[] = [];

      stream.on('data', (value) => {
        values.push(value);
      });

      stream.on('end', () => {
        expect(values.length).toBeGreaterThan(0);
        expect(values[0]).toHaveProperty('id');
        expect(values[0]).toHaveProperty('name');
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Stream Transforms', () => {
    test('should transform streamed data', (done) => {
      const stream = db.createValueStream();
      const transformed: any[] = [];

      stream.on('data', (value: any) => {
        // Transform data
        transformed.push({
          id: value.id,
          doubled: value.value * 2
        });
      });

      stream.on('end', () => {
        expect(transformed.length).toBeGreaterThan(0);
        expect(transformed[0].doubled).toBe(transformed[0].id * 20);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Stream Filtering', () => {
    test('should filter streamed data', (done) => {
      const stream = db.createReadStream();
      const filtered: any[] = [];

      stream.on('data', (entry: any) => {
        if (entry.value.category === 'A') {
          filtered.push(entry);
        }
      });

      stream.on('end', () => {
        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((item) => item.value.category === 'A')).toBe(true);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Stream Batching', () => {
    test('should batch streamed data', (done) => {
      const stream = db.createReadStream();
      const batch: any[] = [];
      const batchSize = 10;
      const batches: any[][] = [];

      stream.on('data', (chunk) => {
        batch.push(chunk);
        if (batch.length === batchSize) {
          batches.push([...batch]);
          batch.length = 0;
        }
      });

      stream.on('end', () => {
        if (batch.length > 0) {
          batches.push([...batch]);
        }
        expect(batches.length).toBeGreaterThan(0);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Stream Error Handling', () => {
    test('should handle stream errors gracefully', (done) => {
      const stream = db.createReadStream();
      let errorHandled = false;

      stream.on('data', (chunk) => {
        // Simulate error
        if (chunk.key === 'item:25') {
          stream.destroy(new Error('Simulated error'));
        }
      });

      stream.on('error', (error) => {
        errorHandled = true;
        expect(error.message).toBe('Simulated error');
      });

      stream.on('close', () => {
        expect(errorHandled).toBe(true);
        done();
      });
    });
  });

  describe('Stream to File', () => {
    test('should pipe stream to file', (done) => {
      const outputPath = path.join(testDir, 'output.json');
      const stream = db.createReadStream();
      const chunks: any[] = [];

      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        const content = JSON.stringify(chunks, null, 2);
        fs.writeFileSync(outputPath, content);
        
        expect(fs.existsSync(outputPath)).toBe(true);
        const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        expect(written.length).toBe(chunks.length);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('Stream Performance', () => {
    test('should efficiently stream large datasets', (done) => {
      // Add more data
      for (let i = 51; i <= 1000; i++) {
        db.set(`bulk:${i}`, { id: i, data: 'x'.repeat(100) });
      }

      const stream = db.createReadStream({ highWaterMark: 100 });
      let count = 0;
      const startTime = Date.now();

      stream.on('data', () => {
        count++;
      });

      stream.on('end', () => {
        const duration = Date.now() - startTime;
        expect(count).toBeGreaterThanOrEqual(1000); // >= 1000 items (50 initial + 950 bulk)
        expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
        done();
      });

      stream.on('error', done);
    }, 10000); // 10 second timeout
  });
});
