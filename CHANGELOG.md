## [2.0.0] - 2025-07-31
### Added
- DES, TripleDES, Rabbit, Base64 encryption support (selectable)
- Multi-database management (AlphaBaseManager)
- Scheduled cleanup and auto-backup features
- Transaction support (begin, commit, rollback, atomic batch)
- Export/import with optional encryption (auto-decrypt on import)
- CLI: All features accessible via command line and interactive mode
- All code and comments translated to English
- Improved error handling and test coverage

### Changed
- Main file renamed to alpha.js, types to alpha.d.ts
- Scripts extended: test:watch, test:coverage, lint, type-check

### Fixed
- Circular reference issues in history
- Sync/async method consistency

---

## [1.1.3] - 2025-07-01
### Added
- Encrypted JSON file format wrapper for better compatibility
- Backup and export improvements
- CLI enhancements

### Fixed
- Minor bug fixes and improved error messages

---

## [1.1.0] - 2025-06-01
### Added
- Initial CLI tool
- AES and XOR encryption support
- TTL (Time-To-Live) for keys
- JSON schema validation

### Changed
- Improved documentation and examples

---
