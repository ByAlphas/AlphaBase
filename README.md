# AlphaBase

A lightweight, production-ready embedded TypeScript database for Node.js applications. Validated up to 250,000 records with full test coverage.

[![npm version](https://img.shields.io/npm/v/alphabase.svg)](https://www.npmjs.com/package/alphabase)
[![License](https://img.shields.io/npm/l/alphabase.svg)](https://github.com/ByAlphas/alphabase/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/alphabase.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-116%20passing-brightgreen.svg)](https://github.com/ByAlphas/alphabase)

## Overview

AlphaBase v4.0 is a fully TypeScript-rewritten embedded database for single-process Node.js applications:
- **🎯 Type Safety** - Full TypeScript support with strict typing
- **🔍 Advanced Queries** - Fluent API with filters, sorting, pagination
- **📇 Indexing** - O(1) field-based lookups (validated: 250K lookups/sec)
- **🗑️ Soft Delete** - Safe deletion with restore capability
- **⚡ LRU Cache** - Built-in caching (50% hit rate)
- **🔔 Events** - Hook into database operations
- **🌊 Streaming** - Memory-efficient processing (775K records/sec)
- **📊 Monitoring** - Prometheus-compatible metrics
- **✅ Validation** - JSON Schema validation
- **📦 Minimal Dependencies** - Only 1 core dependency (ajv)

### ⚠️ Important Limitations

**Please read before using in production:**

- **Single-Process Only** - No file locking mechanism. Not suitable for multi-process access (PM2, cluster mode).
- **Memory-Bound** - Entire database loads into memory. **Maximum validated: 250,000 records** (~30MB disk, tested January 31, 2026).
- **Async I/O Available** - v4.0.0 introduces async methods (`initialize()`, `save()`, `createBackupAsync()`) for non-blocking operations.
- **No Replication** - Single-node only. No clustering or distributed capabilities.
- **No WAL** - No Write-Ahead Logging. Crash recovery relies on regular backups (mandatory).

📋 See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for complete details.

**✅ Validated Production Use:**
- Single-process applications
- Configuration storage (< 250K entries)
- Local cache layer
- Session management (< 250K sessions)
- Development/testing environments

**❌ Not Recommended:**
- Multi-process/cluster deployments
- High-frequency writes (> 10K writes/sec)
- Datasets growing beyond 250K records
- Mission-critical data without backup infrastructure

## 🚀 Performance Benchmarks

AlphaBase has been validated at scale with comprehensive tests (Test date: January 31, 2026):

### 100K Records Performance
**Core Operations:**
- **Write**: ~2,700 records/sec (0.36ms per record)
- **Read**: ~14,500 reads/sec (0.069ms per read)
- **Index Lookup**: ~250,000 lookups/sec (0.004ms, 100% success)
- **Streaming**: 775,194 records/sec

**Data Management:**
- **Backup**: 136ms (100K records)
- **Restore**: 213ms (100K records, full integrity)
- **Memory**: 12.07MB disk space
- **Transactions**: 100% success rate
- **Cache Hit Rate**: 50%

### 250K Records Performance
**Validated Scale:** 17/17 tests passed (1237 seconds total)
- **Population**: 72s (250K records) - Linear scaling maintained
- **Random Reads**: 66s (20K reads)
- **Index Performance**: 100% success rate at 250K scale
- **Streaming**: 67s (250K records)
- **Backup/Restore**: 71s (250K records, full integrity)
- **Scaling Quality**: 2.3x time for 2.5x data (near-linear)

See [PERFORMANCE.md](PERFORMANCE.md) for detailed benchmarks and optimization guide.

## Installation

```bash
npm install alphabase
```

## Quick Start

### JavaScript

```javascript
const { AlphaBase } = require('alphabase');

const db = new AlphaBase({ 
  filePath: './data/mydb.json',
  enableMetrics: true,
  enableHealthChecks: true,
  cache: { maxSize: 1000, ttl: 3600000 }, // LRU cache
  enableEvents: true, // Event hooks
  enableSoftDelete: true // Soft delete support
});

// Async initialization (recommended for non-blocking startup)
await db.initialize();

// Basic operations
db.set('user:1', { name: 'Alice', email: 'alice@example.com' });
const user = db.get('user:1');
console.log(user.name); // Alice

// Async save (recommended)
await db.save();

// Events
db.on('set', ({ key, value }) => {
  console.log(`Data changed: ${key}`);
});

// Indexing for fast lookups
db.createIndex('email-idx', { field: 'email', unique: true });
const result = db.lookupIndex('email-idx', 'alice@example.com');
```

### TypeScript

```typescript
import { AlphaBase } from 'alphabase';

interface User {
  name: string;
  email: string;
  age: number;
}

const db = new AlphaBase({ filePath: './data/users.json' });

// Async initialization (recommended)
await db.initialize();

// Type-safe operations
db.set('user:1', { name: 'Alice', email: 'alice@example.com', age: 28 });
const user = db.get<User>('user:1');
console.log(user.age); // TypeScript knows this is a number
```

## Core Features

### Database Operations

```typescript
// CRUD operations
db.set(key, value);
db.set(key, value, { ttl: 3600000 }); // With TTL (1 hour)
const value = db.get(key);
db.delete(key);
const exists = db.has(key);

// Batch operations
db.batch([
  { type: 'set', key: 'user:1', value: { name: 'Alice' } },
  { type: 'set', key: 'user:2', value: { name: 'Bob' } },
  { type: 'delete', key: 'user:3' }
]);

// Transactions
await db.executeTransaction(async () => {
  db.set('account:1', { balance: 100 });
  db.set('account:2', { balance: 200 });
  // Auto-commit on success, rollback on error
});

// Statistics
const stats = db.stats();
console.log(stats.keys, stats.size, stats.ttl);
```

---

## 🛠️ TypeScript Configuration

For optimal TypeScript support, configure your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Import patterns:**

```typescript
// Named imports (recommended)
import { AlphaBase, QueryBuilder, InputSanitizer } from 'alphabase';

// TypeScript interfaces
import type { 
  AlphaBaseOptions, 
  QueryOptions, 
  IndexOptions 
} from 'alphabase';

// Full module import
import * as AlphaBase from 'alphabase';
```

---

## 🚀 Initialization Guide

### Async Initialization (Recommended for Production)

```typescript
import { AlphaBase } from 'alphabase';

async function main() {
  const db = new AlphaBase({ 
    filePath: './data/mydb.json',
    autoSave: true,
    saveInterval: 5000
  });

  // ✅ Always call initialize() for async setup
  await db.initialize();
  
  // Now safe to use
  db.set('key', 'value');
  
  // Graceful shutdown
  await db.close();
}

main().catch(console.error);
```

**When to use:**
- ✅ Production applications
- ✅ Large databases (>10K records)
- ✅ Network/file system operations
- ✅ Express/Fastify servers

### Sync Initialization (Quick Scripts)

```typescript
import { AlphaBase } from 'alphabase';

const db = new AlphaBase({ 
  filePath: './data/mydb.json',
  autoSave: false  // Manual save control
});

// No initialize() needed for sync operations
db.set('key', 'value');

// Manual save
db.saveSync();
```

**When to use:**
- ✅ CLI tools and scripts
- ✅ Testing environments
- ✅ Small datasets (<1K records)
- ❌ NOT for production servers

---

## ⚠️ Error Handling

### Transaction Errors

```typescript
import { AlphaBase, TransactionError } from 'alphabase';

try {
  await db.executeTransaction(async () => {
    db.set('account:1', { balance: 100 });
    db.set('account:2', { balance: 200 });
    
    if (someCondition) {
      throw new Error('Business logic error');
    }
  });
} catch (error) {
  if (error instanceof TransactionError) {
    console.error('Transaction rolled back:', error.message);
    // All changes reverted automatically
  }
}
```

### Validation Errors

```typescript
import { SchemaValidationError } from 'alphabase';

db.registerSchema('user', {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 }
  },
  required: ['name']
});

try {
  db.set('user:1', { age: -5 }); // Missing required 'name'
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error('Validation failed:', error.errors);
    // errors: [{ field: 'name', message: 'required' }]
  }
}
```

### File System Errors

```typescript
import { DatabaseError } from 'alphabase';

try {
  const db = new AlphaBase({ 
    filePath: '/invalid/path/db.json' 
  });
  await db.initialize();
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('Database initialization failed:', error.message);
    // Handle: create directory, use fallback path, etc.
  }
}
```

### Best Practices

```typescript
// ✅ DO: Wrap operations in try-catch
async function safeOperation() {
  try {
    await db.executeTransaction(async () => {
      // Your operations
    });
  } catch (error) {
    logger.error('Operation failed', { error });
    // Notify monitoring system
    // Retry logic if appropriate
  }
}

// ✅ DO: Listen to error events
db.on('error', ({ error, operation, key }) => {
  logger.error(`Error in ${operation}`, { key, error });
});

// ❌ DON'T: Ignore errors silently
db.executeTransaction(() => {
  // ...
}); // Missing await and error handling!
```

---

## 📋 Production Deployment Checklist

### Before Deployment

- [ ] **Configure TypeScript properly** (see TypeScript Configuration)
- [ ] **Use async initialization** with `await db.initialize()`
- [ ] **Enable auto-save** with reasonable intervals (5-30 seconds)
- [ ] **Set up backup automation** (daily at minimum)
- [ ] **Register validation schemas** for all data models
- [ ] **Add comprehensive error handling** (try-catch, error events)
- [ ] **Test at your expected scale** (create test with your data volume)
- [ ] **Verify memory limits** (see Limitations section)

### Monitoring Setup

```typescript
const db = new AlphaBase({
  filePath: './data/production.json',
  autoSave: true,
  saveInterval: 10000,
  enableMetrics: true,
  enableHealthChecks: true,
  cache: {
    maxSize: 5000,
    ttl: 3600000
  }
});

// Memory monitoring
setInterval(() => {
  const stats = db.stats();
  const memory = process.memoryUsage();
  
  if (memory.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected');
    db.clearCache(); // Free cache memory
  }
  
  console.log('DB size:', stats.size, 'records:', stats.keys);
}, 60000); // Check every minute

// Health checks
setInterval(async () => {
  const health = await db.healthCheck();
  if (health.status !== 'healthy') {
    console.error('Database unhealthy:', health);
    // Alert your team, restart service, etc.
  }
}, 300000); // Check every 5 minutes
```

### Backup Automation

```typescript
import { CronJob } from 'cron';

// Daily backup at 2 AM
new CronJob('0 2 * * *', async () => {
  try {
    const result = await db.backup({ 
      compress: true,
      backupDir: './backups'
    });
    console.log('Backup created:', result.path);
    
    // Clean old backups (keep last 7 days)
    await cleanOldBackups('./backups', 7);
  } catch (error) {
    console.error('Backup failed:', error);
    // Alert your team
  }
}).start();
```

### Graceful Shutdown

```typescript
async function gracefulShutdown(signal: string) {
  console.log(`${signal} received, closing database...`);
  
  try {
    // Save any pending changes
    await db.save();
    
    // Close database
    await db.close();
    
    console.log('Database closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## ⚡ Common Pitfalls

### ❌ DON'T: Use with PM2 Cluster Mode

```typescript
// ❌ WRONG: Multiple processes will corrupt data
pm2 start app.js -i max
```

```typescript
// ✅ CORRECT: Single process only
pm2 start app.js -i 1
```

**Why:** AlphaBase uses file-based storage. Multiple processes writing to the same file cause data corruption.

### ❌ DON'T: Exceed 250K Records

```typescript
// ❌ WRONG: Performance degrades beyond 250K
for (let i = 0; i < 500000; i++) {
  db.set(`key:${i}`, { data: i });
}
```

```typescript
// ✅ CORRECT: Stay within limits or shard data
if (db.stats().keys >= 250000) {
  console.warn('Approaching scale limit');
  // Consider: data archival, sharding, or migration to SQL
}
```

### ❌ DON'T: Skip Backups

```typescript
// ❌ WRONG: No backup strategy
const db = new AlphaBase({ 
  filePath: './data/mydb.json',
  autoSave: true 
});
// What if file gets corrupted?
```

```typescript
// ✅ CORRECT: Automated backups
const db = new AlphaBase({ 
  filePath: './data/mydb.json',
  autoSave: true,
  backupBeforeSave: true // Automatic backup before each save
});

// Plus scheduled backups (see Backup Automation above)
```

### ❌ DON'T: Forget to Close Database

```typescript
// ❌ WRONG: Process exits without saving
db.set('important', 'data');
process.exit(0); // Data lost!
```

```typescript
// ✅ CORRECT: Always close properly
db.set('important', 'data');
await db.close(); // Ensures data is saved
process.exit(0);
```

### ❌ DON'T: Store Large Binary Data

```typescript
// ❌ WRONG: Storing 10MB images in database
db.set('image:1', { 
  data: largeBase64Image // 10MB+ 
});
```

```typescript
// ✅ CORRECT: Store file paths, not content
import { writeFile } from 'fs/promises';

await writeFile('./uploads/image1.jpg', imageBuffer);
db.set('image:1', { 
  path: './uploads/image1.jpg',
  size: imageBuffer.length,
  createdAt: new Date()
});
```

### ❌ DON'T: Use Complex Nested Queries

```typescript
// ❌ WRONG: Deep nesting hurts performance
db.createIndex('level5', { field: 'a.b.c.d.e' });
```

```typescript
// ✅ CORRECT: Flatten data or limit nesting
db.set('user:1', {
  name: 'Alice',
  city: data.address.city, // Flatten at write time
  country: data.address.country
});

db.createIndex('city', { field: 'city' }); // Fast lookup
```

---

## 🎯 Complete Production Example

### Express API with AlphaBase

```typescript
import express from 'express';
import { AlphaBase, SchemaValidationError } from 'alphabase';

const app = express();
app.use(express.json());

// Initialize database
const db = new AlphaBase({
  filePath: './data/api.json',
  autoSave: true,
  saveInterval: 10000,
  enableMetrics: true
});

await db.initialize();

// Register schema
db.registerSchema('user', {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 0 }
  },
  required: ['name', 'email']
});

// Create index for email lookup
db.createIndex('users-email', { field: 'email', unique: true });

// Routes
app.post('/users', async (req, res) => {
  try {
    const userId = `user:${Date.now()}`;
    db.set(userId, req.body);
    
    res.status(201).json({ id: userId, ...req.body });
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/users/:id', (req, res) => {
  const user = db.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.get('/users/email/:email', (req, res) => {
  const result = db.lookupIndex('users-email', req.params.email);
  if (result.count === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  const user = db.get(result.keys[0]);
  res.json(user);
});

app.delete('/users/:id', async (req, res) => {
  const existed = db.delete(req.params.id);
  if (!existed) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.status(204).send();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await db.healthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(db.exportMetrics());
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');
  await db.save();
  await db.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

### Advanced Querying

**NEW in v4.0.0** - Build complex queries with a fluent API:

```typescript
import { QueryBuilder } from 'alphabase';

// Create query
const query = new QueryBuilder()
  .where('age', 'gte', 18)
  .where('city', 'eq', 'New York')
  .sort('name', 'asc')
  .paginate(0, 10);

// Execute query
const results = db.executeQuery(query);
console.log(results.data); // First 10 users from New York, age >= 18
console.log(results.total); // Total matching count
console.log(results.hasMore); // More results available?

// Available operators
query
  .equals('status', 'active')
  .greaterThan('score', 100)
  .lessThanOrEqual('age', 65)
  .in('role', ['admin', 'moderator'])
  .contains('name', 'john')
  .regex('email', /.*@example\.com$/);

// Aggregations
const avgAge = db.queryEngine.aggregate('age', 'avg');
const groups = db.queryEngine.groupBy('city');
const distinct = db.queryEngine.distinct('country');
```

### Streaming API

**NEW in v4.0.0** - Process large datasets efficiently:

```typescript
// Stream all entries
const stream = db.createReadStream({ batchSize: 100 });

stream.on('data', (chunk) => {
  console.log(chunk.key, chunk.value);
});

stream.on('end', () => {
  console.log('Streaming complete');
});

// Transform stream
const filtered = db.streaming.createFilterStream(
  (key, value) => value.age >= 18
);

const mapped = db.streaming.createMapStream(
  (key, value) => ({ ...value, processed: true })
);

// Export to file
import { pipeline } from 'stream';
import { createWriteStream } from 'fs';

pipeline(
  db.createReadStream(),
  db.streaming.createJsonStream(true),
  createWriteStream('./export.json'),
  (err) => console.log(err || 'Export complete')
);
```

### Monitoring & Metrics

**NEW in v4.0.0** - Track operations and system health:

```typescript
const db = new AlphaBase({
  filePath: './db.json',
  enableMetrics: true,
  enableHealthChecks: true
});

// Get metrics
const metrics = db.getMetrics();
console.log(metrics.counters.alphabase_operations_total);
console.log(metrics.counters.alphabase_reads_total);

// Export Prometheus format
console.log(db.exportMetrics());
// # TYPE alphabase_operations_total counter
// alphabase_operations_total 1234
// # TYPE alphabase_operation_duration_seconds histogram
// ...

// Health check
const health = await db.healthCheck();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'
health.components.forEach(c => {
  console.log(`${c.name}: ${c.status}`);
});
```

### Validation

**NEW in v4.0.0** - Schema validation and input sanitization:

```typescript
import { InputSanitizer } from 'alphabase';

// Register JSON Schema
const userSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    age: { type: 'number', minimum: 0 },
    email: { type: 'string', format: 'email' }
  },
  required: ['name', 'email']
};

db.registerSchema('user', userSchema);

// Validation happens automatically
db.set('user:1', { name: 'Alice', email: 'alice@example.com' });
// db.set('user:2', { age: -5 }); // Throws SchemaValidationError

// Input sanitization
const safe = InputSanitizer.sanitizeString('<script>alert("xss")</script>');
// Result: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;

const sanitized = db.sanitize(userInput);
```

### Event System

**NEW in v4.0.0** - Hook into database operations with event listeners:

```typescript
// Subscribe to events
db.on('set', ({ key, value }) => {
  console.log(`Data added/updated: ${key}`);
});

db.on('delete', ({ key, existed }) => {
  console.log(`Key ${key} deleted: ${existed}`);
});

db.on('before:set', ({ key, value }) => {
  console.log(`About to set ${key}`);
  // Perform validation, logging, etc.
});

db.on('after:delete', ({ key }) => {
  console.log(`${key} has been deleted`);
});

// Transaction events
db.on('transaction:begin', () => console.log('Transaction started'));
db.on('transaction:commit', () => console.log('Transaction committed'));
db.on('transaction:rollback', () => console.log('Transaction rolled back'));

// Error events
db.on('error', ({ error, operation, key }) => {
  console.error(`Error in ${operation}:`, error);
});

// Subscribe once
db.once('set', () => {
  console.log('First write detected');
});

// Unsubscribe
const handler = ({ key }) => console.log(key);
db.on('set', handler);
db.off('set', handler); // Remove listener
```

### LRU Cache

**NEW in v4.0.0** - Built-in caching layer for frequently accessed data:

```typescript
const db = new AlphaBase({
  filePath: './data/mydb.json',
  cache: {
    maxSize: 1000,      // Maximum cached items
    ttl: 3600000,       // Cache TTL in ms (1 hour)
    onEvict: (key, value) => {
      console.log(`Evicted from cache: ${key}`);
    }
  }
});

// Cache is automatically used for get() operations
db.set('user:1', { name: 'Alice' });
db.get('user:1'); // Cached after first access
db.get('user:1'); // Served from cache (faster)

// Cache statistics
const stats = db.cacheStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);
console.log(`Size: ${stats.size}/${stats.maxSize}`);
console.log(`Evictions: ${stats.evictions}`);

// Clear cache manually
db.clearCache();

// Disable cache
const dbNoCache = new AlphaBase({
  filePath: './data/mydb.json',
  cache: false
});
```

### Indexing System

**NEW in v4.0.0** - Create indexes for fast field-based lookups:

```typescript
// Create index on a field
db.createIndex('users-email', { 
  field: 'email', 
  unique: true  // Enforce unique values
});

db.createIndex('users-age', { 
  field: 'age',
  sparse: true  // Don't index null/undefined values
});

// Nested field indexing
db.createIndex('users-city', { 
  field: 'address.city' 
});

// O(1) lookup by indexed field
const result = db.lookupIndex('users-email', 'alice@example.com');
console.log(result.keys);   // ['user:1']
console.log(result.count);  // 1

// Range queries (for numeric/date fields)
const adults = db.rangeIndex('users-age', 18, 65);
console.log(adults.keys);   // All users aged 18-65

const recent = db.rangeIndex('created-at', 
  new Date('2024-01-01'), 
  new Date('2024-12-31')
);

// Index management
const indexes = db.listIndexes();
console.log(indexes); // ['users-email', 'users-age', 'users-city']

const stats = db.indexStats('users-email');
console.log(stats.size);      // Number of indexed values
console.log(stats.unique);    // true/false

db.dropIndex('users-email'); // Remove index
```

### Soft Delete

**NEW in v4.0.0** - Safely delete data with restore capability:

```typescript
const db = new AlphaBase({
  filePath: './data/mydb.json',
  enableSoftDelete: true // Default: true
});

// Soft delete (data is marked as deleted, not removed)
db.set('user:1', { name: 'Alice' });
db.softDelete('user:1', { deletedBy: 'admin' });

// Key is marked as deleted
console.log(db.has('user:1')); // false
console.log(db.isDeleted('user:1')); // true

// Restore soft-deleted data
db.restoreSoftDelete('user:1', { restoredBy: 'admin' });
console.log(db.has('user:1')); // true

// List all soft-deleted keys
const deleted = db.listDeleted();
console.log(deleted); // ['user:2', 'user:3', ...]

// Permanently delete all soft-deleted items
const purged = db.purgeDeleted();
console.log(`Purged ${purged} items`);

// Regular delete() bypasses soft delete
db.delete('user:1'); // Permanent deletion
```

### Encryption

**Note:** Requires `crypto-js` peer dependency. Install with `npm install crypto-js`

```javascript
const db = new AlphaBase({
  filePath: './data/encrypted.json',
  password: 'your-secure-password',
  encryption: 'AES' // Options: 'AES', 'TripleDES', 'Rabbit', 'XOR', 'Base64', 'None'
});
```

**Supported Algorithms:**
- **AES** - Advanced Encryption Standard (Recommended)
- **TripleDES** - Triple Data Encryption Standard
- **Rabbit** - High-performance stream cipher
- **XOR** - Simple XOR cipher (not recommended for production)
- **Base64** - Encoding only (not encryption)
- **None** - No encryption

### TTL (Time-To-Live)

Automatically expire keys after a specified duration:

```javascript
// Set with TTL (in seconds)
await db.set('cache:key', 'value', { ttl: 300 }); // Expires in 5 minutes

// Check remaining TTL
const remainingSeconds = await db.getTTL('cache:key');

// Manual cleanup of expired keys
await db.cleanup();
```

### Schema Validation

Validate data against JSON schemas using Ajv:

```javascript
const db = new AlphaBase({
  filePath: './data/validated.json',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number', minimum: 0 }
    },
    required: ['name']
  }
});

// This will throw an error if validation fails
await db.set('user:1', { name: 'Alice', age: 30 }); // ✓ Valid
await db.set('user:2', { age: -5 }); // ✗ Invalid (missing name, negative age)
```

### Backup and Restore

```javascript
// Manual backup
await db.backup(); // Creates timestamped backup file

// Automatic backups
const db = new AlphaBase({
  filePath: './data/mydb.json',
  autoBackupInterval: 3600000, // Backup every hour (in ms)
  enableAutoBackup: true // Default: true. Set to false to disable auto-backup
});

// Disable auto-backup
const dbNoAutoBackup = new AlphaBase({
  filePath: './data/mydb.json',
  autoBackupInterval: 3600000,
  enableAutoBackup: false // Auto-backup disabled
});

// Export data
await db.exportDB('./export.json');

// Import data
await db.importDB('./export.json');
```

## Security Features

### JWT Authentication

```javascript
const { JWTAuth } = require('alphabase/security');

const jwtAuth = new JWTAuth('your-secret-key');

// Create token
const token = jwtAuth.createToken(
  { userId: 123, role: 'admin' },
  { expiresIn: '1h' }
);

// Verify token
const result = jwtAuth.verifyToken(token);
if (result.valid) {
  console.log('User:', result.payload.userId);
} else {
  console.error('Invalid token:', result.error);
}
```

### RSA Encryption

```javascript
const { RSAEncryption } = require('alphabase/security');

const rsa = new RSAEncryption();

// Generate key pair
const { publicKey, privateKey } = rsa.generateKeyPair();

// Encrypt with public key
const encrypted = rsa.encrypt('sensitive data', publicKey);

// Decrypt with private key
const decrypted = rsa.decrypt(encrypted, privateKey);
```

### Audit Logging

Track all database operations:

```javascript
const { AuditLogger } = require('alphabase/security');

const db = new AlphaBase({
  filePath: './data/mydb.json',
  audit: {
    enabled: true,
    logFile: './logs/audit.log',
    maxFileSize: 10485760, // 10MB
    maxFiles: 5
  }
});

// All operations are now logged
await db.set('key', 'value'); // Logged: set operation

// Retrieve audit logs
const { AuditLogger } = require('alphabase/security');
const auditLogger = new AuditLogger({ logFile: './logs/audit.log' });
const recentLogs = auditLogger.getRecentLogs(10);
```

### Data Integrity

Verify data hasn't been tampered with:

```javascript
const { DataIntegrity } = require('alphabase/security');

const integrity = new DataIntegrity();

// Generate checksum
const data = JSON.stringify({ key: 'value' });
const checksum = integrity.generateChecksum(data);

// Verify checksum
const isValid = integrity.verifyChecksum(data, checksum);
console.log('Data integrity:', isValid ? 'Valid' : 'Compromised');
```

## Performance Optimizations

### Caching

Enable intelligent caching for faster read operations:

```javascript
const db = new AlphaBase({
  filePath: './data/mydb.json',
  performanceMode: true,
  cacheSize: 1000,      // Maximum cache entries
  cacheTTL: 30000       // Cache TTL in milliseconds (30 seconds)
});

// Read operations will use cache when available
const value = await db.get('frequently-accessed-key'); // Cached
```

### Connection Pooling

Optimize concurrent access:

```javascript
const db = new AlphaBase({
  filePath: './data/mydb.json',
  useConnectionPool: true,
  poolSize: 10
});
```

### Batch Writes

Reduce I/O operations:

```javascript
const db = new AlphaBase({
  filePath: './data/mydb.json',
  batchWrite: true,
  deferredWriteTimeout: 1000 // Flush every 1 second
});
```

## HTTP Server

Start a REST API server for remote access:

```javascript
const AlphaServer = require('alphabase/server');

const server = new AlphaServer({
  port: 3000,
  host: 'localhost',
  database: './data/mydb.json',
  jwtSecret: 'your-jwt-secret',
  auth: true, // Require authentication
  allowServerStart: true // Security: explicit permission required
});

server.start();
```

### API Endpoints

Once the server is running, you can access these endpoints:

```bash
# Health check
GET /health

# Get all keys
GET /api/keys

# Get specific key
GET /api/keys/:key

# Set key
POST /api/keys/:key
Body: { "value": "your-value" }

# Delete key
DELETE /api/keys/:key

# Batch operations
POST /api/batch
Body: [
  { "type": "set", "key": "key1", "value": "value1" },
  { "type": "delete", "key": "key2" }
]

# Authenticate and get token
POST /auth/token
Body: { "userId": 123, "role": "admin" }

# Statistics
GET /stats
```

## CLI Usage

AlphaBase includes a command-line interface:

```bash
# Interactive mode
node cli.js --interactive

# Direct commands
node cli.js get mykey
node cli.js set mykey '{"value": "data"}'
node cli.js delete mykey
node cli.js stats
node cli.js backup

# Start HTTP server
node cli.js server --allow-server --port 3000

# JWT operations
node cli.js token create --userId 123 --expiresIn 1h
node cli.js token verify <token>

# RSA operations
node cli.js rsa generate
node cli.js rsa encrypt "data" <publicKey>
node cli.js rsa decrypt <encrypted> <privateKey>
```

## Configuration

### Basic Configuration

```javascript
const db = new AlphaBase({
  // Required
  filePath: './data/mydb.json',
  
  // Optional - Security
  password: 'your-password',
  encryption: 'AES',
  jwtSecret: 'jwt-secret',
  audit: {
    enabled: true,
    logFile: './audit.log'
  },
  
  // Optional - Performance
  performanceMode: true,
  useConnectionPool: true,
  batchWrite: true,
  
  // Optional - Features
  schema: { /* JSON Schema */ },
  autoBackupInterval: 3600000,
  enableAutoBackup: true, // Default: true
  backupDir: './backups'
});
```

### Performance Presets

```javascript
const perfConfig = require('alphabase/config/performance');

// Development mode
const devDb = new AlphaBase({
  ...perfConfig.presets.development,
  filePath: './dev-db.json'
});

// Production mode
const prodDb = new AlphaBase({
  ...perfConfig.presets.production,
  filePath: './prod-db.json'
});
```

## TypeScript Support

AlphaBase includes full TypeScript definitions:

```typescript
import AlphaBase, { AlphaBaseOptions } from 'alphabase';

const options: AlphaBaseOptions = {
  filePath: './data/mydb.json',
  password: 'secure-password',
  encryption: 'AES',
  performanceMode: true
};

const db = new AlphaBase(options);

// Type-safe operations
await db.set<User>('user:1', { name: 'Alice', age: 30 });
const user = await db.get<User>('user:1');
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Performance tests
npm run test:performance

# Benchmarks
npm run benchmark
```

## Performance Benchmarks

AlphaBase includes comprehensive benchmarks for different scales. Run them with:

```bash
npm run benchmark:easy     # 1K records, basic operations
npm run benchmark:medium   # 10K records, queries & indexing
npm run benchmark:hard     # 50K records, streaming & complex ops
```

**Representative results (hardware dependent):**

| Scale | Operation | Performance | Notes |
|-------|-----------|-------------|-------|
| Small (1K) | Sequential Write | 30-45μs/op | ~30K ops/sec |
| Small (1K) | Random Read | 5-16μs/op | ~200K ops/sec |
| Medium (10K) | Indexed Lookup | 1-63μs/op | O(1) performance |
| Large (50K) | Streaming | 380-510K records/sec | Memory-efficient |

See [PERFORMANCE.md](PERFORMANCE.md) for detailed benchmarks and optimization tips.

*Note: Performance varies based on hardware, Node.js version, and data size.*

## Use Cases

AlphaBase is well-suited for:

- **Embedded applications** - Desktop apps, Electron apps, CLI tools
- **Development and testing** - Quick prototyping without database setup
- **Small to medium applications** - Apps with moderate data requirements
- **Edge computing** - IoT devices, local-first applications
- **Configuration management** - Application settings, user preferences
- **Session storage** - Web application sessions with TTL
- **Cache layer** - Application-level caching with expiration

AlphaBase may **not** be suitable for:

- High-throughput applications (>10,000 ops/sec sustained)
- Multi-process concurrent writes (use PostgreSQL, MongoDB, etc.)
- Very large datasets (>1GB)
- Complex queries and relationships (use SQL databases)

## 📚 API Reference

### Constructor Options

```typescript
interface AlphaBaseOptions {
  // Required
  filePath: string;                    // Path to database file
  
  // Core Settings
  autoSave?: boolean;                  // Auto-save on changes (default: true)
  saveInterval?: number;               // Save interval in ms (default: 5000)
  password?: string;                   // Encryption password
  encryption?: EncryptionType;         // 'AES' | 'TripleDES' | 'Rabbit' | 'XOR' | 'Base64' | 'None'
  
  // Features
  enableMetrics?: boolean;             // Enable metrics collection (default: false)
  enableHealthChecks?: boolean;        // Enable health checks (default: false)
  enableSoftDelete?: boolean;          // Enable soft delete (default: true)
  
  // Cache
  cache?: {
    maxSize: number;                   // Maximum cached items
    ttl: number;                       // Cache TTL in ms
    onEvict?: (key: string, value: any) => void;
  } | false;                           // Set false to disable
  
  // Backup
  backupBeforeSave?: boolean;          // Backup before each save (default: false)
  backupDir?: string;                  // Backup directory (default: './backups')
  autoBackupInterval?: number;         // Auto-backup interval in ms
  enableAutoBackup?: boolean;          // Enable auto-backup (default: true)
  
  // Performance
  performanceMode?: boolean;           // Optimize for performance (default: false)
  useConnectionPool?: boolean;         // Enable connection pooling (default: false)
  batchWrite?: boolean;                // Enable batch writes (default: false)
}
```

### Async vs Sync Methods

**v4.0.0 introduces async I/O operations for better performance under load.**

**✅ Recommended (Async - Non-blocking):**
```typescript
const db = new AlphaBase({ filePath: './data.json' });
await db.initialize();  // Async initialization
await db.save();        // Non-blocking save
await db.backup();      // Async backup
```

**❌ Legacy (Sync - Blocking):**
```typescript
const db = new AlphaBase({ filePath: './data.json' });
db.saveSync();          // Blocks thread
db.createBackup();      // Deprecated, use backup()
```

---

### 🔧 Core CRUD Methods

#### `set<T>(key: string, value: T, options?: SetOptions): void`

Set a value for the given key with optional TTL.

**Type Parameters:**
- `T` - Type of value being stored

**Parameters:**
- `key` (string): Unique key identifier
- `value` (T): Value to store (auto-serialized to JSON)
- `options` (optional):
  - `ttl` (number): Time-to-live in milliseconds

**Returns:** `void`

**Throws:** 
- `SchemaValidationError` - If schema validation fails
- `DatabaseError` - If write operation fails

**Examples:**
```typescript
// Basic set
db.set('user:1', { name: 'Alice', age: 30 });

// With TTL (expires in 1 hour)
db.set('session:abc', { userId: 1 }, { ttl: 3600000 });

// Type-safe with TypeScript
interface User { name: string; age: number; }
db.set<User>('user:2', { name: 'Bob', age: 25 });
```

---

#### `get<T>(key: string): T | undefined`

Get the value for the given key.

**Type Parameters:**
- `T` - Expected return type

**Parameters:**
- `key` (string): Key to retrieve

**Returns:** `T | undefined` - Value if exists and not expired, undefined otherwise

**Examples:**
```typescript
const user = db.get('user:1');
console.log(user); // { name: 'Alice', age: 30 }

// Type-safe
const user = db.get<User>('user:1');
if (user) {
  console.log(user.name.toUpperCase()); // TypeScript knows 'name' exists
}
```

---

#### `delete(key: string): boolean`

Permanently delete a key (bypasses soft delete).

**Parameters:**
- `key` (string): Key to delete

**Returns:** `boolean` - true if key existed, false otherwise

**Example:**
```typescript
const deleted = db.delete('user:1');
console.log(deleted); // true if existed
```

---

#### `has(key: string): boolean`

Check if a key exists (excluding soft-deleted and expired keys).

**Parameters:**
- `key` (string): Key to check

**Returns:** `boolean`

**Example:**
```typescript
if (db.has('user:1')) {
  console.log('User exists');
}
```

---

#### `bulkSet(entries: Array<[string, any]>): void` ⚡ NEW v4.0.0

Efficiently set multiple key-value pairs in a single transaction.

**Parameters:**
- `entries` (Array<[key, value]>): Array of key-value tuples

**Returns:** `void`

**Performance:** 65% faster than individual `set()` calls

**Example:**
```typescript
db.bulkSet([
  ['user:1', { name: 'Alice' }],
  ['user:2', { name: 'Bob' }],
  ['user:3', { name: 'Charlie' }]
]);
```

---

### 📦 Batch Operations

#### `batch(operations: Operation[]): void`

Execute multiple operations atomically.

**Type:** 
```typescript
type Operation = 
  | { type: 'set'; key: string; value: any; options?: SetOptions }
  | { type: 'delete'; key: string };
```

**Parameters:**
- `operations` (Operation[]): Array of operations

**Returns:** `void`

**Example:**
```typescript
db.batch([
  { type: 'set', key: 'user:1', value: { name: 'Alice' } },
  { type: 'set', key: 'user:2', value: { name: 'Bob' }, options: { ttl: 3600000 } },
  { type: 'delete', key: 'user:3' }
]);
```

---

### 🔄 Transaction Methods

#### `executeTransaction<T>(fn: () => T | Promise<T>): Promise<T>`

Execute operations within a transaction. Auto-commits on success, rolls back on error.

**Type Parameters:**
- `T` - Return type of transaction function

**Parameters:**
- `fn` (Function): Transaction function containing database operations

**Returns:** `Promise<T>` - Result of transaction function

**Throws:** 
- `TransactionError` - If transaction fails (auto-rollback)

**Example:**
```typescript
await db.executeTransaction(async () => {
  const balance1 = db.get<Account>('account:1');
  const balance2 = db.get<Account>('account:2');
  
  if (balance1.amount < 100) {
    throw new Error('Insufficient funds');
  }
  
  db.set('account:1', { amount: balance1.amount - 100 });
  db.set('account:2', { amount: balance2.amount + 100 });
  
  return { success: true };
});
```

---

### 📊 Query & Indexing

#### `createIndex(name: string, options: IndexOptions): void`

Create an index for fast field-based lookups.

**Type:**
```typescript
interface IndexOptions {
  field: string;      // Field path (supports nested: 'address.city')
  unique?: boolean;   // Enforce unique values (default: false)
  sparse?: boolean;   // Don't index null/undefined (default: false)
}
```

**Parameters:**
- `name` (string): Unique index name
- `options` (IndexOptions): Index configuration

**Returns:** `void`

**Example:**
```typescript
db.createIndex('users-email', { 
  field: 'email', 
  unique: true 
});

db.createIndex('users-city', { 
  field: 'address.city',
  sparse: true 
});
```

---

#### `lookupIndex(indexName: string, value: any): { keys: string[]; count: number }`

Perform O(1) lookup by indexed field value.

**Parameters:**
- `indexName` (string): Name of index
- `value` (any): Value to lookup

**Returns:** Object with `keys` (string[]) and `count` (number)

**Example:**
```typescript
const result = db.lookupIndex('users-email', 'alice@example.com');
console.log(result.keys);   // ['user:123']
console.log(result.count);  // 1
```

---

#### `executeQuery(query: QueryBuilder): QueryResult<T>`

Execute complex query with filtering, sorting, and pagination.

**Type:**
```typescript
interface QueryResult<T> {
  data: T[];          // Matching records
  total: number;      // Total matches (before pagination)
  hasMore: boolean;   // More results available?
  page: number;       // Current page number
  pageSize: number;   // Results per page
}
```

**Parameters:**
- `query` (QueryBuilder): Query builder instance

**Returns:** `QueryResult<T>`

**Example:**
```typescript
import { QueryBuilder } from 'alphabase';

const query = new QueryBuilder()
  .where('age', 'gte', 18)
  .where('city', 'eq', 'New York')
  .sort('name', 'asc')
  .paginate(0, 10);

const results = db.executeQuery<User>(query);
console.log(results.data);      // First 10 results
console.log(results.total);     // Total matching count
console.log(results.hasMore);   // true if more pages exist
```

---

### 🌊 Streaming Methods

#### `createReadStream(options?: StreamOptions): Readable`

Create a read stream for memory-efficient data processing.

**Type:**
```typescript
interface StreamOptions {
  batchSize?: number;    // Records per chunk (default: 500)
  includeDeleted?: boolean;  // Include soft-deleted (default: false)
}
```

**Parameters:**
- `options` (optional): Stream configuration

**Returns:** `Readable` - Node.js Readable stream

**Example:**
```typescript
const stream = db.createReadStream({ batchSize: 100 });

stream.on('data', (chunk: { key: string; value: any }) => {
  console.log(chunk.key, chunk.value);
});

stream.on('end', () => {
  console.log('Streaming complete');
});

stream.on('error', (err) => {
  console.error('Stream error:', err);
});
```

---

### 💾 Backup & Restore

#### `backup(options?: BackupOptions): Promise<BackupResult>`

Create timestamped backup of database.

**Type:**
```typescript
interface BackupOptions {
  compress?: boolean;      // GZIP compression (default: false)
  backupDir?: string;      // Override default backup directory
}

interface BackupResult {
  path: string;            // Full path to backup file
  size: number;            // Backup file size in bytes
  duration: number;        // Backup duration in ms
  compressed: boolean;     // Whether backup is compressed
}
```

**Parameters:**
- `options` (optional): Backup configuration

**Returns:** `Promise<BackupResult>`

**Example:**
```typescript
const result = await db.backup({ compress: true });
console.log(`Backup created: ${result.path}`);
console.log(`Size: ${result.size} bytes`);
console.log(`Duration: ${result.duration}ms`);
```

---

#### `restore(backupPath: string): Promise<void>`

Restore database from backup file.

**Parameters:**
- `backupPath` (string): Path to backup file

**Returns:** `Promise<void>`

**Throws:**
- `DatabaseError` - If backup file not found or invalid

**Example:**
```typescript
await db.restore('./backups/backup-2026-01-30.json');
console.log('Database restored successfully');
```

---

### 📈 Monitoring Methods

#### `getMetrics(): MetricsSnapshot`

Get current metrics snapshot (requires `enableMetrics: true`).

**Type:**
```typescript
interface MetricsSnapshot {
  counters: {
    alphabase_operations_total: number;
    alphabase_reads_total: number;
    alphabase_writes_total: number;
    alphabase_deletes_total: number;
  };
  histograms: {
    alphabase_operation_duration_seconds: Array<{ le: number; count: number }>;
  };
}
```

**Returns:** `MetricsSnapshot`

**Example:**
```typescript
const metrics = db.getMetrics();
console.log('Total operations:', metrics.counters.alphabase_operations_total);
console.log('Total reads:', metrics.counters.alphabase_reads_total);
```

---

#### `healthCheck(): Promise<HealthCheckResult>`

Perform comprehensive health check (requires `enableHealthChecks: true`).

**Type:**
```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  }>;
  timestamp: Date;
}
```

**Returns:** `Promise<HealthCheckResult>`

**Example:**
```typescript
const health = await db.healthCheck();
console.log('Status:', health.status);
health.components.forEach(c => {
  console.log(`${c.name}: ${c.status}`);
});
```

---

### 🗑️ Soft Delete Methods

#### `softDelete(key: string, metadata?: any): boolean`

Mark key as deleted without removing data.

**Parameters:**
- `key` (string): Key to soft delete
- `metadata` (optional): Additional metadata (e.g., deletedBy, reason)

**Returns:** `boolean` - true if key existed

**Example:**
```typescript
db.softDelete('user:1', { 
  deletedBy: 'admin',
  reason: 'GDPR request' 
});
```

---

#### `restoreSoftDelete(key: string, metadata?: any): boolean`

Restore soft-deleted key.

**Parameters:**
- `key` (string): Key to restore
- `metadata` (optional): Restore metadata

**Returns:** `boolean` - true if key was soft-deleted

**Example:**
```typescript
db.restoreSoftDelete('user:1', { restoredBy: 'admin' });
```

---

#### `listDeleted(): string[]`

Get all soft-deleted keys.

**Returns:** `string[]` - Array of soft-deleted keys

**Example:**
```typescript
const deleted = db.listDeleted();
console.log(`${deleted.length} soft-deleted items`);
```

---

#### `purgeDeleted(): number`

Permanently delete all soft-deleted items.

**Returns:** `number` - Count of purged items

**Example:**
```typescript
const purged = db.purgeDeleted();
console.log(`Purged ${purged} items`);
```

---

### 📋 Utility Methods

#### `keys(): string[]`

Get all keys (excluding soft-deleted and expired).

**Returns:** `string[]`

---

#### `values<T>(): T[]`

Get all values.

**Returns:** `T[]`

---

#### `entries<T>(): Array<[string, T]>`

Get all key-value pairs.

**Returns:** `Array<[string, T]>`

---

#### `all<T>(): Record<string, T>`

Get all data as object.

**Returns:** `Record<string, T>`

---

#### `clear(): void`

Delete all data permanently.

**Returns:** `void`

---

#### `size(): number`

Get number of keys.

**Returns:** `number`

---

#### `stats(): DatabaseStats`

Get comprehensive database statistics.

**Type:**
```typescript
interface DatabaseStats {
  keys: number;              // Total keys
  size: number;              // Estimated size in bytes
  ttlKeys: number;           // Keys with TTL
  indexes: number;           // Number of indexes
  softDeleted: number;       // Soft-deleted keys count
  cacheSize: number;         // Cached items count
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
  };
}
```

**Returns:** `DatabaseStats`

**Example:**
```typescript
const stats = db.stats();
console.log(`Keys: ${stats.keys}`);
console.log(`Size: ${stats.size} bytes`);
console.log(`Memory: ${stats.memoryUsage.heapUsed} bytes`);
```

---

#### `close(): Promise<void>`

Gracefully close database (saves pending changes).

**Returns:** `Promise<void>`

**Example:**
```typescript
await db.close();
console.log('Database closed');
const all = db.allSync();
db.clearSync();
const stats = db.statsSync();
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Migration from v3.x

AlphaBase v4.0.0 includes breaking changes. If you're upgrading from v3.x, please read the [Migration Guide](MIGRATION.md) for detailed instructions.

**Key Changes:**
- Import syntax: `const { AlphaBase } = require('alphabase')`
- `transaction()` renamed to `executeTransaction()`
- `cleanup()` is now async
- Full TypeScript support with type definitions

## What's New in v4.0.0

### 🎯 TypeScript Rewrite
- Full TypeScript codebase with strict typing
- Generic types for type-safe database operations
- Complete type definitions included

### 🔍 Advanced Query System
- Fluent API with `QueryBuilder`
- 12+ filter operators (eq, ne, gt, in, contains, regex, etc.)
- Sorting, pagination, and field projection
- Aggregation functions (sum, avg, min, max)

### 🌊 Streaming API
- Memory-efficient processing for large datasets
- Transform streams (filter, map, batch, JSON)
- Backpressure handling
- Export/import large databases without memory issues

### 📊 Monitoring & Health Checks
- Prometheus-compatible metrics
- Database operation tracking
- Health checks with component status
- Performance histograms

### ✅ Enhanced Validation
- JSON Schema validation with Ajv
- Input sanitization (XSS, SQL, NoSQL prevention)
- Type and size validation helpers

### 🏗️ Modular Architecture
- Separated core modules (Database, Transaction, TTL, Backup)
- Clean separation of concerns
- Better testability and maintainability

## Performance Benchmarks

AlphaBase includes a comprehensive 3-tier benchmark suite to measure performance across different workload scenarios:

### Running Benchmarks

```bash
# Run specific benchmark level
npm run benchmark:easy     # 1K records, basic operations (~3s)
npm run benchmark:medium   # 10K records, queries & indexing (~15s)
npm run benchmark:hard     # 50K records, streaming & complex ops (~160s)

# Run all benchmarks
npm run benchmark:all
```

### Benchmark Levels

**🟢 EASY** - Basic CRUD operations (1,000 records)
- Sequential write: ~30μs per operation (33K ops/sec)
- Random read: ~5μs per operation (217K ops/sec)
- Batch operations: ~2.3ms per batch
- Delete operations: ~4.6μs per operation

**🟡 MEDIUM** - Advanced queries & indexing (10,000 records)
- Index creation: ~140μs for 3 indexes
- Indexed lookup: ~1μs per lookup (1M ops/sec)
- Complex queries: <1ms
- Transaction: ~154μs per transaction
- Sort & pagination: ~14μs per page

**🔴 HARD** - Large dataset & streaming (50,000 records)
- Streaming throughput: 380K-510K records/sec
- Complex multi-filter query: ~150ms (10K matches)
- Bulk update (1K records): ~5ms per record
- Aggregations: <500ms for 7 operations
- Async save: 76MB/sec write throughput
- Memory usage: ~146MB for 50K records

### Performance Tips

1. **Use Indexing** - O(1) lookups vs O(n) full scan
2. **Enable Caching** - Significantly faster repeated reads
3. **Batch Operations** - More efficient than individual writes
4. **Streaming API** - Memory-efficient for large datasets
5. **Async Methods** - Non-blocking I/O for better concurrency

## License

AlphaBase is licensed under the BSD-2-Clause License. See [LICENSE](LICENSE) for details.

## Links

- [GitHub Repository](https://github.com/ByAlphas/alphabase)
- [npm Package](https://www.npmjs.com/package/alphabase)
- [Issue Tracker](https://github.com/ByAlphas/alphabase/issues)
- [Migration Guide](MIGRATION.md) - v3.x to v4.0.0
- [Changelog](CHANGELOG.md)
- [TypeScript Example](example.ts)

## Support

- 📧 Email: [GitHub Issues](https://github.com/ByAlphas/alphabase/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/ByAlphas/alphabase/discussions)
- 📖 Documentation: [README.md](README.md)

---

**© 2026 [ByAlphas](https://github.com/ByAlphas) - Licensed under BSD-2-Clause**
