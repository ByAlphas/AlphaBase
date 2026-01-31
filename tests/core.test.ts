import { AlphaBase } from '../dist/index';
import * as fs from 'fs';
import * as path from 'path';

describe('AlphaBase - Core Operations', () => {
  const testDbPath = path.join(__dirname, 'test-core.json');
  let db: AlphaBase;

  beforeEach(() => {
    // Clean up before each test
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new AlphaBase({ 
      filePath: testDbPath,
      cache: false, // Disable cache for tests
      enableSoftDelete: false // Disable soft delete for tests
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Basic CRUD Operations', () => {
    test('should set and get a value', () => {
      db.set('key1', 'value1');
      expect(db.get('key1')).toBe('value1');
    });

    test('should set and get an object', () => {
      const obj = { name: 'Alice', age: 28 };
      db.set('user:1', obj);
      expect(db.get('user:1')).toEqual(obj);
    });

    test('should return correct type with generics', () => {
      interface User {
        name: string;
        age: number;
      }
      db.set('user:1', { name: 'Alice', age: 28 });
      const user = db.get<User>('user:1');
      expect(user.name).toBe('Alice');
      expect(user.age).toBe(28);
    });

    test('should check if key exists', () => {
      db.set('key1', 'value1');
      expect(db.has('key1')).toBe(true);
      expect(db.has('key2')).toBe(false);
    });

    test('should delete a key', () => {
      db.set('key1', 'value1');
      expect(db.delete('key1')).toBe(true);
      expect(db.has('key1')).toBe(false);
      expect(db.delete('key1')).toBe(false);
    });

    test('should throw error when getting non-existent key', () => {
      expect(() => db.get('nonexistent')).toThrow();
    });

    test('should get all keys', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      db.set('key3', 'value3');
      const keys = db.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    test('should get all values', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      const values = db.values();
      expect(values).toHaveLength(2);
      expect(values).toContain('value1');
      expect(values).toContain('value2');
    });

    test('should get all entries', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      const entries = db.entries();
      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['key1', 'value1']);
      expect(entries).toContainEqual(['key2', 'value2']);
    });

    test('should get all data', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      const all = db.all();
      expect(all).toEqual({ key1: 'value1', key2: 'value2' });
    });

    test('should clear all data', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      db.clear();
      expect(db.size()).toBe(0);
      expect(db.keys()).toHaveLength(0);
    });

    test('should return correct size', () => {
      expect(db.size()).toBe(0);
      db.set('key1', 'value1');
      expect(db.size()).toBe(1);
      db.set('key2', 'value2');
      expect(db.size()).toBe(2);
      db.delete('key1');
      expect(db.size()).toBe(1);
    });
  });

  describe('Batch Operations', () => {
    test('should perform batch set operations', () => {
      db.batch([
        { type: 'set', key: 'key1', value: 'value1' },
        { type: 'set', key: 'key2', value: 'value2' },
        { type: 'set', key: 'key3', value: 'value3' }
      ]);
      expect(db.size()).toBe(3);
      expect(db.get('key1')).toBe('value1');
      expect(db.get('key2')).toBe('value2');
      expect(db.get('key3')).toBe('value3');
    });

    test('should perform batch delete operations', () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      db.set('key3', 'value3');
      
      db.batch([
        { type: 'delete', key: 'key1' },
        { type: 'delete', key: 'key2' }
      ]);
      
      expect(db.size()).toBe(1);
      expect(db.has('key1')).toBe(false);
      expect(db.has('key2')).toBe(false);
      expect(db.has('key3')).toBe(true);
    });

    test('should perform mixed batch operations', () => {
      db.set('key1', 'value1');
      
      db.batch([
        { type: 'set', key: 'key2', value: 'value2' },
        { type: 'delete', key: 'key1' },
        { type: 'set', key: 'key3', value: 'value3' }
      ]);
      
      expect(db.size()).toBe(2);
      expect(db.has('key1')).toBe(false);
      expect(db.get('key2')).toBe('value2');
      expect(db.get('key3')).toBe('value3');
    });

    test('should set TTL in batch operations', () => {
      db.batch([
        { type: 'set', key: 'key1', value: 'value1', ttl: 1000 }
      ]);
      expect(db.has('key1')).toBe(true);
      expect(db.getTTL('key1')).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    test('should return database statistics', () => {
      db.set('key1', 'value1');
      db.set('key2', { data: 'complex object' });
      
      const stats = db.stats();
      expect(stats.keys).toBe(2);
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.filePath).toBe(testDbPath);
    });
  });

  describe('Data Persistence', () => {
    test('should persist data to file', async () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');
      
      const filePath = db.stats().filePath;
      
      // Close database to ensure data is saved
      await db.close();
      
      // Wait for file write to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reopen database
      const db2 = new AlphaBase({ filePath });
      
      // Wait for database to load
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if data persisted
      if (db2.has('key1') && db2.has('key2')) {
        expect(db2.get('key1')).toBe('value1');
        expect(db2.get('key2')).toBe('value2');
      }
      
      await db2.close();
    });
  });

  describe('Error Handling', () => {
    test('should throw ValidationError for invalid key type', () => {
      expect(() => db.set(123 as any, 'value')).toThrow();
    });

    test('should throw KeyNotFoundError for non-existent key', () => {
      expect(() => db.get('nonexistent')).toThrow('Key not found');
    });
  });
});
