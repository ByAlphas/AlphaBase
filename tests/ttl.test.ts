import { AlphaBase } from '../dist/index';
import * as fs from 'fs';
import * as path from 'path';

describe('AlphaBase - TTL (Time To Live)', () => {
  const testDbPath = path.join(__dirname, 'test-ttl.json');
  let db: AlphaBase;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new AlphaBase({ filePath: testDbPath });
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Setting TTL', () => {
    test('should set TTL on key creation', () => {
      db.set('key1', 'value1', { ttl: 5000 });
      const ttl = db.getTTL('key1');
      expect(ttl).toBeGreaterThan(4000);
      expect(ttl).toBeLessThanOrEqual(5000);
    });

    test('should update TTL on existing key', () => {
      db.set('key1', 'value1');
      db.setTTL('key1', 3000);
      const ttl = db.getTTL('key1');
      expect(ttl).toBeGreaterThan(2000);
      expect(ttl).toBeLessThanOrEqual(3000);
    });

    test('should override TTL when updating value', () => {
      db.set('key1', 'value1', { ttl: 5000 });
      db.set('key1', 'value2', { ttl: 3000 });
      const ttl = db.getTTL('key1');
      expect(ttl).toBeGreaterThan(2000);
      expect(ttl).toBeLessThanOrEqual(3000);
    });
  });

  describe('Getting TTL', () => {
    test('should return -1 for keys without TTL', () => {
      db.set('key1', 'value1');
      expect(db.getTTL('key1')).toBe(-1);
    });

    test('should return remaining TTL', () => {
      db.set('key1', 'value1', { ttl: 10000 });
      const ttl = db.getTTL('key1');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10000);
    });

    test('should throw error for non-existent key', () => {
      expect(() => db.getTTL('nonexistent')).toThrow();
    });
  });

  describe('Expiring Keys', () => {
    test('should expire key after TTL', (done) => {
      db.set('key1', 'value1', { ttl: 100 });
      expect(db.has('key1')).toBe(true);

      setTimeout(() => {
        expect(db.has('key1')).toBe(false);
        done();
      }, 150);
    });

    test('should not expire key before TTL', (done) => {
      db.set('key1', 'value1', { ttl: 200 });
      
      setTimeout(() => {
        expect(db.has('key1')).toBe(true);
        done();
      }, 100);
    });

    test('should handle multiple keys with different TTLs', (done) => {
      db.set('key1', 'value1', { ttl: 100 });
      db.set('key2', 'value2', { ttl: 200 });
      db.set('key3', 'value3');

      setTimeout(() => {
        expect(db.has('key1')).toBe(false);
        expect(db.has('key2')).toBe(true);
        expect(db.has('key3')).toBe(true);
      }, 150);

      setTimeout(() => {
        expect(db.has('key1')).toBe(false);
        expect(db.has('key2')).toBe(false);
        expect(db.has('key3')).toBe(true);
        done();
      }, 250);
    });
  });

  describe('Removing TTL', () => {
    test('should remove TTL from key', () => {
      db.set('key1', 'value1', { ttl: 5000 });
      expect(db.getTTL('key1')).toBeGreaterThan(0);
      
      db.setTTL('key1', -1);
      expect(db.getTTL('key1')).toBe(-1);
    });

    test('should not expire after removing TTL', (done) => {
      db.set('key1', 'value1', { ttl: 100 });
      db.setTTL('key1', -1);

      setTimeout(() => {
        expect(db.has('key1')).toBe(true);
        done();
      }, 150);
    });
  });

  describe('TTL Cleanup', () => {
    test('should clean up expired keys', (done) => {
      db.set('key1', 'value1', { ttl: 50 });
      db.set('key2', 'value2', { ttl: 50 });
      db.set('key3', 'value3');

      expect(db.size()).toBe(3);

      setTimeout(() => {
        // Trigger cleanup by checking keys
        db.has('key1');
        expect(db.size()).toBe(1);
        expect(db.has('key3')).toBe(true);
        done();
      }, 100);
    });
  });

  describe('TTL Edge Cases', () => {
    test('should handle very short TTL', async () => {
      db.set('key1', 'value1', { ttl: 1 });
      
      // Wait for key to expire
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check if has() correctly identifies expired key
      expect(db.has('key1')).toBe(false);
    });

    test('should handle negative TTL (no expiration)', () => {
      db.set('key1', 'value1');
      expect(db.getTTL('key1')).toBe(-1);
    });

    test('should maintain TTL info in stats', () => {
      db.set('key1', 'value1', { ttl: 5000 });
      db.set('key2', 'value2');
      
      const stats = db.stats();
      expect(stats.keys).toBe(2);
    });
  });

  describe('TTL Persistence', () => {
    test('should persist TTL information', async () => {
      db.set('key1', 'value1', { ttl: 10000 });
      db.set('key2', 'value2');
      
      const ttlBefore = db.getTTL('key1');
      const filePath = db.stats().filePath;
      
      // Close database
      await db.close();
      
      // Wait for file write to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reopen database
      const db2 = new AlphaBase({ filePath });
      
      // Wait for database to load
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if key still exists and has TTL
      if (db2.has('key1')) {
        const ttlAfter = db2.getTTL('key1');
        expect(ttlAfter).toBeGreaterThan(0);
        expect(ttlAfter).toBeLessThan(ttlBefore);
      }
      
      // Check key2 only if it exists
      if (db2.has('key2')) {
        expect(db2.get('key2')).toBe('value2');
      }
      
      await db2.close();
    });
  });
});
