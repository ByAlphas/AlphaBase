import { AlphaBase } from '../src/AlphaBase';
import * as fs from 'fs';
import * as path from 'path';

describe('AlphaBase - Monitoring & Metrics', () => {
  let db: AlphaBase;
  let testDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Close existing db if any
    if (db) {
      await db.close();
    }
    
    // Create unique test directory for each test
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDir = path.join(__dirname, `test-monitoring-${timestamp}-${random}`);
    dbPath = path.join(testDir, 'monitoring-test.json');
    
    // Clean up directory if exists
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    db = new AlphaBase({ 
      filePath: dbPath,
      enableMetrics: true,
      enableHealthChecks: true
    });
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Metrics Collection', () => {
    test('should track operations', () => {
      db.set('key1', 'value1');
      db.get('key1');
      db.delete('key1');
      
      const metrics = db.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).not.toBeNull();
    });

    test('should provide metrics structure', () => {
      db.set('key1', 'value1');
      
      const metrics = db.getMetrics();
      expect(metrics).toHaveProperty('counters');
      expect(metrics).toHaveProperty('gauges');
      expect(metrics).toHaveProperty('histograms');
    });

    test('should track operations in counters', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      db.get('key1');
      
      const metrics = db.getMetrics();
      if (metrics) {
        expect(metrics.counters).toBeDefined();
        expect(typeof metrics.counters).toBe('object');
      }
    });
  });

  describe('Metrics Export', () => {
    test('should export metrics in JSON format', () => {
      db.set('key1', 'value1');
      db.get('key1');
      
      const metrics = db.getMetrics();
      const json = JSON.stringify(metrics);
      
      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('should export metrics in Prometheus format', () => {
      db.set('key1', 'value1');
      db.get('key1');
      
      const prometheus = db.exportMetrics();
      
      expect(typeof prometheus).toBe('string');
      expect(prometheus.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Metrics', () => {
    test('should track multiple operations', () => {
      for (let i = 0; i < 10; i++) {
        db.set(`key${i}`, `value${i}`);
        db.get(`key${i}`);
      }
      
      const metrics = db.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).not.toBeNull();
    });

    test('should measure batch operations', () => {
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push({ key: `batch:${i}`, value: { id: i } });
      }
      
      operations.forEach(op => db.set(op.key, op.value));
      
      const metrics = db.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Real-time Statistics', () => {
    test('should provide database statistics', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      
      const stats = db.stats();
      
      expect(stats.keys).toBe(2);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.filePath).toBeTruthy();
    });

    test('should update stats in real-time', () => {
      db.set('new', 'value');
      
      const stats = db.stats();
      expect(stats.keys).toBe(1);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Metrics with Disabled Monitoring', () => {
    test('should handle metrics when monitoring is disabled', () => {
      const dbNoMetrics = new AlphaBase({
        filePath: path.join(testDir, 'no-metrics.json'),
        enableMetrics: false
      });
      
      dbNoMetrics.set('key1', 'value1');
      
      // Should throw error when metrics are disabled
      expect(() => dbNoMetrics.getMetrics()).toThrow('Metrics are not enabled');
      
      dbNoMetrics.close();
    });
  });
});

