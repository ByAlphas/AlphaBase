const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const encryption = require('./encryption');

class AlphaBase {
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
    delete this.data[key];
    delete this.ttlMeta[key];
    this._saveSync();
  }

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

  clearSync() {
    this.data = {};
    this.ttlMeta = {};
    this._saveSync();
  }

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
      const encrypted = encryption.encrypt(JSON.stringify(outObj), this.password, effectiveEncryptionType);
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
