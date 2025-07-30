# AlphaBase

**AlphaBase**: Modern, file-based key-value database module. Fast, secure, flexible, and ideal for Node.js projects.

---

## Features

- **File-based key-value database** (JSON storage)
- **Synchronous and asynchronous API**
- **Encryption support**: AES, XOR, or None
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
const db = new AlphaBase({ filePath: './mydb.json', password: 'mySecretPassword', encryption: 'AES' });

// XOR encryption
const dbXor = new AlphaBase({ filePath: './xor.json', password: 'mySecretPassword', encryption: 'XOR' });

// No encryption (None)
const dbNone = new AlphaBase({ filePath: './plain.json', encryption: 'None' });

// Add a key
await db.set('foo', { bar: 123 });
const value = await db.get('foo');

// Add a key with TTL (expires in 60 seconds)
await db.set('tempKey', { foo: 'bar' }, { ttl: 60000 });
console.log('Remaining time (ms):', db.getTTL('tempKey'));

// Cleanup expired keys
await db.cleanup();

// Get all keys
const all = await db.all();

// Statistics
const stats = await db.stats();
console.log(stats);

// Import/Export
await db.import({ a: 1, b: 2 });
const exported = await db.export();

// Export as string (includes TTL metadata)
const exportedString = await db.export(true);

// Import from encrypted JSON string
await db.import(exportedString);
```

---

## Encrypted JSON File Format

> **Since version 1.1.3**, encrypted values are now stored in a valid JSON wrapper.
> This improves compatibility with JSON parsers and backup systems.

When encryption is enabled (AES or XOR), AlphaBase saves files using the following format:

```json
{
  "_encrypted": true,
  "type": "AES",
  "data": "U2FsdGVkX1+..."
}
```

* `type`: The encryption method used (`AES` or `XOR`)
* `data`: The encrypted content, which contains a serialized object with `{ data, ttlMeta }`

In unencrypted mode, or when no password is used, the structure is simpler:

```json
{
  "data": { "foo": 123 },
  "ttlMeta": { "foo": 1750000000000 }
}
```

Backups and exported data also follow this format. If a file is encrypted and accessed without a valid password, it returns an empty object silently (no crash).

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

MIT
