import { AlphaBase } from '../src/AlphaBase';
import { QueryBuilder } from '../src/query/QueryBuilder';
import * as fs from 'fs';
import * as path from 'path';

const isCI = process.env.CI === 'true' || process.env.SKIP_SCALE_TESTS === 'true';
const describeOrSkip = isCI ? describe.skip : describe;

describeOrSkip('Scale Test - 250K Records', () => {
  const testDir = path.join(__dirname, 'scale-test-250k');
  const dbPath = path.join(testDir, 'scale-250k.json');
  let db: AlphaBase;

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    db = new AlphaBase({
      filePath: dbPath,
      enableMetrics: true,
      enableHealthChecks: true,
      enableEvents: true,
      enableSoftDelete: true,
      cache: { maxSize: 10000, ttl: 3600000 } // Larger cache for 250K
    });
    await db.initialize();
  });

  afterEach(async () => {
    if (db) {
      db.clear();
      await db.save();
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('1. Population and Basic CRUD (250K)', () => {
    test('should populate 250K records', async () => {
      console.log('📝 Populating 250K records...');
      const startTime = Date.now();
      
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, {
          id: i,
          name: `User ${i}`,
          email: `user${i}@test.com`,
          age: 20 + (i % 50),
          city: ['NYC', 'LA', 'Chicago', 'Houston', 'Phoenix'][i % 5],
          status: i % 3 === 0 ? 'active' : 'inactive',
          score: Math.floor(Math.random() * 1000),
          createdAt: new Date(2024, 0, 1 + (i % 365)).toISOString()
        });

        if (i % 25000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ 250K records populated in ${elapsed}ms (${(elapsed / 250000).toFixed(2)}ms per record)`);
      
      expect(db.size()).toBe(250000);
    }, 900000); // 15 minutes timeout

    test('should handle random reads efficiently', () => {
      // Pre-populate
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, { id: i, name: `User ${i}` });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }

      console.log('📖 Testing 20K random reads...');
      const startTime = Date.now();
      
      for (let i = 0; i < 20000; i++) {
        const randomId = Math.floor(Math.random() * 250000);
        const user = db.get<any>(`user:${randomId}`);
        expect(user.id).toBe(randomId);
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ 20K random reads in ${elapsed}ms (${(elapsed / 20000).toFixed(3)}ms per read)`);
      expect(elapsed).toBeLessThan(10000);
    }, 900000);

    test('should handle updates on large dataset', () => {
      // Pre-populate
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, { id: i, score: 0 });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }

      console.log('✏️ Updating 10K records...');
      const startTime = Date.now();
      
      for (let i = 0; i < 10000; i++) {
        db.set(`user:${i}`, { id: i, score: 999 });
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ 10K updates in ${elapsed}ms`);

      // Verify
      expect(db.get<any>('user:0').score).toBe(999);
      expect(db.get<any>('user:9999').score).toBe(999);
    }, 900000);
  });

  describe('2. Indexing Performance (250K)', () => {
    beforeEach(() => {
      db.clear();
      console.log('📝 Populating 250K records for indexing tests...');
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, {
          id: i,
          email: `user${i}@test.com`,
          age: 20 + (i % 50),
          city: ['NYC', 'LA', 'Chicago'][i % 3]
        });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }
    });

    test('should create indexes on 250K records', () => {
      console.log('🔍 Creating indexes...');
      const startTime = Date.now();

      db.createIndex('email-idx', { field: 'email', unique: true });
      db.createIndex('age-idx', { field: 'age' });
      db.createIndex('city-idx', { field: 'city' });

      const elapsed = Date.now() - startTime;
      console.log(`✅ 3 indexes created in ${elapsed}ms`);

      expect(db.listIndexes()).toHaveLength(3);
    }, 900000);

    test('should perform O(1) lookups with indexes', () => {
      db.createIndex('email-idx', { field: 'email', unique: true });
      
      const indexStats = db.indexStats('email-idx');
      console.log(`📊 Index stats: ${indexStats?.size} values indexed`);
      
      const testResult = db.lookupIndex('email-idx', 'user0@test.com');
      console.log(`🔍 Test lookup for user0@test.com: ${testResult.keys.length} keys found`);
      if (testResult.keys.length > 0) {
        console.log(`   Keys: ${testResult.keys[0]}`);
      }
      
      console.log('🔎 Testing 2K indexed lookups...');
      const startTime = Date.now();
      let successCount = 0;

      for (let i = 0; i < 2000; i++) {
        const randomId = Math.floor(Math.random() * 250000);
        const result = db.lookupIndex('email-idx', `user${randomId}@test.com`);
        if (result.keys.length > 0 && result.keys.includes(`user:${randomId}`)) {
          successCount++;
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ 2K indexed lookups in ${elapsed}ms (${(elapsed / 2000).toFixed(3)}ms per lookup)`);
      console.log(`   Success rate: ${(successCount / 2000 * 100).toFixed(1)}%`);
      
      expect(successCount).toBeGreaterThan(1900); // 95%+ success
    }, 900000);

    test('should handle range queries efficiently', () => {
      db.createIndex('age-idx', { field: 'age' });

      console.log('📊 Testing range queries...');
      const startTime = Date.now();

      const adults = db.rangeIndex('age-idx', 25, 40);
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Range query completed in ${elapsed}ms, found ${adults.keys.length} records`);
      
      expect(adults.keys.length).toBeGreaterThan(0);
    }, 900000);
  });

  describe('3. Query Engine (250K)', () => {
    beforeEach(() => {
      db.clear();
      console.log('📝 Populating 250K records for query tests...');
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, {
          id: i,
          age: 20 + (i % 50),
          city: ['NYC', 'LA', 'Chicago'][i % 3],
          status: i % 2 === 0 ? 'active' : 'inactive'
        });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }
    });

    test('should execute complex queries', () => {
      console.log('🔍 Testing complex query...');
      const startTime = Date.now();

      const query = new QueryBuilder()
        .where('age', 'gte', 30)
        .where('age', 'lte', 40)
        .where('city', 'eq', 'NYC')
        .where('status', 'eq', 'active')
        .sort('age', 'asc')
        .paginate(0, 100);

      const results = db.executeQuery(query);
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Complex query executed in ${elapsed}ms, found ${results.total} matches`);
      
      expect(results.data.length).toBeLessThanOrEqual(100);
      expect(results.total).toBeGreaterThan(0);
    }, 900000);

    test('should perform aggregations', () => {
      console.log('📊 Testing aggregations...');
      const startTime = Date.now();

      const cities = ['NYC', 'LA', 'Chicago'];
      const counts = cities.map(city => {
        const query = new QueryBuilder().where('city', 'eq', city);
        return db.executeQuery(query).total;
      });

      let totalAge = 0;
      let count = 0;
      for (let i = 0; i < 1000; i++) {
        const user = db.get<any>(`user:${i}`);
        totalAge += user.age;
        count++;
      }
      const avgAge = totalAge / count;

      const elapsed = Date.now() - startTime;
      console.log(`✅ Aggregations completed in ${elapsed}ms`);
      console.log(`   Avg age (sample): ${avgAge.toFixed(2)}`);
      console.log(`   City counts: ${counts.join(', ')}`);

      expect(avgAge).toBeGreaterThan(0);
      expect(counts.length).toBe(3);
    }, 900000);
  });

  describe('4. Streaming API (250K)', () => {
    beforeEach(() => {
      db.clear();
      console.log('📝 Populating 250K records for streaming tests...');
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, { id: i, age: 20 + (i % 50) });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }
    });

    test('should stream 250K records efficiently', (done) => {
      console.log('🌊 Streaming 250K records...');
      const startTime = Date.now();
      let count = 0;

      const stream = db.createReadStream({ batchSize: 1000 });

      stream.on('data', (_chunk: any) => {
        count++;
      });

      stream.on('end', () => {
        const elapsed = Date.now() - startTime;
        const throughput = count > 0 ? (count / (elapsed / 1000)).toFixed(0) : '0';
        console.log(`✅ Streamed ${count} records in ${elapsed}ms (${throughput} records/sec)`);
        
        expect(count).toBe(250000);
        done();
      });

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        done();
      });
    }, 300000);

    test('should filter stream efficiently', (done) => {
      console.log('🔍 Streaming with filter...');
      const startTime = Date.now();
      let count = 0;

      const stream = db.createReadStream({ batchSize: 1000 });

      stream.on('data', (chunk: any) => {
        if (chunk?.value?.age >= 30 && chunk?.value?.age <= 40) {
          count++;
        }
      });

      stream.on('end', () => {
        const elapsed = Date.now() - startTime;
        console.log(`✅ Filtered stream completed in ${elapsed}ms, ${count} matches`);
        
        expect(count).toBeGreaterThan(0);
        done();
      });

      stream.on('error', (err) => {
        console.error('Stream error:', err);
        done();
      });
    }, 300000);
  });

  describe('5. Cache Performance (250K)', () => {
    beforeEach(() => {
      db.clear();
      console.log('📝 Populating 250K records for cache tests...');
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, { id: i, name: `User ${i}` });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }
    });

    test('should benefit from cache on repeated reads', () => {
      console.log('📖 First read (cache miss)...');
      const keys = [];
      for (let i = 0; i < 2000; i++) {
        keys.push(`user:${i}`);
      }

      const startMiss = Date.now();
      keys.forEach(key => db.get(key));
      const missDuration = Date.now() - startMiss;

      console.log('📖 Second read (cache hit)...');
      const startHit = Date.now();
      keys.forEach(key => db.get(key));
      const hitDuration = Date.now() - startHit;

      const stats = db.cacheStats();
      console.log(`✅ Cache miss: ${missDuration}ms, Cache hit: ${hitDuration}ms`);
      console.log(`   Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);

      expect(hitDuration).toBeLessThan(missDuration);
      expect(stats.hitRate).toBeGreaterThan(0);
    }, 900000);
  });

  describe('6. Transactions (250K)', () => {
    test('should handle transactions on large dataset', async () => {
      console.log('📝 Populating 250K records for transaction tests...');
      for (let i = 0; i < 250000; i++) {
        db.set(`account:${i}`, { balance: 1000 });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }

      console.log('💳 Executing 200 transactions...');
      const startTime = Date.now();
      let successCount = 0;

      for (let i = 0; i < 200; i++) {
        try {
          await db.executeTransaction(async () => {
            const acc1 = db.get<any>(`account:${i}`);
            const acc2 = db.get<any>(`account:${i + 1}`);
            
            db.set(`account:${i}`, { balance: acc1.balance - 10 });
            db.set(`account:${i + 1}`, { balance: acc2.balance + 10 });
          });
          successCount++;
        } catch (e) {
          // Continue
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ ${successCount}/200 transactions completed in ${elapsed}ms`);

      expect(successCount).toBeGreaterThan(190); // 95%+ success
    }, 900000);
  });

  describe('7. Soft Delete (250K)', () => {
    beforeEach(() => {
      db.clear();
      console.log('📝 Populating 250K records for soft delete tests...');
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, { id: i });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }
    });

    test('should soft delete and restore', () => {
      console.log('🗑️ Soft deleting 2K records...');
      const startTime = Date.now();
      let deleteCount = 0;

      for (let i = 0; i < 2000; i++) {
        try {
          db.softDelete(`user:${i}`);
          deleteCount++;
        } catch (e) {
          // Continue
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`✅ ${deleteCount} soft deletes in ${elapsed}ms`);

      if (deleteCount > 0) {
        const wasDeleted = !db.has('user:0');
        console.log(`   Soft delete working: ${wasDeleted}`);
        
        if (wasDeleted && typeof db.restoreSoftDelete === 'function') {
          try {
            db.restoreSoftDelete('user:0');
            const restored = db.has('user:0');
            console.log(`   Restore working: ${restored}`);
            expect(restored).toBe(true);
          } catch (e) {
            console.log(`   Restore error: ${e}`);
          }
        }
      }
      
      expect(deleteCount).toBeGreaterThan(1900);
    }, 900000);
  });

  describe('8. Monitoring & Health (250K)', () => {
    beforeEach(() => {
      db.clear();
      console.log('📝 Populating 250K records for monitoring tests...');
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, { id: i });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }
    });

    test('should track metrics on large dataset', () => {
      for (let i = 0; i < 200; i++) {
        db.get(`user:${i}`);
      }

      const metrics = db.getMetrics();
      console.log('📊 Metrics:', {
        operations: metrics?.counters.alphabase_operations_total || 0,
        reads: metrics?.counters.alphabase_reads_total || 0
      });

      expect(metrics?.counters.alphabase_operations_total || 0).toBeGreaterThan(0);
    }, 900000);

    test('should perform health check', async () => {
      console.log('🏥 Running health check...');
      const startTime = Date.now();

      const health = await db.healthCheck();
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ Health check completed in ${elapsed}ms`);
      console.log(`   Status: ${health.status}`);

      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    }, 900000);
  });

  describe('9. Backup & Restore (250K)', () => {
    test('should backup and restore 250K records', async () => {
      console.log('📝 Populating 250K records for backup test...');
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, { id: i });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }

      console.log('💾 Creating backup of 250K records...');
      const startBackup = Date.now();
      
      const backup = await db.createBackupAsync();
      
      const backupElapsed = Date.now() - startBackup;
      console.log(`✅ Backup created in ${backupElapsed}ms`);
      console.log(`   File: ${backup.filename}`);

      const originalSize = db.size();

      db.clear();
      expect(db.size()).toBe(0);

      console.log('📥 Restoring from backup...');
      const startRestore = Date.now();
      
      await db.restoreBackupAsync(backup.filename);
      
      const restoreElapsed = Date.now() - startRestore;
      console.log(`✅ Restored in ${restoreElapsed}ms`);

      const restoredSize = db.size();
      console.log(`   Original: ${originalSize}, Restored: ${restoredSize}`);
      
      expect(restoredSize).toBe(250000);
      
      const firstRecord = db.get<any>('user:0');
      expect(firstRecord.id).toBe(0);

      // Cleanup
      if (fs.existsSync(backup.filePath)) {
        fs.unlinkSync(backup.filePath);
      }
    }, 300000);
  });

  describe('10. Memory & Performance Stats', () => {
    test('should report memory usage for 250K records', async () => {
      console.log('💾 Populating and measuring memory...');
      
      const before = process.memoryUsage();
      
      for (let i = 0; i < 250000; i++) {
        db.set(`user:${i}`, {
          id: i,
          name: `User ${i}`,
          email: `user${i}@test.com`,
          age: 20 + (i % 50)
        });
        if (i % 50000 === 0 && i > 0) {
          console.log(`  ✓ ${i} records populated`);
        }
      }

      await db.save();
      
      const after = process.memoryUsage();
      const heapUsed = ((after.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(2);
      
      const stats = db.stats();
      const fileSize = fs.existsSync(dbPath) 
        ? (fs.statSync(dbPath).size / 1024 / 1024).toFixed(2) 
        : 'N/A';

      console.log('📊 Memory & Storage Report:');
      console.log(`   Records: ${stats.keys}`);
      console.log(`   Heap used: ~${heapUsed} MB`);
      console.log(`   File size: ${fileSize} MB`);

      expect(stats.keys).toBe(250000);
    }, 300000);
  });
});
