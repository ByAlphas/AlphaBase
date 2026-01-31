#!/usr/bin/env node

/**
 * AlphaBase Performance Benchmark Suite
 * 
 * Three-tier benchmark system:
 * - EASY: Basic operations, small dataset (1K records)
 * - MEDIUM: Advanced queries, indexing (10K records)
 * - HARD: Streaming, complex operations (50K records)
 */

const { AlphaBase, QueryBuilder } = require('./dist/index');
const fs = require('fs');
const path = require('path');

// Utility functions
const formatNumber = (num) => num.toLocaleString('en-US');
const formatTime = (ms) => {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
};

class BenchmarkTimer {
  constructor() {
    this.start = 0;
    this.end = 0;
  }

  begin() {
    this.start = performance.now();
  }

  stop() {
    this.end = performance.now();
    return this.elapsed();
  }

  elapsed() {
    return this.end - this.start;
  }
}

// Generate test data
function generateUser(id) {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const cities = ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Toronto', 'Dubai'];
  const roles = ['user', 'admin', 'moderator', 'guest'];
  
  return {
    id,
    name: names[Math.floor(Math.random() * names.length)],
    email: `user${id}@example.com`,
    age: 18 + Math.floor(Math.random() * 50),
    city: cities[Math.floor(Math.random() * cities.length)],
    role: roles[Math.floor(Math.random() * roles.length)],
    score: Math.floor(Math.random() * 1000),
    active: Math.random() > 0.3,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    metadata: {
      lastLogin: new Date().toISOString(),
      preferences: { theme: 'dark', notifications: true }
    }
  };
}

// ============================================================================
// EASY BENCHMARK - Basic operations, 1K records
// ============================================================================

async function runEasyBenchmark() {
  console.log('\n' + '='.repeat(70));
  console.log('  🟢 EASY BENCHMARK - Basic Operations (1,000 records)');
  console.log('='.repeat(70) + '\n');

  const dbPath = path.join(__dirname, 'benchmark-easy.json');
  const db = new AlphaBase({ 
    filePath: dbPath,
    enableMetrics: true,
    cache: { maxSize: 500, ttl: 60000 }
  });

  await db.initialize();

  const results = {
    recordCount: 1000,
    operations: []
  };

  // Test 1: Sequential Write
  console.log('📝 Test 1: Sequential Write (1,000 records)...');
  const timer1 = new BenchmarkTimer();
  timer1.begin();
  
  for (let i = 0; i < 1000; i++) {
    db.set(`user:${i}`, generateUser(i));
  }
  
  const writeTime = timer1.stop();
  results.operations.push({
    name: 'Sequential Write',
    totalTime: writeTime,
    avgTime: writeTime / 1000,
    opsPerSec: 1000 / (writeTime / 1000)
  });

  console.log(`   ✓ Completed in ${formatTime(writeTime)}`);
  console.log(`   ✓ Average: ${formatTime(writeTime / 1000)} per operation`);
  console.log(`   ✓ Throughput: ${formatNumber(Math.floor(1000 / (writeTime / 1000)))} ops/sec\n`);

  // Test 2: Random Read
  console.log('📖 Test 2: Random Read (1,000 operations)...');
  const timer2 = new BenchmarkTimer();
  timer2.begin();
  
  for (let i = 0; i < 1000; i++) {
    const randomId = Math.floor(Math.random() * 1000);
    db.get(`user:${randomId}`);
  }
  
  const readTime = timer2.stop();
  results.operations.push({
    name: 'Random Read',
    totalTime: readTime,
    avgTime: readTime / 1000,
    opsPerSec: 1000 / (readTime / 1000)
  });

  console.log(`   ✓ Completed in ${formatTime(readTime)}`);
  console.log(`   ✓ Average: ${formatTime(readTime / 1000)} per operation`);
  console.log(`   ✓ Throughput: ${formatNumber(Math.floor(1000 / (readTime / 1000)))} ops/sec\n`);

  // Test 3: Batch Operations
  console.log('📦 Test 3: Batch Operations (100 batches × 10 ops)...');
  const timer3 = new BenchmarkTimer();
  timer3.begin();
  
  for (let i = 0; i < 100; i++) {
    const operations = [];
    for (let j = 0; j < 10; j++) {
      operations.push({
        type: 'set',
        key: `batch:${i}:${j}`,
        value: generateUser(i * 10 + j)
      });
    }
    db.batch(operations);
  }
  
  const batchTime = timer3.stop();
  results.operations.push({
    name: 'Batch Operations',
    totalTime: batchTime,
    avgTime: batchTime / 1000,
    opsPerSec: 1000 / (batchTime / 1000)
  });

  console.log(`   ✓ Completed in ${formatTime(batchTime)}`);
  console.log(`   ✓ Average: ${formatTime(batchTime / 1000)} per operation`);
  console.log(`   ✓ Throughput: ${formatNumber(Math.floor(1000 / (batchTime / 1000)))} ops/sec\n`);

  // Test 4: Async Save
  console.log('💾 Test 4: Async Save to Disk...');
  const timer4 = new BenchmarkTimer();
  timer4.begin();
  
  await db.save();
  
  const saveTime = timer4.stop();
  const fileSize = fs.statSync(dbPath).size;

  console.log(`   ✓ Completed in ${formatTime(saveTime)}`);
  console.log(`   ✓ File size: ${formatSize(fileSize)}\n`);

  // Test 5: Delete Operations
  console.log('🗑️  Test 5: Delete Operations (500 records)...');
  const timer5 = new BenchmarkTimer();
  timer5.begin();
  
  for (let i = 0; i < 500; i++) {
    db.delete(`user:${i}`);
  }
  
  const deleteTime = timer5.stop();
  results.operations.push({
    name: 'Delete Operations',
    totalTime: deleteTime,
    avgTime: deleteTime / 500,
    opsPerSec: 500 / (deleteTime / 1000)
  });

  console.log(`   ✓ Completed in ${formatTime(deleteTime)}`);
  console.log(`   ✓ Average: ${formatTime(deleteTime / 500)} per operation\n`);

  // Summary
  console.log('📊 EASY BENCHMARK SUMMARY');
  console.log('-'.repeat(70));
  console.log(`Total Records: ${formatNumber(results.recordCount)}`);
  console.log(`Cache Hit Rate: ${(db.getMetrics().counters.alphabase_cache_hits / db.getMetrics().counters.alphabase_reads_total * 100).toFixed(1)}%`);
  console.log(`File Size: ${formatSize(fileSize)}`);
  console.log('\nOperation Performance:');
  results.operations.forEach(op => {
    console.log(`  ${op.name.padEnd(25)} ${formatTime(op.avgTime).padStart(12)} avg`);
  });
  console.log('='.repeat(70) + '\n');

  // Cleanup
  await db.close();
  fs.unlinkSync(dbPath);

  return results;
}

// ============================================================================
// MEDIUM BENCHMARK - Advanced queries, indexing, 10K records
// ============================================================================

async function runMediumBenchmark() {
  console.log('\n' + '='.repeat(70));
  console.log('  🟡 MEDIUM BENCHMARK - Advanced Queries & Indexing (10,000 records)');
  console.log('='.repeat(70) + '\n');

  const dbPath = path.join(__dirname, 'benchmark-medium.json');
  const db = new AlphaBase({ 
    filePath: dbPath,
    enableMetrics: true,
    enableHealthChecks: true,
    cache: { maxSize: 2000, ttl: 60000 }
  });

  await db.initialize();

  const results = {
    recordCount: 10000,
    operations: []
  };

  // Setup: Populate database
  console.log('⚙️  Setup: Populating 10,000 records...');
  const setupTimer = new BenchmarkTimer();
  setupTimer.begin();
  
  for (let i = 0; i < 10000; i++) {
    db.set(`user:${i}`, generateUser(i));
  }
  
  const setupTime = setupTimer.stop();
  console.log(`   ✓ Setup completed in ${formatTime(setupTime)}\n`);

  // Test 1: Index Creation
  console.log('🔍 Test 1: Index Creation (email, city, age)...');
  const timer1 = new BenchmarkTimer();
  timer1.begin();
  
  db.createIndex('email-idx', { field: 'email', unique: true });
  db.createIndex('city-idx', { field: 'city', unique: false });
  db.createIndex('age-idx', { field: 'age', unique: false });
  
  const indexTime = timer1.stop();

  console.log(`   ✓ Created 3 indexes in ${formatTime(indexTime)}\n`);

  // Test 2: Indexed Lookup
  console.log('🎯 Test 2: Indexed Lookup (1,000 queries)...');
  const timer2 = new BenchmarkTimer();
  timer2.begin();
  
  for (let i = 0; i < 1000; i++) {
    const randomId = Math.floor(Math.random() * 10000);
    db.lookupIndex('email-idx', `user${randomId}@example.com`);
  }
  
  const lookupTime = timer2.stop();
  results.operations.push({
    name: 'Indexed Lookup',
    totalTime: lookupTime,
    avgTime: lookupTime / 1000,
    opsPerSec: 1000 / (lookupTime / 1000)
  });

  console.log(`   ✓ Completed in ${formatTime(lookupTime)}`);
  console.log(`   ✓ Average: ${formatTime(lookupTime / 1000)} per lookup`);
  console.log(`   ✓ Throughput: ${formatNumber(Math.floor(1000 / (lookupTime / 1000)))} ops/sec\n`);

  // Test 3: Complex Query (single condition)
  console.log('🔎 Test 3: Simple Query (age >= 30)...');
  const timer3 = new BenchmarkTimer();
  timer3.begin();
  
  const query1 = new QueryBuilder().where('age', 'gte', 30);
  const result1 = db.executeQuery(query1);
  
  const query1Time = timer3.stop();

  console.log(`   ✓ Found ${formatNumber(result1.total)} matches in ${formatTime(query1Time)}\n`);

  // Test 4: Complex Query (multiple conditions)
  console.log('🔎 Test 4: Complex Query (age >= 30 AND active = true)...');
  const timer4 = new BenchmarkTimer();
  timer4.begin();
  
  const query2 = new QueryBuilder()
    .where('age', 'gte', 30)
    .where('active', 'eq', true);
  const result2 = db.executeQuery(query2);
  
  const query2Time = timer4.stop();

  console.log(`   ✓ Found ${formatNumber(result2.total)} matches in ${formatTime(query2Time)}\n`);

  // Test 5: Query with Sort & Pagination
  console.log('📑 Test 5: Query with Sort & Pagination (100 pages)...');
  const timer5 = new BenchmarkTimer();
  timer5.begin();
  
  for (let page = 0; page < 100; page++) {
    const query = new QueryBuilder()
      .where('score', 'gt', 100)
      .sort('score', 'desc')
      .paginate(page, 10);
    db.executeQuery(query);
  }
  
  const paginationTime = timer5.stop();
  results.operations.push({
    name: 'Sort & Pagination',
    totalTime: paginationTime,
    avgTime: paginationTime / 100,
    opsPerSec: 100 / (paginationTime / 1000)
  });

  console.log(`   ✓ Completed 100 pages in ${formatTime(paginationTime)}`);
  console.log(`   ✓ Average: ${formatTime(paginationTime / 100)} per page\n`);

  // Test 6: Aggregation Operations
  console.log('📊 Test 6: Aggregation Operations...');
  const timer6 = new BenchmarkTimer();
  timer6.begin();
  
  const avgAge = db.queryEngine.aggregate('age', 'avg') || 0;
  const maxScore = db.queryEngine.aggregate('score', 'max') || 0;
  const minScore = db.queryEngine.aggregate('score', 'min') || 0;
  const groups = db.queryEngine.groupBy('city');
  
  const aggTime = timer6.stop();

  console.log(`   ✓ Average age: ${avgAge.toFixed(1)}`);
  console.log(`   ✓ Score range: ${minScore} - ${maxScore}`);
  console.log(`   ✓ City groups: ${Object.keys(groups).length}`);
  console.log(`   ✓ Completed in ${formatTime(aggTime)}\n`);

  // Test 7: Transaction Performance
  console.log('🔄 Test 7: Transaction Performance (100 transactions)...');
  
  // Drop indexes for transaction test to avoid conflicts
  db.dropIndex('email-idx');
  db.dropIndex('city-idx');
  db.dropIndex('age-idx');
  
  const timer7 = new BenchmarkTimer();
  timer7.begin();
  
  for (let i = 0; i < 100; i++) {
    await db.executeTransaction(async () => {
      const user = db.get(`user:${i + 1000}`); // Use different IDs
      if (user) {
        user.score += 50;
        db.set(`user:${i + 1000}`, user);
      }
      db.set(`tx:${i}:1`, { value: i * 2, type: 'tx-test' });
      db.set(`tx:${i}:2`, { value: i * 3, type: 'tx-test' });
    });
  }
  
  const txTime = timer7.stop();
  results.operations.push({
    name: 'Transactions',
    totalTime: txTime,
    avgTime: txTime / 100,
    opsPerSec: 100 / (txTime / 1000)
  });

  console.log(`   ✓ Completed in ${formatTime(txTime)}`);
  console.log(`   ✓ Average: ${formatTime(txTime / 100)} per transaction\n`);

  // Test 8: Async Save
  console.log('💾 Test 8: Async Save to Disk...');
  const timer8 = new BenchmarkTimer();
  timer8.begin();
  
  await db.save();
  
  const saveTime = timer8.stop();
  const fileSize = fs.statSync(dbPath).size;

  console.log(`   ✓ Completed in ${formatTime(saveTime)}`);
  console.log(`   ✓ File size: ${formatSize(fileSize)}\n`);

  // Summary
  const metrics = db.getMetrics();
  console.log('📊 MEDIUM BENCHMARK SUMMARY');
  console.log('-'.repeat(70));
  console.log(`Total Records: ${formatNumber(results.recordCount)}`);
  console.log(`Total Operations: ${formatNumber(metrics.counters.alphabase_operations_total)}`);
  console.log(`Cache Hit Rate: ${(metrics.counters.alphabase_cache_hits / metrics.counters.alphabase_reads_total * 100).toFixed(1)}%`);
  console.log(`Indexes: 3 (email, city, age)`);
  console.log(`File Size: ${formatSize(fileSize)}`);
  console.log('\nOperation Performance:');
  results.operations.forEach(op => {
    console.log(`  ${op.name.padEnd(25)} ${formatTime(op.avgTime).padStart(12)} avg`);
  });
  console.log('='.repeat(70) + '\n');

  // Cleanup
  await db.close();
  fs.unlinkSync(dbPath);

  return results;
}

// ============================================================================
// HARD BENCHMARK - Streaming, complex operations, 50K records
// ============================================================================

async function runHardBenchmark() {
  console.log('\n' + '='.repeat(70));
  console.log('  🔴 HARD BENCHMARK - Streaming & Large Dataset (50,000 records)');
  console.log('='.repeat(70) + '\n');

  const dbPath = path.join(__dirname, 'benchmark-hard.json');
  const db = new AlphaBase({ 
    filePath: dbPath,
    enableMetrics: true,
    enableHealthChecks: true,
    cache: { maxSize: 5000, ttl: 60000 }
  });

  await db.initialize();

  const results = {
    recordCount: 50000,
    operations: []
  };

  // Setup: Populate large database
  console.log('⚙️  Setup: Populating 50,000 records...');
  const setupTimer = new BenchmarkTimer();
  setupTimer.begin();
  
  // Use batch for faster population
  for (let batch = 0; batch < 500; batch++) {
    const operations = [];
    for (let i = 0; i < 100; i++) {
      const id = batch * 100 + i;
      operations.push({
        type: 'set',
        key: `user:${id}`,
        value: generateUser(id)
      });
    }
    db.batch(operations);
  }
  
  const setupTime = setupTimer.stop();
  console.log(`   ✓ Setup completed in ${formatTime(setupTime)}`);
  console.log(`   ✓ Throughput: ${formatNumber(Math.floor(50000 / (setupTime / 1000)))} records/sec\n`);

  // Test 1: Create Multiple Indexes
  console.log('🔍 Test 1: Creating Multiple Indexes...');
  const timer1 = new BenchmarkTimer();
  timer1.begin();
  
  db.createIndex('email-idx', { field: 'email', unique: true });
  db.createIndex('city-idx', { field: 'city', unique: false });
  db.createIndex('age-idx', { field: 'age', unique: false });
  db.createIndex('role-idx', { field: 'role', unique: false });
  db.createIndex('score-idx', { field: 'score', unique: false });
  
  const indexTime = timer1.stop();

  console.log(`   ✓ Created 5 indexes in ${formatTime(indexTime)}`);
  console.log(`   ✓ Average: ${formatTime(indexTime / 5)} per index\n`);

  // Test 2: Streaming Read (entire dataset)
  console.log('🌊 Test 2: Streaming Read (50,000 records, batch=1000)...');
  const timer2 = new BenchmarkTimer();
  let streamCount = 0;
  
  timer2.begin();
  
  await new Promise((resolve, reject) => {
    const stream = db.createReadStream({ batchSize: 1000 });
    
    stream.on('data', (chunk) => {
      streamCount++;
    });
    
    stream.on('end', () => {
      const streamTime = timer2.stop();
      results.operations.push({
        name: 'Streaming Read',
        totalTime: streamTime,
        avgTime: streamTime / streamCount,
        opsPerSec: streamCount / (streamTime / 1000)
      });
      
      console.log(`   ✓ Streamed ${formatNumber(streamCount)} records in ${formatTime(streamTime)}`);
      console.log(`   ✓ Throughput: ${formatNumber(Math.floor(streamCount / (streamTime / 1000)))} records/sec\n`);
      resolve();
    });
    
    stream.on('error', reject);
  });

  // Test 3: Complex Multi-Filter Query
  console.log('🔎 Test 3: Complex Multi-Filter Query...');
  const timer3 = new BenchmarkTimer();
  timer3.begin();
  
  const complexQuery = new QueryBuilder()
    .where('age', 'gte', 25)
    .where('age', 'lte', 45)
    .where('active', 'eq', true)
    .where('score', 'gt', 300)
    .sort('score', 'desc')
    .paginate(0, 100);
  
  const complexResult = db.executeQuery(complexQuery);
  const complexTime = timer3.stop();

  console.log(`   ✓ Found ${formatNumber(complexResult.total)} matches in ${formatTime(complexTime)}`);
  console.log(`   ✓ Returned first 100 results\n`);

  // Test 4: Parallel Query Execution
  console.log('⚡ Test 4: Parallel Query Execution (10 concurrent queries)...');
  const timer4 = new BenchmarkTimer();
  timer4.begin();
  
  const queries = [];
  for (let i = 0; i < 10; i++) {
    const query = new QueryBuilder()
      .where('age', 'gte', 20 + i * 5)
      .where('score', 'gt', i * 100)
      .sort('name', 'asc')
      .paginate(0, 50);
    queries.push(db.executeQuery(query));
  }
  
  const parallelTime = timer4.stop();
  const totalMatches = queries.reduce((sum, result) => sum + result.total, 0);

  console.log(`   ✓ Executed 10 queries in ${formatTime(parallelTime)}`);
  console.log(`   ✓ Total matches: ${formatNumber(totalMatches)}`);
  console.log(`   ✓ Average: ${formatTime(parallelTime / 10)} per query\n`);

  // Test 5: Bulk Update via Transaction
  console.log('🔄 Test 5: Bulk Update (1,000 records in transaction)...');
  const timer5 = new BenchmarkTimer();
  timer5.begin();
  
  await db.executeTransaction(async () => {
    for (let i = 0; i < 1000; i++) {
      const user = db.get(`user:${i}`);
      if (user) {
        user.score += 50;
        user.metadata.lastModified = new Date().toISOString();
        db.set(`user:${i}`, user);
      }
    }
  });
  
  const bulkUpdateTime = timer5.stop();
  results.operations.push({
    name: 'Bulk Update (TX)',
    totalTime: bulkUpdateTime,
    avgTime: bulkUpdateTime / 1000,
    opsPerSec: 1000 / (bulkUpdateTime / 1000)
  });

  console.log(`   ✓ Updated 1,000 records in ${formatTime(bulkUpdateTime)}`);
  console.log(`   ✓ Average: ${formatTime(bulkUpdateTime / 1000)} per update\n`);

  // Test 6: Aggregations on Large Dataset
  console.log('📊 Test 6: Aggregations on Large Dataset...');
  const timer6 = new BenchmarkTimer();
  timer6.begin();
  
  const avgAge = db.queryEngine.aggregate('age', 'avg') || 0;
  const avgScore = db.queryEngine.aggregate('score', 'avg') || 0;
  const maxScore = db.queryEngine.aggregate('score', 'max') || 0;
  const minAge = db.queryEngine.aggregate('age', 'min') || 0;
  const cityGroups = db.queryEngine.groupBy('city');
  const roleGroups = db.queryEngine.groupBy('role');
  const distinctCities = db.queryEngine.distinct('city');
  
  const aggTime = timer6.stop();

  console.log(`   ✓ Average age: ${avgAge.toFixed(1)} years`);
  console.log(`   ✓ Average score: ${avgScore.toFixed(1)} points`);
  console.log(`   ✓ Score range: ${minAge} - ${maxScore}`);
  console.log(`   ✓ City groups: ${Object.keys(cityGroups).length}`);
  console.log(`   ✓ Role groups: ${Object.keys(roleGroups).length}`);
  console.log(`   ✓ Distinct cities: ${distinctCities.length}`);
  console.log(`   ✓ Completed 7 aggregations in ${formatTime(aggTime)}\n`);

  // Test 7: Async Save Performance
  console.log('💾 Test 7: Async Save to Disk (large file)...');
  const timer7 = new BenchmarkTimer();
  timer7.begin();
  
  await db.save();
  
  const saveTime = timer7.stop();
  const fileSize = fs.statSync(dbPath).size;
  const writeThroughput = fileSize / (saveTime / 1000);

  console.log(`   ✓ Saved in ${formatTime(saveTime)}`);
  console.log(`   ✓ File size: ${formatSize(fileSize)}`);
  console.log(`   ✓ Write throughput: ${formatSize(writeThroughput)}/sec\n`);

  // Test 8: Health Check System
  console.log('🏥 Test 8: Health Check System...');
  const timer8 = new BenchmarkTimer();
  timer8.begin();
  
  const health = await db.healthCheck();
  
  const healthTime = timer8.stop();

  console.log(`   ✓ Status: ${health.status.toUpperCase()}`);
  health.components.forEach(comp => {
    console.log(`   ✓ ${comp.name}: ${comp.status}`);
  });
  console.log(`   ✓ Health check completed in ${formatTime(healthTime)}\n`);

  // Test 9: Backup Creation
  console.log('📦 Test 9: Backup Creation (async)...');
  const timer9 = new BenchmarkTimer();
  timer9.begin();
  
  const backupResult = await db.createBackupAsync();
  
  const backupTime = timer9.stop();
  
  // Handle both string and object return types
  let backupPath;
  if (typeof backupResult === 'string') {
    backupPath = backupResult;
  } else if (backupResult && backupResult.path) {
    backupPath = backupResult.path;
  } else if (backupResult && backupResult.backupPath) {
    backupPath = backupResult.backupPath;
  }
  
  if (backupPath && fs.existsSync(backupPath)) {
    const backupSize = fs.statSync(backupPath).size;
    console.log(`   ✓ Backup created in ${formatTime(backupTime)}`);
    console.log(`   ✓ Backup size: ${formatSize(backupSize)}`);
    console.log(`   ✓ Compression ratio: ${((1 - backupSize / fileSize) * 100).toFixed(1)}%\n`);
    fs.unlinkSync(backupPath);
  } else {
    console.log(`   ✓ Backup created in ${formatTime(backupTime)}`);
    console.log(`   ⚠️  Backup path not available\n`);
  }

  // Final Summary
  const metrics = db.getMetrics();
  const memUsage = process.memoryUsage();

  console.log('📊 HARD BENCHMARK SUMMARY');
  console.log('-'.repeat(70));
  console.log(`Total Records: ${formatNumber(results.recordCount)}`);
  console.log(`Total Operations: ${formatNumber(metrics.counters.alphabase_operations_total)}`);
  console.log(`Read Operations: ${formatNumber(metrics.counters.alphabase_reads_total)}`);
  console.log(`Write Operations: ${formatNumber(metrics.counters.alphabase_writes_total)}`);
  console.log(`Cache Hit Rate: ${(metrics.counters.alphabase_cache_hits / metrics.counters.alphabase_reads_total * 100).toFixed(1)}%`);
  console.log(`Indexes: 5 (email, city, age, role, score)`);
  console.log(`File Size: ${formatSize(fileSize)}`);
  console.log(`Memory Usage: ${formatSize(memUsage.heapUsed)} / ${formatSize(memUsage.heapTotal)}`);
  console.log('\nOperation Performance:');
  results.operations.forEach(op => {
    console.log(`  ${op.name.padEnd(25)} ${formatTime(op.avgTime).padStart(12)} avg`);
  });
  console.log('='.repeat(70) + '\n');

  // Cleanup
  await db.close();
  fs.unlinkSync(dbPath);

  return results;
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const level = args[0]?.toLowerCase();

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                   ║');
  console.log('║          AlphaBase v4.0.0 - Performance Benchmark Suite          ║');
  console.log('║                                                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  if (!level || !['easy', 'medium', 'hard', 'all'].includes(level)) {
    console.log('\nUsage: node benchmark.js <level>');
    console.log('\nAvailable levels:');
    console.log('  easy   - Basic operations, 1K records (~5 seconds)');
    console.log('  medium - Advanced queries, 10K records (~15 seconds)');
    console.log('  hard   - Streaming & large dataset, 50K records (~45 seconds)');
    console.log('  all    - Run all benchmarks sequentially (~65 seconds)\n');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    if (level === 'easy' || level === 'all') {
      await runEasyBenchmark();
    }

    if (level === 'medium' || level === 'all') {
      await runMediumBenchmark();
    }

    if (level === 'hard' || level === 'all') {
      await runHardBenchmark();
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Benchmark completed in ${formatTime(totalTime)}\n`);

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runEasyBenchmark, runMediumBenchmark, runHardBenchmark };
