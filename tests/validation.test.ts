import { AlphaBase } from '../dist/index';
import * as fs from 'fs';
import * as path from 'path';

describe('AlphaBase - Validation & Security', () => {
  const testDbPath = path.join(__dirname, 'test-validation.json');
  let db: AlphaBase;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Schema Validation', () => {
    test('should validate data with schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      };

      db = new AlphaBase({ filePath: testDbPath, schema });

      db.set('user:1', { name: 'Alice', age: 28 });
      const user = db.get<{ name: string; age: number }>('user:1');
      expect(user.name).toBe('Alice');
      expect(user.age).toBe(28);
    });

    test('should reject invalid data', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      };

      db = new AlphaBase({ filePath: testDbPath, schema });

      expect(() => {
        db.set('user:1', { name: 'Alice' }); // Missing age
      }).toThrow();
    });

    test('should reject wrong type', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      };

      db = new AlphaBase({ filePath: testDbPath, schema });

      expect(() => {
        db.set('user:1', { name: 'Alice', age: '28' }); // Wrong type
      }).toThrow();
    });

    test('should validate nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' }
            },
            required: ['name', 'email']
          }
        },
        required: ['user']
      };

      db = new AlphaBase({ filePath: testDbPath, schema });

      db.set('data:1', { user: { name: 'Alice', email: 'alice@example.com' } });
      const data = db.get<{ user: { name: string; email: string } }>('data:1');
      expect(data.user.name).toBe('Alice');
    });

    test('should validate arrays', () => {
      const schema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['tags']
      };

      db = new AlphaBase({ filePath: testDbPath, schema });

      db.set('post:1', { tags: ['javascript', 'typescript'] });
      const post = db.get<{ tags: string[] }>('post:1');
      expect(post.tags).toHaveLength(2);

      expect(() => {
        db.set('post:2', { tags: [1, 2, 3] }); // Wrong item type
      }).toThrow();
    });
  });

  describe('Key Validation', () => {
    beforeEach(() => {
      db = new AlphaBase({ filePath: testDbPath });
    });

    test('should accept valid keys', () => {
      db.set('valid-key', 'value');
      db.set('user:123', 'value');
      db.set('namespace:resource:id', 'value');
      
      expect(db.size()).toBe(3);
    });

    test('should reject non-string keys', () => {
      expect(() => {
        db.set(123 as any, 'value');
      }).toThrow();

      expect(() => {
        db.set(null as any, 'value');
      }).toThrow();

      expect(() => {
        db.set(undefined as any, 'value');
      }).toThrow();
    });
  });

  describe('Value Validation', () => {
    beforeEach(() => {
      db = new AlphaBase({ filePath: testDbPath });
    });

    test('should accept valid value types', () => {
      db.set('string', 'text');
      db.set('number', 42);
      db.set('boolean', true);
      db.set('null', null);
      db.set('array', [1, 2, 3]);
      db.set('object', { key: 'value' });
      
      expect(db.size()).toBe(6);
    });
  });
});
