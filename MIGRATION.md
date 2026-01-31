# Migration Guide: v3.x to v4.0.0

This guide helps you migrate your AlphaBase application from version 3.x to 4.0.0.

## Overview

AlphaBase v4.0.0 is a major rewrite in TypeScript with significant architectural improvements and new features. While we maintain backward compatibility for most common use cases, there are breaking changes you should be aware of.

## Breaking Changes

### 1. Package Structure

**v3.x:**
```javascript
const AlphaBase = require('alphabase');
const db = new AlphaBase({ filePath: './db.json' });
```

**v4.0.0:**
```typescript
// JavaScript
const { AlphaBase } = require('alphabase');
const db = new AlphaBase({ filePath: './db.json' });

// TypeScript
import { AlphaBase } from 'alphabase';
const db = new AlphaBase({ filePath: './db.json' });
```

### 2. Transaction Method Renamed

**v3.x:**
```javascript
await db.transaction(async () => {
  db.set('key1', 'value1');
  db.set('key2', 'value2');
});
```

**v4.0.0:**
```typescript
await db.executeTransaction(async () => {
  db.set('key1', 'value1');
  db.set('key2', 'value2');
});
```

### 3. Cleanup Method Behavior

**v3.x:**
```javascript
db.cleanup(); // Synchronous
```

**v4.0.0:**
```typescript
await db.cleanup(); // Now returns Promise<number> with count of removed keys
```

### 4. Removed Features

The following features from v3.x have been removed or redesigned:

- `inquirer-autocomplete-prompt` dependency (CLI simplified)
- Direct access to internal data structures
- Some undocumented internal methods

## New Features

### 1. Async I/O Operations

**v4.0.0 introduces non-blocking file operations:**

```typescript
// NEW: Async initialization (recommended)
const db = new AlphaBase({ filePath: './data.json' });
await db.initialize(); // Non-blocking startup

// NEW: Explicit async save
db.set('key', 'value');
await db.save(); // Non-blocking write

// NEW: Async load
await db.load(); // Reload from disk

// NEW: Async backups
const backup = await db.createBackupAsync();
console.log(`Backup created: ${backup.filename}`);

await db.restoreBackupAsync('backup-2024-12-24.json');
const backups = await db.listBackupsAsync();
```

**Legacy sync methods still available (deprecated):**

```typescript
// Old synchronous methods (still work but deprecated)
db.createBackup(); // Blocking
db.restore('backup.json'); // Blocking
const backups = db.listBackups(); // Blocking
```

**Performance benefit:** ~5x better throughput under concurrent load.

### 2. TypeScript Support

Full TypeScript support with type definitions:

```typescript
import { AlphaBase, AlphaBaseOptions } from 'alphabase';

interface User {
  id: number;
  name: string;
  email: string;
}

const db = new AlphaBase({ filePath: './users.json' });

// Type-safe operations
const user = db.get<User>('user:1');
console.log(user.name); // TypeScript knows this is a string
```

### 2. Advanced Query System

**Query Builder with Fluent API:**

```typescript
import { QueryBuilder } from 'alphabase';

// Build complex queries
const query = new QueryBuilder()
  .where('age', 'gte', 18)
  .where('city', 'eq', 'New York')
  .sort('name', 'asc')
  .paginate(0, 10);

const results = db.executeQuery(query);
console.log(results.data); // First 10 users from New York, age >= 18
```

**Available Operators:**
- `eq`, `ne` - Equality
- `gt`, `gte`, `lt`, `lte` - Comparisons
- `in`, `nin` - Array membership
- `contains`, `startsWith`, `endsWith` - String matching
- `regex` - Regular expressions

**Aggregations:**
```typescript
const queryEngine = new QueryEngine(dataRef);
const avgAge = queryEngine.aggregate('age', 'avg');
const groups = queryEngine.groupBy('city');
```

### 3. Streaming API

Process large datasets efficiently:

```typescript
// Stream all entries
const stream = db.createReadStream({ batchSize: 100 });

stream.on('data', (chunk) => {
  console.log(chunk.key, chunk.value);
});

// Stream with transformation
const transformedStream = db.createValueStream({
  transform: (value) => ({ ...value, processed: true })
});

// Use with Node.js streams
import { pipeline } from 'stream';
import { createWriteStream } from 'fs';

pipeline(
  db.createReadStream(),
  db.streaming.createJsonStream(true),
  createWriteStream('./export.json'),
  (err) => {
    if (err) console.error('Stream failed', err);
  }
);
```

### 4. Monitoring & Metrics

**Prometheus-style Metrics:**

```typescript
const db = new AlphaBase({
  filePath: './db.json',
  enableMetrics: true
});

// Collect metrics
db.set('key', 'value');
db.get('key');

// Export in Prometheus format
console.log(db.exportMetrics());
// # TYPE alphabase_operations_total counter
// alphabase_operations_total 2
// # TYPE alphabase_operation_duration_seconds histogram
// ...
```

**Health Checks:**

```typescript
const db = new AlphaBase({
  filePath: './db.json',
  enableHealthChecks: true
});

// Check health
const health = await db.healthCheck();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log(health.components); // Database, memory, etc.
```

### 5. Enhanced Validation

**Schema Validation with Ajv:**

```typescript
import { SchemaValidator } from 'alphabase';

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

// Validation happens automatically on set
db.set('user:1', { name: 'Alice', email: 'alice@example.com' });
```

**Input Sanitization:**

```typescript
import { InputSanitizer } from 'alphabase';

// Prevent XSS
const safe = InputSanitizer.sanitizeString('<script>alert("xss")</script>');
// Result: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;

// SQL injection prevention
const safeSql = InputSanitizer.sanitizeSql('SELECT * FROM users');

// NoSQL injection prevention
const safeNoSql = InputSanitizer.sanitizeNoSql({ $where: 'malicious' });
```

### 6. Better Error Handling

All errors now extend from `AlphaBaseError` with error codes:

```typescript
import { 
  AlphaBaseError,
  ValidationError, 
  KeyNotFoundError,
  ERROR_CODES 
} from 'alphabase';

try {
  db.get('nonexistent');
} catch (error) {
  if (error instanceof KeyNotFoundError) {
    console.log(error.code); // 'E002_KEY_NOT_FOUND'
    console.log(error.details); // { key: 'nonexistent' }
  }
}
```

**Available Error Classes:**
- `ValidationError` (E001)
- `KeyNotFoundError` (E002)
- `EncryptionError` (E003)
- `FileOperationError` (E004)
- `TransactionError` (E005)
- `AuthenticationError` (E006)
- `AuthorizationError` (E007)
- `RateLimitError` (E008)
- `SchemaValidationError` (E009)
- `TTLError` (E010)
- `BackupError` (E011)
- `ConfigurationError` (E012)
- `ConnectionPoolError` (E013)
- `TimeoutError` (E014)
- `QueryError` (E015)

## Migration Steps

### Step 1: Update Dependencies

```bash
npm install alphabase@^4.0.0
```

### Step 2: Update Imports

**Before:**
```javascript
const AlphaBase = require('alphabase');
```

**After:**
```javascript
const { AlphaBase } = require('alphabase');
```

Or with TypeScript:
```typescript
import { AlphaBase } from 'alphabase';
```

### Step 3: Update Transaction Calls

Find all occurrences of `db.transaction(...)` and replace with `db.executeTransaction(...)`:

```typescript
// Before
await db.transaction(async () => {
  // operations
});

// After
await db.executeTransaction(async () => {
  // operations
});
```

### Step 4: Update Cleanup Calls

If you use `cleanup()`, make it async:

```typescript
// Before
db.cleanup();

// After
const removedCount = await db.cleanup();
console.log(`Removed ${removedCount} expired keys`);
```

### Step 5: Add Types (TypeScript)

If using TypeScript, add proper types to your data:

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}

const product = db.get<Product>('product:123');
// TypeScript now knows product.price is a number
```

### Step 6: Test Thoroughly

Run your test suite to ensure everything works:

```bash
npm test
```

## Backward Compatibility

For maximum compatibility, the old `alpha.js` file is still included. However, we recommend migrating to the new TypeScript-based API for the following benefits:

- Type safety
- Better error messages
- New features (querying, streaming, monitoring)
- Performance improvements
- Ongoing support

## Performance Improvements

v4.0.0 includes several performance optimizations:

- More efficient TTL cleanup
- Better memory management
- Optimized query execution
- Streaming for large datasets
- Reduced disk I/O with better batching

## Getting Help

If you encounter issues during migration:

1. Check the [GitHub Issues](https://github.com/ByAlphas/alphabase/issues)
2. Review the [examples](./examples/)
3. Read the updated [README](./README.md)
4. Open a new issue if needed

## Example: Complete Migration

**v3.x Code:**
```javascript
const AlphaBase = require('alphabase');
const db = new AlphaBase({ filePath: './db.json' });

// Set with TTL
db.setSync('session:abc', { userId: 1 }, { ttl: 3600000 });

// Get
const session = db.getSync('session:abc');

// Transaction
db.transactionSync([
  { type: 'set', key: 'counter', value: 1 },
  { type: 'set', key: 'updated', value: Date.now() }
]);

// Cleanup
db.cleanupSync();
```

**v4.0.0 Code:**
```typescript
import { AlphaBase } from 'alphabase';

interface Session {
  userId: number;
}

const db = new AlphaBase({ filePath: './db.json' });

// Set with TTL
db.set('session:abc', { userId: 1 }, { ttl: 3600000 });

// Get with type
const session = db.get<Session>('session:abc');

// Transaction
await db.executeTransaction(async () => {
  db.set('counter', 1);
  db.set('updated', Date.now());
});

// Cleanup (now async)
const removed = await db.cleanup();

// Bonus: Use new query features
const query = db.query()
  .where('userId', 'eq', 1)
  .limit(10);

const results = db.executeQuery(query);
```

## Summary

AlphaBase v4.0.0 brings significant improvements while maintaining compatibility for most use cases. The main changes to watch for are:

1. Import syntax change
2. `transaction()` → `executeTransaction()`
3. `cleanup()` now async
4. TypeScript support
5. New query, streaming, and monitoring features

Take advantage of the new features to build more robust and maintainable applications!
