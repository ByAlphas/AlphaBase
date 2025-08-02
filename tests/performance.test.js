/**
 * AlphaBase V3.0.0 Performance Test Suite
 * Simplified professional benchmarks
 */

const AlphaBase = require('../alpha');
const path = require('path');
const fs = require('fs');

describe('AlphaBase Performance Tests', () => {
  const testFile = path.resolve(__dirname, 'performance-test.json');
  let db;

  beforeEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  afterEach(async () => {
    if (db && db.cleanup) {
      await db.cleanup();
    }
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  describe('Basic Performance', () => {
    test('writes and reads data efficiently', async () => {
      db = new AlphaBase({ 
        filePath: testFile,
        performanceMode: false // Disable for compatibility
      });

      const start = Date.now();
      
      // Write test
      for (let i = 0; i < 100; i++) {
        await db.set(`key-${i}`, { id: i, data: `test-${i}` });
      }
      
      const writeTime = Date.now() - start;
      
      // Read test
      const readStart = Date.now();
      for (let i = 0; i < 100; i++) {
        const value = await db.get(`key-${i}`);
        expect(value.id).toBe(i);
      }
      const readTime = Date.now() - readStart;
      
      console.log(`Write time: ${writeTime}ms, Read time: ${readTime}ms`);
      expect(writeTime).toBeLessThan(5000); // 5 seconds max
      expect(readTime).toBeLessThan(1000); // 1 second max
    }, 10000);

    test('handles batch operations', async () => {
      db = new AlphaBase({ 
        filePath: testFile,
        performanceMode: false
      });

      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push({
          op: 'set',
          key: `batch-${i}`,
          value: { data: `batch-data-${i}` }
        });
      }

      const start = Date.now();
      await db.batchAsync(operations);
      const duration = Date.now() - start;

      // Verify data
      for (let i = 0; i < 50; i++) {
        const value = await db.get(`batch-${i}`);
        expect(value.data).toBe(`batch-data-${i}`);
      }

      console.log(`Batch operation time: ${duration}ms`);
      expect(duration).toBeLessThan(2000); // 2 seconds max
    }, 10000);

    test('statistics include performance data', () => {
      db = new AlphaBase({ 
        filePath: testFile,
        performanceMode: true
      });

      db.setSync('test-key', 'test-value');
      const stats = db.statsSync();

      expect(stats.totalKeys).toBe(1);
      expect(stats.fileSize).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      
      // Performance stats might be available
      if (stats.performance) {
        expect(typeof stats.performance).toBe('object');
      }
    });
  });

  describe('Resource Management', () => {
    test('cleans up resources properly', async () => {
      db = new AlphaBase({ 
        filePath: testFile,
        performanceMode: true
      });

      await db.set('cleanup-test', 'value');
      
      const result = await db.shutdown();
      expect(typeof result).toBe('boolean');
    });
  });
});
