import { AlphaBase } from '../dist/index';
import * as fs from 'fs';
import * as path from 'path';

describe('AlphaBase - Transaction Management', () => {
  const testDbPath = path.join(__dirname, 'test-transaction.json');
  let db: AlphaBase;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = new AlphaBase({ 
      filePath: testDbPath,
      cache: false // Disable cache for tests
    });
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Transaction Commit', () => {
    test('should commit transaction successfully', async () => {
      const result = await db.executeTransaction(async () => {
        db.set('key1', 'value1');
        db.set('key2', 'value2');
        return 'success';
      });

      expect(result).toBe('success');
      expect(db.get('key1')).toBe('value1');
      expect(db.get('key2')).toBe('value2');
    });

    test('should return transaction result', async () => {
      const result = await db.executeTransaction(async () => {
        db.set('user:1', { name: 'Alice', age: 28 });
        return db.get('user:1');
      });

      expect(result).toEqual({ name: 'Alice', age: 28 });
    });

    test('should support nested operations', async () => {
      await db.executeTransaction(async () => {
        db.set('key1', 'value1');
        db.set('key2', 'value2');
        db.delete('key1');
        db.set('key3', 'value3');
      });

      expect(db.has('key1')).toBe(false);
      expect(db.get('key2')).toBe('value2');
      expect(db.get('key3')).toBe('value3');
    });
  });

  describe('Transaction Rollback', () => {
    test('should rollback on error', async () => {
      db.set('existing', 'original');

      try {
        await db.executeTransaction(async () => {
          db.set('key1', 'value1');
          db.set('key2', 'value2');
          throw new Error('Transaction failed');
        });
      } catch (error) {
        expect((error as Error).message).toBe('Transaction failed');
      }

      expect(db.has('key1')).toBe(false);
      expect(db.has('key2')).toBe(false);
      expect(db.get('existing')).toBe('original');
    });

    test('should restore original values on rollback', async () => {
      db.set('key1', 'original1');
      db.set('key2', 'original2');

      try {
        await db.executeTransaction(async () => {
          db.set('key1', 'modified1');
          db.set('key2', 'modified2');
          db.set('key3', 'new3');
          throw new Error('Rollback test');
        });
      } catch (error) {
        // Expected error
      }

      expect(db.get('key1')).toBe('original1');
      expect(db.get('key2')).toBe('original2');
      expect(db.has('key3')).toBe(false);
    });

    test('should handle delete operations in rollback', async () => {
      db.set('key1', 'value1');
      db.set('key2', 'value2');

      try {
        await db.executeTransaction(async () => {
          db.delete('key1');
          db.delete('key2');
          db.set('key3', 'value3');
          throw new Error('Rollback test');
        });
      } catch (error) {
        // Expected error
      }

      expect(db.get('key1')).toBe('value1');
      expect(db.get('key2')).toBe('value2');
      expect(db.has('key3')).toBe(false);
    });
  });

  describe('Transaction Isolation', () => {
    test('should isolate changes during transaction', async () => {
      db.set('key1', 'original');

      let valueInsideTransaction: any;
      await db.executeTransaction(async () => {
        db.set('key1', 'modified');
        valueInsideTransaction = db.get('key1');
      });

      expect(valueInsideTransaction).toBe('modified');
      expect(db.get('key1')).toBe('modified');
    });
  });

  describe('Complex Transaction Scenarios', () => {
    test('should handle batch operations in transaction', async () => {
      await db.executeTransaction(async () => {
        db.batch([
          { type: 'set', key: 'key1', value: 'value1' },
          { type: 'set', key: 'key2', value: 'value2' },
          { type: 'set', key: 'key3', value: 'value3' }
        ]);
      });

      expect(db.size()).toBe(3);
      expect(db.get('key1')).toBe('value1');
    });

    test('should rollback batch operations on error', async () => {
      try {
        await db.executeTransaction(async () => {
          db.batch([
            { type: 'set', key: 'key1', value: 'value1' },
            { type: 'set', key: 'key2', value: 'value2' }
          ]);
          throw new Error('Batch rollback test');
        });
      } catch (error) {
        // Expected error
      }

      expect(db.size()).toBe(0);
      expect(db.has('key1')).toBe(false);
      expect(db.has('key2')).toBe(false);
    });

    test('should handle async operations in transaction', async () => {
      const result = await db.executeTransaction(async () => {
        db.set('key1', 'value1');
        await new Promise(resolve => setTimeout(resolve, 10));
        db.set('key2', 'value2');
        return 'async-success';
      });

      expect(result).toBe('async-success');
      expect(db.get('key1')).toBe('value1');
      expect(db.get('key2')).toBe('value2');
    });
  });
});
