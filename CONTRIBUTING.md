# Contributing to AlphaBase

Thank you for your interest in contributing to AlphaBase! This document provides guidelines for contributing to the project.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate of others
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check the [existing issues](https://github.com/ByAlphas/alphabase/issues) to avoid duplicates
2. Update to the latest version to see if the issue persists
3. Collect relevant information (Node.js version, OS, error messages)

When creating a bug report, include:
- Clear and descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Code samples (if applicable)
- Environment details (Node.js version, OS, AlphaBase version)

### Suggesting Features

Feature suggestions are welcome! Please:
1. Check if the feature has already been suggested
2. Clearly describe the feature and its benefits
3. Explain use cases and examples
4. Consider implementation complexity and maintenance burden

### Contributing Code

#### Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/alphabase.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`

#### Project Structure (v4.0.0)

```
alphabase/
├── src/
│   ├── core/
│   │   ├── EventManager.ts       # Event system (NEW in v4.0.0)
│   │   ├── CacheManager.ts       # LRU cache (NEW in v4.0.0)
│   │   ├── IndexManager.ts       # Indexing system (NEW in v4.0.0)
│   │   ├── SoftDeleteManager.ts  # Soft delete (NEW in v4.0.0)
│   │   ├── BackupManager.ts      # Backup/restore functionality
│   │   ├── TransactionManager.ts # ACID transactions
│   │   └── ValidationManager.ts  # Schema validation
│   ├── AlphaBase.ts              # Main database class
│   └── types.ts                  # TypeScript type definitions
├── tests/
│   ├── core.test.ts              # Core functionality tests
│   ├── cache.test.ts             # Cache tests (NEW)
│   ├── events.test.ts            # Event system tests (NEW)
│   ├── indexes.test.ts           # Indexing tests (NEW)
│   └── soft-delete.test.ts       # Soft delete tests (NEW)
└── examples/
    └── ...
```

**Core Managers:**
- `EventManager`: Native Node.js EventEmitter for lifecycle hooks
- `CacheManager`: LRU cache with TTL for frequently accessed data
- `IndexManager`: O(1) field-based lookups via Map/Set
- `SoftDeleteManager`: Deletion tracking with restore capability

#### Development Workflow

1. Make your changes
2. Write or update tests as needed
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Run type check: `npm run type-check`
6. Commit your changes (see commit message guidelines below)
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a pull request

#### Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(security): add token revocation support

Implements token revocation using blacklist mechanism.
Users can now revoke JWT tokens before expiration.

Closes #123
```

```
fix(cache): prevent memory leak in LRU cache

Fixed memory leak caused by circular references in cache entries.

Fixes #456
```

#### Code Style

- Follow the existing code style
- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons
- Keep line length under 100 characters
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

Run ESLint to check your code:
```bash
npm run lint
```

#### Testing

- Write tests for all new features
- Update tests when modifying existing features
- Aim for high test coverage
- Tests should be clear and maintainable

Run tests:
```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

#### Documentation

- Update README.md for user-facing changes
- Update API documentation in code
- Add JSDoc comments for new public methods
- Update CHANGELOG.md following Keep a Changelog format
- Update TypeScript definitions (alpha.d.ts) for new features

### Pull Request Process

1. Ensure all tests pass
2. Update documentation as needed
3. Update CHANGELOG.md with your changes
4. Link related issues in the PR description
5. Request review from maintainers

**Pull Request Template:**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
Describe how you tested your changes

## Checklist
- [ ] Tests pass
- [ ] Linter passes
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] TypeScript definitions updated (if applicable)
```

### Review Process

- Maintainers will review your PR as soon as possible
- Address feedback and requested changes
- Once approved, a maintainer will merge your PR
- Breaking changes may require more discussion

## Project Structure

```
alphabase/
├── alpha.js              # Main database class
├── security.js           # Security features (JWT, RSA, Audit)
├── performance.js        # Performance optimizations
├── pool.js               # Connection pooling
├── encryption.js         # Encryption algorithms
├── server.js             # HTTP server
├── cli.js                # Command-line interface
├── alpha.d.ts            # TypeScript definitions
├── tests/                # Test files
│   ├── alpha.db.test.js
│   ├── security.test.js
│   ├── performance.test.js
│   └── ...
├── config/               # Configuration presets
│   └── performance.js
└── public/               # Static files for dashboard
```

## Development Setup

### Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/ByAlphas/alphabase.git
cd alphabase

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint
```

### Testing Changes Locally

```bash
# Link package locally
npm link

# In another project
npm link alphabase

# Test your changes
node -e "const AlphaBase = require('alphabase'); console.log(new AlphaBase())"

# Unlink when done
npm unlink alphabase
```

## Release Process

Maintainers will handle releases following semantic versioning:

- **Patch** (x.x.1): Bug fixes, documentation updates
- **Minor** (x.1.0): New features, non-breaking changes
- **Major** (1.0.0): Breaking changes

## Getting Help

- **Questions**: Open a [GitHub Discussion](https://github.com/ByAlphas/alphabase/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/ByAlphas/alphabase/issues)
- **Security**: See [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the BSD-2-Clause License.

## Recognition

Contributors will be recognized in:
- Release notes
- CHANGELOG.md
- GitHub contributors page

Thank you for contributing to AlphaBase! 🎉
