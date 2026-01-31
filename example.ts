/**
 * AlphaBase v4.0.0 - TypeScript Example
 * 
 * This example demonstrates the new features in AlphaBase v4.0.0
 */

import { AlphaBase, QueryBuilder } from './dist/index.js';

// Define types for type-safe operations
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  city: string;
  createdAt: number;
}

async function main() {
  console.log('🚀 AlphaBase v4.0.0 - TypeScript Example\n');

  // Initialize database with monitoring
  const db = new AlphaBase({
    filePath: './example.db.json',
    enableMetrics: true,
    enableHealthChecks: true
  });

  console.log('✅ Database initialized\n');

  // ===== Basic Operations =====
  console.log('📝 Basic Operations:');

  // Set values with type safety
  db.set('user:1', {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    city: 'New York',
    createdAt: Date.now()
  });

  db.set('user:2', {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 35,
    city: 'San Francisco',
    createdAt: Date.now()
  });

  db.set('user:3', {
    id: 3,
    name: 'Carol White',
    email: 'carol@example.com',
    age: 42,
    city: 'New York',
    createdAt: Date.now()
  });

  // Get with type safety
  const user1 = db.get<User>('user:1');
  console.log(`- Retrieved: ${user1.name} (${user1.email})`);

  // Set with TTL (expires in 10 seconds)
  db.set('session:abc', { token: 'xyz123' }, { ttl: 10000 });
  console.log('- Session set with 10s TTL');
  console.log(`- Remaining TTL: ${db.getTTL('session:abc')}ms\n`);

  // ===== Advanced Queries =====
  console.log('🔍 Advanced Queries:');

  // Query users from New York, age >= 25
  const query = new QueryBuilder()
    .where('city', 'eq', 'New York')
    .where('age', 'gte', 25)
    .sort('age', 'asc');

  const results = db.executeQuery(query);
  console.log(`- Found ${results.total} users in New York (age >= 25):`);
  results.data.forEach((user: any) => {
    console.log(`  • ${user.name}, age ${user.age}`);
  });
  console.log();

  // ===== Transactions =====
  console.log('💼 Transactions:');

  try {
    await db.executeTransaction(async () => {
      db.set('counter', 1);
      db.set('lastUpdate', Date.now());
      console.log('- Transaction committed successfully');
    });
  } catch (error) {
    console.error('- Transaction failed:', error);
  }
  console.log();

  // ===== Streaming =====
  console.log('🌊 Streaming:');

  const stream = db.createReadStream({ batchSize: 2 });
  let count = 0;

  stream.on('data', (chunk) => {
    count++;
    if (count <= 3) {
      console.log(`- Stream item: ${chunk.key}`);
    }
  });

  stream.on('end', async () => {
    console.log(`- Streamed ${count} items\n`);

    // ===== Backup & Export =====
    console.log('💾 Backup & Export:');

    const backup = db.createBackup();
    console.log(`- Backup created: ${backup.filename}`);

    db.export('./example-export.json');
    console.log('- Database exported to example-export.json\n');

    // ===== Monitoring =====
    console.log('📊 Monitoring:');

    const stats = db.stats();
    console.log(`- Total keys: ${stats.keys}`);
    console.log(`- Database size: ${stats.size} bytes`);
    console.log(`- TTL keys: ${stats.ttl.total}`);

    // Health check
    const health = await db.healthCheck();
    console.log(`- Health status: ${health.status}`);
    console.log(`- Components checked: ${health.components.length}\n`);

    // Metrics
    const metrics = db.getMetrics();
    console.log('📈 Metrics:');
    console.log(`- Operations: ${metrics.counters.alphabase_operations_total || 0}`);
    console.log(`- Reads: ${metrics.counters.alphabase_reads_total || 0}`);
    console.log(`- Writes: ${metrics.counters.alphabase_writes_total || 0}\n`);

    // ===== Cleanup =====
    console.log('🧹 Cleanup:');

    // Cleanup expired TTL keys
    const removed = await db.cleanup();
    console.log(`- Removed ${removed} expired keys`);

    // Close database
    await db.close();
    console.log('- Database closed\n');

    console.log('✨ Example completed successfully!');
  });
}

// Run example
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
