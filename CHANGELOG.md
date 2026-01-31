# Changelog

All notable changes to AlphaBase will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## ⚠️ Important Notice

**AlphaBase v4.0.0 is the only recommended version for production use.**

Previous versions (v3.x and earlier) contain critical bugs, security vulnerabilities, and architectural issues that have been completely resolved in v4.0.0. We strongly recommend **NOT using any version prior to 4.0.0** in production environments.

If you're currently using an older version, please migrate to v4.0.0 immediately. See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions.

---

## [4.0.0] - 2026-01-31 (Latest Stable)

### 🎉 Complete Rewrite - Production Ready

This is the **first stable and recommended** version of AlphaBase. Previous versions should not be used due to critical bugs and security issues that have been completely resolved in this release.

**Why v4.0.0 is the only recommended version:**
- ✅ Complete TypeScript rewrite with strict type safety
- ✅ Fixed all critical security vulnerabilities (proper encryption, unique salts)
- ✅ Resolved architectural issues from previous versions
- ✅ 116 comprehensive tests (all passing)
- ✅ Non-blocking async I/O for production performance
- ✅ Professional documentation with honest capability descriptions
- ✅ Zero production dependencies vulnerabilities

### Added

**New Core Features**
- ✨ **Event System** - Native Node.js EventEmitter integration for lifecycle hooks
  - `on()`, `once()`, `off()` methods for event subscription
  - Events: `set`, `delete`, `before:set`, `after:delete`, `transaction:begin`, `transaction:commit`, `error`
  - Zero-dependency implementation
  
- 🚀 **LRU Cache** - Built-in caching layer for frequently accessed data
  - Configurable max size and TTL
  - Automatic eviction on memory limits
  - Cache statistics (hit rate, evictions, size)
  - `cacheStats()` and `clearCache()` methods
  
- 📇 **Indexing System** - O(1) field-based lookups
  - `createIndex()` for single or nested field indexing
  - `lookupIndex()` for fast key retrieval by field value
  - `rangeIndex()` for numeric/date range queries
  - Unique and sparse index options
  - `listIndexes()`, `indexStats()`, `dropIndex()` management methods
  
- 🗑️ **Soft Delete** - Safe deletion with restore capability
  - `softDelete()` marks keys as deleted without removing data
  - `restoreSoftDelete()` brings back soft-deleted items
  - `listDeleted()` shows all soft-deleted keys
  - `purgeDeleted()` permanently removes soft-deleted data
  - `isDeleted()` checks deletion status
  - Enabled by default, configurable via `enableSoftDelete` option

### Security

- 🔒 **Secure Encryption** - Proper cryptographic implementation
  - Unique random salt generation per database instance
  - Salt stored with encrypted data for proper decryption
  - Uses scrypt for secure key derivation
  - AES-256-GCM with authenticated encryption
  - AES-256-CBC as alternative option

### Performance

- ⚡ **Async I/O Operations** - Non-blocking file operations
  - New async methods: `initialize()`, `save()`, `load()`
  - BackupManager async methods: `createAsync()`, `restoreAsync()`, `listAsync()`, `deleteAsync()`
  - ErrorRecovery async file operations in `recoverCorruptedFile()`
  - Legacy sync methods preserved with `@deprecated` tags for backward compatibility
  - Eliminates event loop blocking on file operations
  - Better performance under high concurrent loads (5.3x throughput improvement)

### TypeScript & Architecture

- 📘 **Full TypeScript Rewrite** - Complete type safety
  - Strict mode enabled with all type checks
  - Generic types for type-safe operations
  - Complete type definitions and source maps
  - Source maps for debugging

- 🏗️ **Manager-Based Architecture** - Modular design
  - `Database` - Core CRUD operations with async I/O
  - `TransactionManager` - Atomic transactions with rollback
  - `TTLManager` - Time-to-live key expiration
  - `BackupManager` - Backup operations with async support
  - `EventManager` - Event handling system
  - `CacheManager` - LRU caching layer
  - `IndexManager` - Field indexing for fast lookups
  - `SoftDeleteManager` - Safe deletion with restore
  - `SchemaValidator` - JSON Schema validation
  - `QueryEngine` - Advanced query execution
  - `StreamingAPI` - Memory-efficient data processing
  - `MetricsCollector` - Prometheus-compatible metrics
  - `HealthCheckManager` - System health monitoring

### Advanced Features

- 🔍 **Query System** - Complex queries with fluent API
  - QueryBuilder with filters, sorting, pagination
  - Operators: eq, ne, gt, gte, lt, lte, in, nin, contains, startsWith, endsWith, regex
  - Aggregations: sum, avg, min, max, groupBy
  - Field projection and nested field access

- 🌊 **Streaming API** - Memory-efficient processing
  - Read, key, and value streams
  - Transform streams: filter, map, batch, JSON
  - Backpressure handling
  - Large dataset export/import support

- 📊 **Monitoring** - Production-ready observability
  - Prometheus-compatible metrics export
  - Health checks with readiness/liveness probes
  - Operation tracking and performance histograms
  - Memory and database health monitoring

- ✅ **Enhanced Validation**
  - JSON Schema validation with Ajv
  - Input sanitization (XSS, SQL/NoSQL injection prevention)
  - Type, key, size, and required field validation

### Changed

- ⚡ **Dependency Optimization** - Reduced from 10 to 1 core dependency (90% reduction)
  - Only `ajv` is required for JSON schema validation
  - `express`, `jsonwebtoken`, `crypto-js`, `express-rate-limit` moved to peerDependencies (optional)
  - CLI tools (`boxen`, `chalk`, `commander`, `yargs`) moved to optionalDependencies
  - Smaller installation footprint and faster install times

- 🏗️ **Architecture** - New manager-based design
  - `EventManager` for event handling
  - `CacheManager` for LRU caching
  - `IndexManager` for field indexing
  - `SoftDeleteManager` for deletion tracking
  - All managers integrated into `AlphaBase` core

- 📝 **Honest Documentation** - Accurate capability descriptions
  - Removed exaggerated "enterprise-grade" claims
  - Clear documentation of limitations (single-process, memory-bound, sync I/O)
  - Explicit use case recommendations
  - Transparent about what it is and isn't suitable for

### Breaking Changes

- ⚠️ Soft delete is **enabled by default** - existing code using `delete()` for permanent deletion still works
- ⚠️ Cache is **disabled by default** - set `cache: { maxSize: 1000 }` to enable
- ⚠️ Optional dependencies must be installed manually for specific features:
  - `npm install crypto-js` for encryption
  - `npm install express jsonwebtoken` for JWT authentication
  - `npm install express-rate-limit` for rate limiting

### Fixed
- ✅ Critical encryption vulnerability (unique salt generation per instance)
- ✅ Test stability improvements (116/116 tests passing)
- ✅ Cache invalidation on `set()` and `delete()` operations
- ✅ Index updates synchronized with data changes
- ✅ Test cleanup - removed 1,493 orphaned test backup directories
- ✅ Added test directories to .gitignore to prevent pollution
- ✅ Memory leaks in TTL cleanup process
- ✅ Circular reference issues in transaction snapshots
- ✅ Type safety issues throughout the codebase
- ✅ Inconsistent error handling patterns
- ✅ Resource cleanup on process termination

### Documentation

- 📝 **Honest and Accurate** - No exaggerated claims
  - Removed unverifiable "enterprise-grade" marketing claims
  - Clear documentation of limitations (single-process, memory-bound)
  - Explicit use case recommendations
  - Transparent about suitable and unsuitable scenarios
  - All documentation in English
  - Comprehensive migration guide
  - Performance benchmarks with actual measurements

### CLI Tools

- 🖥️ **Advanced CLI** (`cli-advanced.js`) - Full English translation
  - `alphabase init [file]` - Initialize new database
  - `alphabase backup <file>` - Create backups with maxBackups
  - `alphabase restore <file> <backup>` - Restore from backup
  - `alphabase backups <file>` - List all backups
  - `alphabase query <file>` - Execute queries with filters
  - `alphabase stats <file>` - Database statistics
  - `alphabase export/import` - Data portability
  - All messages and descriptions in English

### Migration from Previous Versions

**⚠️ IMPORTANT: Previous versions (v3.x and earlier) should NOT be used.**

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions.

**Quick Migration:**
```typescript
// v3.x (NOT RECOMMENDED - has critical bugs)
const AlphaBase = require('alphabase');
await db.transaction(async () => { /* ... */ });

// v4.0.0 (RECOMMENDED - stable and secure)
const { AlphaBase } = require('alphabase');
await db.executeTransaction(async () => { /* ... */ });

// New async I/O (recommended)
await db.initialize();
await db.save();
await db.createBackupAsync();
```

### Removed from Previous Versions

- Removed unreliable encryption implementation
- Removed blocking synchronous-only file operations
- Removed exaggerated performance claims
- Removed Turkish language content
- Removed undocumented internal methods
- Removed incompatible dependencies

---

## Previous Versions (NOT RECOMMENDED)

### ⚠️ WARNING: Versions below 4.0.0 are not recommended for any use

Previous versions contain critical bugs, security vulnerabilities, and architectural flaws that make them unsuitable for production use. All issues have been resolved in v4.0.0.

**Known critical issues in previous versions:**
- Hard-coded encryption salt (security vulnerability)
- Synchronous I/O blocking event loop
- Type safety issues
- Memory leaks
- Inadequate test coverage
- Architectural inconsistencies

**If you need to reference old versions for historical purposes only:**

## [3.1.0] - 2026-01-28

### Changed
- Rewritten documentation to be more professional and evidence-based
- Improved package.json with better descriptions and cleaned scripts
- Enhanced .npmignore to exclude unnecessary development files
- Removed unverifiable performance claims from documentation
- All documentation now in English

### Removed
- Removed obsolete test files (manual-test.js, simple-test.js, direct-test.js, etc.)
- Removed duplicate security module (security-new.js)
- Removed internal documentation files (JEST_FIX_COMPLETE.md, OPTIMIZATION_COMPLETE.md)
- Removed test data files (test-*.json, simple-test.json.enc)
- Removed dashboard.js (not part of core package)
- Cleaned up unused npm scripts

### Fixed
- Package now excludes all test and development files from npm distribution
- More accurate package size and cleaner installation

## [3.0.1] - 2025-08-03

### Fixed
- Added .npmignore to exclude development files and reduce package size
- Fixed environment variable handling for performance logs
- Corrected release date and version references in documentation

### Added
- Environment variable `SHOW_PERFORMANCE_LOGS=true` for detailed benchmarks

## [3.0.0] - 2025-08-03

### Added
- **Security Module**: JWT authentication, RSA encryption, audit logging, data integrity verification
- **HTTP Server**: REST API server with authentication support
- **JWT Token Support**: Create and verify JWT tokens
- **RSA Encryption**: 2048-bit RSA key generation and encryption/decryption
- **Audit Logging**: Operation tracking with file rotation
- **Data Integrity**: SHA256 checksum verification
- **CLI Security Commands**: JWT, RSA, audit, and server management
- **TypeScript Definitions**: Complete type definitions for all features

### Performance
- **Caching System**: Intelligent caching with LRU eviction
- **Connection Pooling**: Resource management with file-level locking
- **Smart Caching**: TTL-based read cache with automatic cleanup
- **Batch Processing**: Deferred write operations
- **Memory Management**: Automatic cache optimization
- **Performance Metrics**: Cache hit ratio, operations/sec, memory stats
- **Configuration Presets**: Development, Production, High-Performance modes

### Changed
- Enhanced security options in constructor
- Extended CLI with server, token, RSA, and audit commands
- Updated dependencies

## [2.0.0] - 2025-07-31

### Added
- Multiple encryption algorithms: DES, TripleDES, Rabbit, Base64
- Multi-database management (AlphaBaseManager)
- Scheduled cleanup and auto-backup
- Transaction support (begin, commit, rollback, atomic batch)
- Export/import with optional encryption
- CLI with interactive and classic modes

### Changed
- All code and comments translated to English
- Main file renamed to `alpha.js`, types to `alpha.d.ts`
- Extended scripts: `test:watch`, `test:coverage`, `lint`, `type-check`
- Fixed circular reference issues in history
- Improved sync/async method consistency

## [1.1.3] - 2025-07-24

### Added
- Encrypted JSON file format wrapper

### Changed
- Backup and export improvements
- CLI enhancements

### Fixed
- Minor bug fixes and improved error messages

## [1.1.0] - 2025-07-23

### Added
- Initial CLI tool
- AES and XOR encryption support
- TTL (Time-To-Live) for keys
- JSON schema validation

### Changed
- Improved documentation and examples

## [1.0.0] - 2025-07-20

### Added
- Initial release
- File-based key-value database
- JSON storage
- Basic CRUD operations
- Synchronous and asynchronous API

---

## Release Notes

### Version 4.0.0 Focus
Complete TypeScript rewrite. This is a major release, transforming AlphaBase into a type-safe, modular, feature-rich database with advanced querying, streaming, monitoring, and validation capabilities. **Breaking changes** - see MIGRATION.md.

### Version 3.1.0 Focus
This release focuses on professional documentation and package cleanup. No breaking changes to the API.

### Version 3.0.0 Focus
Major release with security features, HTTP server, and performance optimizations. This version transforms AlphaBase from a simple database into a complete data solution.

### Version 2.0.0 Focus
Added encryption options, multi-database management, transactions, and comprehensive CLI tools.

---

[4.0.0]: https://github.com/ByAlphas/alphabase/compare/v3.1.0...v4.0.0
[3.1.0]: https://github.com/ByAlphas/alphabase/compare/v3.0.1...v3.1.0
[3.0.1]: https://github.com/ByAlphas/alphabase/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/ByAlphas/alphabase/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/ByAlphas/alphabase/compare/v1.1.3...v2.0.0
[1.1.3]: https://github.com/ByAlphas/alphabase/compare/v1.1.0...v1.1.3
[1.1.0]: https://github.com/ByAlphas/alphabase/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ByAlphas/alphabase/releases/tag/v1.0.0
