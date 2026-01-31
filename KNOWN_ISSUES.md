# Known Issues

This document tracks known issues, limitations, and planned improvements for AlphaBase.

## Security Vulnerabilities (Development Only)

### ESLint Stack Overflow Vulnerability (GHSA-p5wg-g6qr-c7cg)

**Status:** Known, Development-Only Impact  
**Severity:** Moderate (CVSS 5.5)  
**Affected Versions:** ESLint <9.26.0, @typescript-eslint/* packages  
**Impact:** Development environment only (not affecting production runtime)

**Details:**
- ESLint has a potential stack overflow when serializing objects with circular references
- Affects 5 development dependencies: `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/utils`
- Only affects linting process during development
- Does not impact production builds or runtime security

**Why Not Fixed:**
- Fixing requires upgrading to ESLint 9.x which is a **breaking change**
- ESLint 9.x has different configuration format (flat config)
- @typescript-eslint/\* packages need major version bumps to v8.x
- Current setup works correctly for development purposes
- No known exploits affecting typical usage patterns

**Planned Resolution:**
- Will be addressed in v5.0.0 major release
- Allows users to stay on stable v4.x without breaking changes
- Tracking issue: [To be created]

**Workaround:**
None needed - this is a development-time issue with no practical security impact for this project's development workflow.

## Performance Characteristics (Validated)

### Tested Performance at Scale

**Status:** ✅ Validated (January 31, 2026)  
**Test Results:** 17/17 tests passed at both 100K and 250K records

**Proven Capabilities:**

**100K Records:**
- Write: ~2,700 records/sec
- Read: ~14,500 reads/sec
- Index: 100% success, ~250,000 lookups/sec
- Streaming: 775,194 records/sec
- Memory: 12.07MB disk space

**250K Records:**
- Population: 72s total (250K records)
- Random Reads: 66s (20K reads)
- Index: 100% success rate maintained
- Streaming: 67s (250K records)
- Backup/Restore: 71s with full integrity
- Memory: ~30MB disk space
- **Scaling: Near-linear (2.3x time for 2.5x data)**

### Recommended Limits

**Maximum Records:** ~250,000 (tested maximum)

**Suitable For:**
- Single-process applications
- Configuration storage (< 250K entries)
- Local caching
- Session management (< 250K sessions)
- Development/testing

**NOT Suitable For:**
- Multi-process applications (PM2, cluster mode)
- High-frequency writes (>10K writes/sec)
- Mission-critical data without backup strategy
- Datasets growing beyond 250K records

**Migration Guide:**
```typescript
// Old (synchronous, blocking)
const db = new AlphaBase({ filePath: './data.json' });
db.createBackup();

// New (asynchronous, non-blocking)
const db = new AlphaBase({ filePath: './data.json' });
await db.initialize();  // Non-blocking initialization
await db.createBackupAsync();  // Non-blocking backup
await db.save();  // Explicit async save
```

**Remaining Work:**
- Constructor still performs sync I/O for backward compatibility
- Full async-only mode planned for v5.0.0

### Single-Process Architecture

**Status:** By Design  
**Impact:** High (for multi-process scenarios)

**Details:**
- AlphaBase is designed for single-process Node.js applications
- No inter-process locking or synchronization
- Running multiple instances pointing to same file causes data corruption

**Workarounds:**
- Use cluster-safe solutions (Redis, MongoDB) for multi-process apps
- Implement file locking with external library if absolutely needed
- Use AlphaBase only in single-process mode (recommended)

**Not Planned:**
Multi-process support is explicitly out of scope. AlphaBase is optimized for single-process, embedded database scenarios.

### Memory-Bound Storage

**Status:** By Design  
**Impact:** Medium-High (for large datasets)

**Details:**
- Entire database loaded into memory
- Maximum practical size: ~100MB-500MB (depends on available RAM)
- No lazy loading or pagination support for data at rest

**Workarounds:**
- Archive old data periodically
- Partition data into multiple database files
- Use external database for datasets >100MB

**Not Planned:**
Disk-based B-tree or LSM storage would fundamentally change architecture. AlphaBase is designed as an in-memory database with persistence.

## Type Safety

### TypeScript `any` Type Usage

**Status:** Technical Debt  
**Impact:** Low  
**Count:** 19 instances (as of v4.0.0)

**Details:**
- Some internal type casts use `any` for flexibility
- Mainly in generic data handling and manager access

**Planned:**
- Gradual reduction in v4.x patch releases
- Full strict typing in v5.0.0

## Platform Support

### Windows Line Endings (CRLF)

**Status:** Known  
**Impact:** Low (ESLint warnings only)

**Details:**
- Project developed on Windows, uses CRLF line endings
- ESLint configured for LF but not enforcing
- No functional impact

**Resolution:**
- Not a priority for v4.x
- Will standardize to LF in v5.0.0

## Reporting New Issues

Found a bug or limitation not listed here?

1. Check [GitHub Issues](https://github.com/yourusername/alphabase/issues)
2. Review [Security Policy](SECURITY.md) for security issues
3. Open a new issue with detailed reproduction steps

---

**Last Updated:** 2026-01-30  
**Version:** 4.0.0
