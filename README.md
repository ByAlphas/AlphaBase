# AlphaBase

**AlphaBase**: Modern, file-based key-value database module. Fast, secure, flexible, and ideal for Node.js projects.

---

## Changelog (Summary)

### [2.0.0] - 2025-07-31
- DES, TripleDES, Rabbit, Base64 encryption support (selectable)
- Multi-database management (AlphaBaseManager)
- Scheduled cleanup and auto-backup features
- Transaction support (begin, commit, rollback, atomic batch)
- Export/import with optional encryption (auto-decrypt on import)
- CLI: All features accessible via command line and interactive mode
- All code and comments translated to English
- Improved error handling and test coverage
- Main file renamed to `alpha.js`, types to `alpha.d.ts`
- Scripts extended: `test:watch`, `test:coverage`, `lint`, `type-check`
- Circular reference issues in history fixed
- Sync/async method consistency improved

### [1.1.3] - 2025-07-24
- Encrypted JSON file format wrapper for better compatibility
- Backup and export improvements
- CLI enhancements
- Minor bug fixes and improved error messages

### [1.1.0] - 2025-07-23
- Initial CLI tool
- AES and XOR encryption support
- TTL (Time-To-Live) for keys
- JSON schema validation
- Improved documentation and examples

---

## Features

- **File-based key-value database** (JSON storage)
- **Synchronous and asynchronous API**
- **Encryption support**: AES, DES, TripleDES, Rabbit, XOR, Base64, or None
- **TTL (Time-To-Live) for temporary keys**
- **JSON Schema validation**
- **Automatic and manual backup**
- **Import/Export** (JSON or object)
- **Advanced statistics** (`db.stats()`)
- **CLI tool**: interactive and classic mode
- **Web dashboard**: Visual management with Express.js + Alpine.js

---

## Installation

```sh
npm install alphabase
````

---

## Quick Start

```js
const AlphaBase = require('alphabase');

// AES encrypted database
const dbAes = new AlphaBase({ filePath: './mydb.json', password: 'mySecretPassword', encryption: 'AES' });

// DES encryption
const dbDes = new AlphaBase({ filePath: './des.json', password: 'mySecretPassword', encryption: 'DES' });

// TripleDES encryption
const dbTripleDes = new AlphaBase({ filePath: './tripledes.json', password: 'mySecretPassword', encryption: 'TripleDES' });

// Rabbit encryption
const dbRabbit = new AlphaBase({ filePath: './rabbit.json', password: 'mySecretPassword', encryption: 'Rabbit' });

// XOR encryption
const dbXor = new AlphaBase({ filePath: './xor.json', password: 'mySecretPassword', encryption: 'XOR' });

// Base64 encryption (no password required)
const dbBase64 = new AlphaBase({ filePath: './base64.json', encryption: 'Base64' });

// No encryption (None)
const dbNone = new AlphaBase({ filePath: './plain.json', encryption: 'None' });

// Add a key
await dbAes.set('foo', { bar: 123 });
const value = await dbAes.get('foo');

// Add a key with TTL (expires in 60 seconds)
await dbAes.set('tempKey', { foo: 'bar' }, { ttl: 60000 });
console.log('Remaining time (ms):', dbAes.getTTL('tempKey'));

// Cleanup expired keys
await dbAes.cleanup();

// Get all keys
const all = await dbAes.all();

// Statistics
const stats = await dbAes.stats();
console.log(stats);

// Import/Export
await dbAes.import({ a: 1, b: 2 });
const exported = await dbAes.export();

// Export as string (includes TTL metadata)
const exportedString = await dbAes.export(true);

// Import from encrypted JSON string
await dbAes.import(exportedString);
```

---

## Encrypted JSON File Format

When encryption is enabled (AES, DES, TripleDES, Rabbit, XOR, Base64), AlphaBase saves files using the following format:

```json
{
  "_encrypted": true,
  "type": "AES", // or DES, TripleDES, Rabbit, XOR, Base64
  "data": "...encrypted string..."
}
```

* `type`: The encryption method used
* `data`: The encrypted content, which contains a serialized object with `{ data, ttlMeta }`

In unencrypted mode (`None`), or when no password is used:

```json
{
  "data": { "foo": 123 },
  "ttlMeta": { "foo": 1750000000000 }
}
```

Backups and exported data follow the same format. If a file is encrypted and accessed with an invalid password, it returns an empty object silently (without crashing).

---

## Advanced Features

### TTL (Time-To-Live)

```js
await db.set('session', { user: 'john' }, { ttl: 30000 }); // Expires in 30 seconds
console.log(db.getTTL('session')); // Remaining time (ms)
await db.cleanup(); // Removes expired keys
```

---

### JSON Schema Validation

```js
const schema = {
  type: 'object',
  properties: { val: { type: 'number' } },
  required: ['val']
};

const db = new AlphaBase({ filePath: './schema.json', schema });

db.setSync('num', { val: 42 }); // Valid
// db.setSync('bad', { val: 'text' }); // Throws error
```

---

### Advanced Statistics

```js
const stats = await db.stats();
/*
{
  totalKeys: 1000,
  fileSize: 12345,
  lastModified: '2025-07-23T12:34:56.789Z',
  memoryUsage: 4567890,
  averageValueSize: 32,
  largestKey: 'myLongestKeyName',
  largestValueSize: 1024
}
*/
```

---

## CLI Usage

### Classic Mode

```sh
npx alphabase/cli.js --file=mydb.json --password=pass set foo '{"bar":123}'
npx alphabase/cli.js --file=mydb.json get foo
```

### Interactive Mode

```sh
npx alphabase/cli.js --interactive
```

* File selection
* Operation selection
* Key auto-completion
* JSON editor
* Colored box output

---

## Web Dashboard

```sh
node dashboard.js
```

* View all keys and values
* Change database file
* Search, add, delete, edit
* View statistics, create backups, export database
* Responsive and fast UI using Alpine.js + PicoCSS

---

## Tests

```sh
npm test
```

* Includes unit tests for:

  * Core module
  * Encryption
  * TTL (expiration)
* Powered by Jest

---

## API

See code comments for all available functions and options.

---

## License

BSD 2-Clause - see [LICENSE](LICENSE) file for details.
