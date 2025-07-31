// Multi-DB manager
class AlphaBaseManager {
  constructor() {
    this.databases = {};
  }
  open(filePath, options = {}) {
    if (!this.databases[filePath]) {
      this.databases[filePath] = new AlphaBase({ ...options, filePath });
    }
    return this.databases[filePath];
  }
  close(filePath) {
    delete this.databases[filePath];
  }
  list() {
    return Object.keys(this.databases);
  }
  get(filePath) {
    return this.databases[filePath];
  }
}

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const encryption = require('./encryption');
// Native Base64 encryption/decryption helpers
function base64Encrypt(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}
function base64Decrypt(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

class AlphaBase {
  // Synchronous: check if key exists
  hasSync(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    this.cleanupSync();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      this._saveSync();
      return false;
    }
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  // Synchronous: clear all data
  clearSync() {
    this.data = {};
    this.ttlMeta = {};
    this._saveSync();
  }

  // Synchronous: get all data
  allSync() {
    this.cleanupSync();
    const out = {};
    for (const key of Object.keys(this.data)) {
      if (!this.ttlMeta[key] || this.ttlMeta[key] > Date.now()) {
        out[key] = this.data[key];
      }
    }
    return out;
  }

  // Internal: add change to document history (avoid circular refs)
  _addHistory(doc, change) {
    if (!doc._history) doc._history = [];
    if (!doc.updatedAt) doc.updatedAt = Date.now();
    // Avoid circular reference by not storing the full object in value
    let safeChange = { ...change, at: Date.now() };
    if (safeChange.value && typeof safeChange.value === 'object') {
      try {
        safeChange.value = JSON.parse(JSON.stringify(safeChange.value));
      } catch {
        safeChange.value = '[Unserializable]';
      }
    }
    doc._history.unshift(safeChange);
    if (doc._history.length > 3) doc._history = doc._history.slice(0, 3);
    doc.updatedAt = Date.now();
  }
  // Transaction support
  beginTransaction() {
    if (this._transaction) throw new Error('Transaction already in progress');
    this._transaction = {
      data: JSON.parse(JSON.stringify(this.data)),
      ttlMeta: JSON.parse(JSON.stringify(this.ttlMeta))
    };
  }
  commit() {
    if (!this._transaction) throw new Error('No transaction in progress');
    this._transaction = null;
    this._saveSync();
  }
  rollback() {
    if (!this._transaction) throw new Error('No transaction in progress');
    this.data = this._transaction.data;
    this.ttlMeta = this._transaction.ttlMeta;
    this._transaction = null;
    this._saveSync();
  }
  transactionSync(ops) {
    this.beginTransaction();
    try {
      this.batchSync(ops);
      this.commit();
    } catch (e) {
      this.rollback();
      throw e;
    }
  }

  // Scheduled cleanup
  startScheduledCleanup(intervalMs) {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    this._cleanupInterval = setInterval(() => {
      try { this.cleanupSync(); } catch (e) {}
    }, intervalMs);
  }
  stopScheduledCleanup() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    this._cleanupInterval = null;
  }

  /**
   * Exports a specific collection to a JSON file.
   * @param {string} collection - Collection name (key)
   * @param {string} filePath - Output file path
   */
  exportCollection(collection, filePath) {
    if (typeof collection !== 'string') throw new TypeError('Collection name must be a string');
    if (!filePath || typeof filePath !== 'string') throw new TypeError('File path must be a string');
    const data = this.data[collection];
    if (!data) throw new Error(`Collection '${collection}' not found.`);
    let out = JSON.stringify(data, null, 2);
    // Optional encryption for export
    if (arguments[2] && arguments[2].encrypt && this.password) {
      let encType = this.encryptionType;
      let encrypted;
      if (encType === 'Base64') {
        encrypted = base64Encrypt(out);
      } else {
        encrypted = encryption.encrypt(out, this.password, encType);
      }
      out = JSON.stringify({ _encrypted: true, type: encType, data: encrypted });
    }
    try {
      fs.writeFileSync(filePath, out, 'utf8');
    } catch (err) {
      throw new Error(`Failed to export collection: ${err.message}`);
    }
  }

  /**
   * Imports data from a JSON file into a collection.
   * @param {string} collection - Collection name (key)
   * @param {string} filePath - Input file path
   */
  importCollection(collection, filePath) {
    if (typeof collection !== 'string') throw new TypeError('Collection name must be a string');
    if (!filePath || typeof filePath !== 'string') throw new TypeError('File path must be a string');
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      throw new Error(`Failed to read file: ${err.message}`);
    }
    let docs;
    try {
      const parsed = JSON.parse(fileContent);
      if (parsed && parsed._encrypted && parsed.data && this.password) {
        // Auto-decrypt if password is set
        let encType = parsed.type || this.encryptionType;
        let decrypted;
        if (encType === 'Base64') {
          decrypted = base64Decrypt(parsed.data);
        } else {
          decrypted = encryption.decrypt(parsed.data, this.password, encType);
        }
        docs = JSON.parse(decrypted);
      } else {
        docs = parsed;
      }
    } catch (err) {
      throw new Error(`Invalid JSON in import file: ${err.message}`);
    }
    if (!Array.isArray(docs) && typeof docs !== 'object') {
      throw new Error('Imported data must be an array or object.');
    }
    // Create collection if it does not exist
    if (!this.data[collection]) this.data[collection] = Array.isArray(docs) ? [] : {};
    // Insert logic: if array, push; if object, assign
    if (Array.isArray(this.data[collection]) && Array.isArray(docs)) {
      this.data[collection].push(...docs);
    } else if (typeof this.data[collection] === 'object' && typeof docs === 'object' && !Array.isArray(docs)) {
      Object.assign(this.data[collection], docs);
    } else {
      throw new Error('Collection type mismatch.');
    }
    this._saveSync();
  }
  constructor(options = {}) {
    this.filePath = options.filePath || path.resolve(process.cwd(), 'alphabase.json');
    this.backupDir = options.backupDir || path.resolve(path.dirname(this.filePath), 'backups');
    this.schema = options.schema || null;
    this.password = options.password || null;
    this.encryptionType = options.encryption || 'AES';
    this.ajv = this.schema ? new Ajv() : null;
    this.validator = this.schema ? this.ajv.compile(this.schema) : null;
    this._ensureFile();
    this._loadSync();
    this._backupInterval = null;
    if (options.autoBackupInterval) {
      this.startAutoBackup(options.autoBackupInterval);
    }
    // TTL metadata
    this.ttlMeta = {};
    this._loadTTL();
  }
  

  // Internal: Ensure DB file and backup dir exist
  _ensureFile() {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '{}', 'utf8');
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Internal: Load DB synchronously
  _loadSync() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      let json;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        // Dosya bozuksa veya şifreli ise
        json = null;
      }
      if (json && json._encrypted && json.data) {
        // Şifreli JSON sarmalayıcı
        try {
          const decrypted = encryption.decrypt(json.data, this.password, json.type || this.encryptionType);
          const parsed = JSON.parse(decrypted);
          this.data = parsed.data || {};
          this.ttlMeta = parsed.ttlMeta || {};
        } catch (err) {
          // Şifre çözme başarısız
          this.data = {};
          this.ttlMeta = {};
        }
      } else if (json) {
        this.data = json.data || json;
        this.ttlMeta = json.ttlMeta || {};
      } else if (this.password || this.encryptionType !== 'None') {
        // Eski format: doğrudan şifreli string
        try {
          const decrypted = encryption.decrypt(raw, this.password, this.encryptionType);
          const parsed = JSON.parse(decrypted);
          this.data = parsed.data || {};
          this.ttlMeta = parsed.ttlMeta || {};
        } catch (err) {
          this.data = {};
          this.ttlMeta = {};
        }
      } else {
        this.data = {};
        this.ttlMeta = {};
      }
      this.cleanupSync();
    } catch (e) {
      this.data = {};
      this.ttlMeta = {};
    }
  }

  // Internal: Save DB synchronously
  _saveSync() {
    const getCircularReplacer = () => {
      const seen = new WeakSet();
      return (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      };
    };
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let out;
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    if (effectiveEncryptionType !== 'None') {
      let encrypted;
      if (effectiveEncryptionType === 'Base64') {
        encrypted = base64Encrypt(JSON.stringify(outObj, getCircularReplacer()));
      } else {
        encrypted = encryption.encrypt(JSON.stringify(outObj, getCircularReplacer()), this.password, effectiveEncryptionType);
      }
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, getCircularReplacer(), 2);
    }
    fs.writeFileSync(this.filePath, out, 'utf8');
  }
  // Internal: Load TTL metadata from file if exists
  _loadTTL() {
    if (this.ttlMeta && typeof this.ttlMeta === 'object') {
      this.cleanupSync();
    }
  }

  // Remove expired keys (sync)
  cleanupSync() {
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(this.ttlMeta)) {
      if (this.ttlMeta[key] && this.ttlMeta[key] < now) {
        delete this.data[key];
        delete this.ttlMeta[key];
        changed = true;
      }
    }
    if (changed) this._saveSync();
  }

  async cleanup() {
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(this.ttlMeta)) {
      if (this.ttlMeta[key] && this.ttlMeta[key] < now) {
        delete this.data[key];
        delete this.ttlMeta[key];
        changed = true;
      }
    }
    if (changed) {
      let outObj = { data: this.data, ttlMeta: this.ttlMeta };
      let effectiveEncryptionType = this.encryptionType;
      if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
        effectiveEncryptionType = 'None';
      }
      let out;
      if (effectiveEncryptionType !== 'None') {
        const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
        out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
      } else {
        out = JSON.stringify(outObj, null, 2);
      }
      await fs.promises.writeFile(this.filePath, out, 'utf8');
    }
  }

  getTTL(key) {
    if (!this.ttlMeta[key]) return 0;
    const remaining = this.ttlMeta[key] - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  // Internal: Validate data if schema is set
  _validate(key, value) {
    if (this.validator) {
      const valid = this.validator(value);
      if (!valid) {
        throw new Error(`Schema validation failed for key '${key}': ${JSON.stringify(this.validator.errors)}`);
      }
    }
  }

  // Synchronous methods
  setSync(key, value, options = {}) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    this._validate(key, value);
    // Minimal change history & updatedAt
    if (typeof value === 'object' && value !== null) {
      this._addHistory(value, { type: 'set', value });
    }
    this.data[key] = value;
    if (options.ttl) {
      this.ttlMeta[key] = Date.now() + options.ttl;
    } else {
      delete this.ttlMeta[key];
    }
    this.cleanupSync();
    this._saveSync();
  }

  getSync(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    this.cleanupSync();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      this._saveSync();
      return undefined;
    }
    return this.data[key];
  }

  deleteSync(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    if (this.data[key] && typeof this.data[key] === 'object') {
      this._addHistory(this.data[key], { type: 'delete', value: this.data[key] });
    }
    delete this.data[key];
    delete this.ttlMeta[key];
    this._saveSync();
  }
  /**
   * Set TTL (ms) for a document in a collection (array or object)
   */
  setTTL(collection, id, ttlMs) {
    const col = this.data[collection];
    if (!col) throw new Error('Collection not found');
    let doc;
    if (Array.isArray(col)) {
      doc = col.find(d => d.id === id);
    } else {
      doc = col[id];
    }
    if (!doc) throw new Error('Document not found');
    if (!this.ttlMeta[collection]) this.ttlMeta[collection] = {};
    this.ttlMeta[collection][id] = Date.now() + ttlMs;
    this._saveSync();
  }

  /**
   * Batch atomic operations: [{ op: 'set'|'delete', key, value, options }]
   */
  batchSync(ops) {
    if (!Array.isArray(ops)) throw new TypeError('Batch must be an array');
    for (const op of ops) {
      if (op.op === 'set') {
        this.setSync(op.key, op.value, op.options || {});
      } else if (op.op === 'delete') {
        this.deleteSync(op.key);
      } else {
        throw new Error('Unknown batch operation: ' + op.op);
      }
    }
    this._saveSync();
  }

  cleanupSync() {
    const now = Date.now();
    let changed = false;
    // Support both old and new TTL structure
    for (const key of Object.keys(this.ttlMeta)) {
      if (typeof this.ttlMeta[key] === 'object') {
        // Per-document TTL for collections
        for (const docId of Object.keys(this.ttlMeta[key])) {
          if (this.ttlMeta[key][docId] < now) {
            if (this.data[key]) {
              if (Array.isArray(this.data[key])) {
                const idx = this.data[key].findIndex(d => d.id === docId);
                if (idx !== -1) this.data[key].splice(idx, 1);
              } else {
                delete this.data[key][docId];
              }
            }
            delete this.ttlMeta[key][docId];
            changed = true;
          }
        }
      } else if (this.ttlMeta[key] && this.ttlMeta[key] < now) {
        delete this.data[key];
        delete this.ttlMeta[key];
        changed = true;
      }
    }
    if (changed) this._saveSync();
  }
  statsSync() {
    const stats = fs.statSync(this.filePath);
    const keys = Object.keys(this.data);
    const totalKeys = keys.length;
    let totalValueSize = 0;
    let largestValueSize = 0;
    let largestKey = '';
    for (const key of keys) {
      let valueSize = 0;
      try {
        valueSize = Buffer.byteLength(JSON.stringify(this.data[key]), 'utf8');
      } catch {
        valueSize = 0;
      }
      totalValueSize += valueSize;
      if (valueSize > largestValueSize) largestValueSize = valueSize;
      if (key.length > largestKey.length) largestKey = key;
    }
    const averageValueSize = totalKeys > 0 ? Math.round(totalValueSize / totalKeys) : 0;
    return {
      totalKeys,
      fileSize: stats.size,
      lastModified: new Date(stats.mtime),
      memoryUsage: process.memoryUsage().heapUsed,
      averageValueSize,
      largestKey,
      largestValueSize
    };
  }

  importSync(data, ttlMeta = {}) {
    let importData = data;
    if (typeof data === 'string') {
      try {
        importData = JSON.parse(data);
      } catch (e) {
        // Şifreli JSON olabilir
        try {
          const parsed = JSON.parse(data);
          if (parsed._encrypted && parsed.data) {
            let encType = parsed.type || this.encryptionType;
            let decrypted;
            if (encType === 'Base64') {
              decrypted = base64Decrypt(parsed.data);
            } else {
              decrypted = encryption.decrypt(parsed.data, this.password, encType);
            }
            importData = JSON.parse(decrypted);
          } else {
            throw new Error('Invalid import string');
          }
        } catch (err) {
          throw new Error('Import failed: ' + err.message);
        }
      }
    }
    if (typeof importData !== 'object' || Array.isArray(importData)) {
      throw new TypeError('Import data must be an object or JSON string');
    }
    this.data = { ...(importData.data || importData) };
    this.ttlMeta = { ...(importData.ttlMeta || ttlMeta) };
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let out;
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    fs.writeFileSync(this.filePath, out, 'utf8');
  }

  exportSync(asString = false) {
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    if (asString) return JSON.stringify(outObj, null, 2);
    return { ...this.data };
  }

  backupSync() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${ts}.json`);
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let out;
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    if (effectiveEncryptionType !== 'None') {
      let encrypted;
      if (effectiveEncryptionType === 'Base64') {
        encrypted = base64Encrypt(JSON.stringify(outObj));
      } else {
        encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      }
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    fs.writeFileSync(backupPath, out, 'utf8');
    return backupPath;
  }

  // Asynchronous methods
  async set(key, value, options = {}) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    this._validate(key, value);
    this.data[key] = value;
    if (options.ttl) {
      this.ttlMeta[key] = Date.now() + options.ttl;
    } else {
      delete this.ttlMeta[key];
    }
    await this.cleanup();
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async get(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    await this.cleanup();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      await this._saveSync();
      return undefined;
    }
    return this.data[key];
  }

  async delete(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    delete this.data[key];
    delete this.ttlMeta[key];
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async has(key) {
    if (typeof key !== 'string') throw new TypeError('Key must be a string');
    await this.cleanup();
    if (this.ttlMeta[key] && this.ttlMeta[key] < Date.now()) {
      delete this.data[key];
      delete this.ttlMeta[key];
      await this._saveSync();
      return false;
    }
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  async clear() {
    this.data = {};
    this.ttlMeta = {};
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async all() {
    await this.cleanup();
    const out = {};
    for (const key of Object.keys(this.data)) {
      if (!this.ttlMeta[key] || this.ttlMeta[key] > Date.now()) {
        out[key] = this.data[key];
      }
    }
    return out;
  }

  async stats() {
    const stats = await fs.promises.stat(this.filePath);
    const keys = Object.keys(this.data);
    const totalKeys = keys.length;
    let totalValueSize = 0;
    let largestValueSize = 0;
    let largestKey = '';
    for (const key of keys) {
      let valueSize = 0;
      try {
        valueSize = Buffer.byteLength(JSON.stringify(this.data[key]), 'utf8');
      } catch {
        valueSize = 0;
      }
      totalValueSize += valueSize;
      if (valueSize > largestValueSize) largestValueSize = valueSize;
      if (key.length > largestKey.length) largestKey = key;
    }
    const averageValueSize = totalKeys > 0 ? Math.round(totalValueSize / totalKeys) : 0;
    return {
      totalKeys,
      fileSize: stats.size,
      lastModified: new Date(stats.mtime),
      memoryUsage: process.memoryUsage().heapUsed,
      averageValueSize,
      largestKey,
      largestValueSize
    };
  }

  async import(data, ttlMeta = {}) {
    let importData = data;
    if (typeof data === 'string') {
      try {
        importData = JSON.parse(data);
      } catch (e) {
        // Şifreli JSON olabilir
        try {
          const parsed = JSON.parse(data);
          if (parsed._encrypted && parsed.data) {
            const decrypted = encryption.decrypt(parsed.data, this.password, parsed.type || this.encryptionType);
            importData = JSON.parse(decrypted);
          } else {
            throw new Error('Invalid import string');
          }
        } catch (err) {
          throw new Error('Import failed: ' + err.message);
        }
      }
    }
    if (typeof importData !== 'object' || Array.isArray(importData)) {
      throw new TypeError('Import data must be an object or JSON string');
    }
    this.data = { ...(importData.data || importData) };
    this.ttlMeta = { ...(importData.ttlMeta || ttlMeta) };
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(this.filePath, out, 'utf8');
  }

  async export(asString = false) {
    const outObj = { data: this.data, ttlMeta: this.ttlMeta };
    if (asString) return JSON.stringify(outObj, null, 2);
    return { ...this.data };
  }

  async backup() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${ts}.json`);
    let outObj = { data: this.data, ttlMeta: this.ttlMeta };
    let effectiveEncryptionType = this.encryptionType;
    if ((this.encryptionType === 'AES' || this.encryptionType === 'XOR') && !this.password) {
      effectiveEncryptionType = 'None';
    }
    let out;
    if (effectiveEncryptionType !== 'None') {
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
      out = JSON.stringify({ _encrypted: true, type: effectiveEncryptionType, data: encrypted });
    } else {
      out = JSON.stringify(outObj, null, 2);
    }
    await fs.promises.writeFile(backupPath, out, 'utf8');
    return backupPath;
  }

  startAutoBackup(intervalMs) {
    if (this._backupInterval) clearInterval(this._backupInterval);
    this._backupInterval = setInterval(() => {
      try {
        this.backupSync();
      } catch (e) {
        // Ignore backup errors
      }
    }, intervalMs);
  }

  stopAutoBackup() {
    if (this._backupInterval) clearInterval(this._backupInterval);
    this._backupInterval = null;
  }
}

module.exports = AlphaBase;
