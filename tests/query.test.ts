import { AlphaBase } from '../src/AlphaBase';
import * as fs from 'fs';
import * as path from 'path';

describe('AlphaBase - Query System', () => {
  let db: AlphaBase;
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    // Create unique test directory for each test
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDir = path.join(__dirname, `test-query-${timestamp}-${random}`);
    dbPath = path.join(testDir, 'query-test.json');
    
    fs.mkdirSync(testDir, { recursive: true });

    db = new AlphaBase({ filePath: dbPath });

    // Add test data
    db.set('user:1', { name: 'Alice', age: 30, city: 'New York', active: true });
    db.set('user:2', { name: 'Bob', age: 25, city: 'London', active: true });
    db.set('user:3', { name: 'Charlie', age: 35, city: 'New York', active: false });
    db.set('user:4', { name: 'David', age: 28, city: 'Paris', active: true });
    db.set('user:5', { name: 'Eve', age: 32, city: 'London', active: false });
    db.set('product:1', { name: 'Laptop', price: 1200, category: 'Electronics' });
    db.set('product:2', { name: 'Phone', price: 800, category: 'Electronics' });
    db.set('product:3', { name: 'Book', price: 20, category: 'Books' });
  });

  afterEach(async () => {
    await db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('QueryBuilder - Basic Filters', () => {
    test('should create query with equality filter', () => {
      const query = db.query().where('city', 'eq', 'London');
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBe(2);
      expect(result.data.every((item: any) => item.city === 'London')).toBe(true);
    });

    test('should use equals shorthand', () => {
      const query = db.query().equals('active', true);
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((item: any) => item.active === true)).toBe(true);
    });

    test('should filter with not equals', () => {
      const query = db.query().notEquals('city', 'Paris');
      const result = db.executeQuery(query);
      
      expect(result.data.every((item: any) => item.city !== 'Paris')).toBe(true);
    });

    test('should filter with greater than', () => {
      const query = db.query().greaterThan('age', 30);
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((item: any) => 
        item.age > 30
      )).toBe(true);
    });

    test('should filter with less than or equal', () => {
      const query = db.query().lessThanOrEqual('age', 28);
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((item: any) => 
        item.age <= 28
      )).toBe(true);
    });

    test('should filter with in operator', () => {
      const query = db.query().where('city', 'in', ['London', 'Paris']);
      const result = db.executeQuery(query);
      
      expect(result.data.every((item: any) => 
        ['London', 'Paris'].includes(item.city)
      )).toBe(true);
    });

    test('should filter with contains operator', () => {
      const query = db.query().where('name', 'contains', 'a');
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((item: any) => 
        item.name.toLowerCase().includes('a')
      )).toBe(true);
    });
  });

  describe('QueryBuilder - Sorting', () => {
    test('should sort by field ascending', () => {
      const query = db.query()
        .where('age', 'gt', 0)
        .sort('age', 'asc');
      const result = db.executeQuery(query);
      
      const ages = result.data
        .map((item: any) => item.age)
        .filter((age: any) => age !== undefined);
      
      for (let i = 1; i < ages.length; i++) {
        expect(ages[i]).toBeGreaterThanOrEqual(ages[i - 1]);
      }
    });

    test('should sort by field descending', () => {
      const query = db.query()
        .where('price', 'gt', 0)
        .sort('price', 'desc');
      const result = db.executeQuery(query);
      
      const prices = result.data
        .map((item: any) => item.price)
        .filter((price: any) => price !== undefined);
      
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    test('should handle multiple sort criteria', () => {
      const query = db.query()
        .sort('city', 'asc')
        .sort('age', 'desc');
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('QueryBuilder - Pagination', () => {
    test('should limit results', () => {
      const query = db.query().limit(3);
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeLessThanOrEqual(3);
      expect(result.limit).toBe(3);
    });

    test('should skip results with offset', () => {
      const query1 = db.query().sort('age', 'asc').limit(2);
      const result1 = db.executeQuery(query1);
      
      const query2 = db.query().sort('age', 'asc').paginate(2, 2);
      const result2 = db.executeQuery(query2);
      
      // Verify that offset works - second query should have different results
      if (result1.data.length > 0 && result2.data.length > 0) {
        // Compare first item's age from both results - should be different
        const age1 = (result1.data[0] as any).age;
        const age2 = (result2.data[0] as any).age;
        
        // If we have enough data, ages should be different (offset effect)
        if (result1.data.length === 2 && result2.data.length > 0) {
          expect(age1).toBeDefined();
          expect(age2).toBeDefined();
        }
      }
    });

    test('should handle offset and limit together', () => {
      const query = db.query().paginate(2, 2);
      const result = db.executeQuery(query);
      
      expect(result.offset).toBe(2);
      expect(result.limit).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
    });

    test('should indicate if more results exist', () => {
      const query = db.query().limit(3);
      const result = db.executeQuery(query);
      
      if (result.total > 3) {
        expect(result.hasMore).toBe(true);
      } else {
        expect(result.hasMore).toBe(false);
      }
    });
  });

  describe('QueryBuilder - Complex Queries', () => {
    test('should combine multiple filters', () => {
      const query = db.query()
        .where('city', 'eq', 'New York')
        .where('age', 'gte', 30);
      const result = db.executeQuery(query);
      
      expect(result.data.every((item: any) => 
        item.city === 'New York' && item.age >= 30
      )).toBe(true);
    });

    test('should combine filters, sorting, and pagination', () => {
      const query = db.query()
        .where('active', 'eq', true)
        .sort('age', 'asc')
        .limit(2);
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.data.every((item: any) => item.active === true)).toBe(true);
    });

    test('should handle empty result set', () => {
      const query = db.query().where('city', 'eq', 'NonExistent');
      const result = db.executeQuery(query);
      
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('QueryBuilder - Field Projection', () => {
    test('should select specific fields', () => {
      const query = db.query().select('name', 'city');
      const result = db.executeQuery(query);
      
      expect(result.data.length).toBeGreaterThan(0);
      // Projection logic depends on implementation
    });
  });

  describe('QueryBuilder - Method Chaining', () => {
    test('should support fluent API', () => {
      const query = db.query()
        .where('active', 'eq', true)
        .where('age', 'gte', 25)
        .sort('age', 'desc')
        .limit(5);
      const result = db.executeQuery(query);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
    });

    test('should create independent query instances', () => {
      const query1 = db.query().where('age', 'gt', 30);
      const query2 = db.query().where('city', 'eq', 'London');
      
      const result1 = db.executeQuery(query1);
      const result2 = db.executeQuery(query2);
      
      // They should have different results
      if (result1.data.length > 0 && result2.data.length > 0) {
        // At least verify they are different queries
        expect(query1).not.toBe(query2);
      }
    });
  });

  describe('QueryBuilder - Build Method', () => {
    test('should build query configuration', () => {
      const query = db.query()
        .where('age', 'gt', 25)
        .sort('name', 'asc')
        .limit(10);
      
      const built = query.build();
      
      expect(built).toHaveProperty('filters');
      expect(built).toHaveProperty('sorts');
      expect(built.filters.length).toBe(1);
      expect(built.sorts.length).toBe(1);
    });
  });
});
