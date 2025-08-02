const crypto = require('crypto');

/**
 * JWT Authentication Handler
 * Simple JWT implementation without external dependencies
 */
class JWTAuth {
  constructor(secret) {
    this.secret = secret || crypto.randomBytes(32).toString('hex');
  }

  // Create JWT token
  createToken(payload, options = {}) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = options.expiresIn || '1h';
    const exp = this._parseExpiration(expiresIn);
    
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + exp
    };

    const encodedHeader = this._base64URLEncode(JSON.stringify(header));
    const encodedPayload = this._base64URLEncode(JSON.stringify(tokenPayload));
    const signature = this._createSignature(encodedHeader + '.' + encodedPayload);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token format' };
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      const expectedSignature = this._createSignature(encodedHeader + '.' + encodedPayload);
      
      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
      }

      const payload = JSON.parse(this._base64URLDecode(encodedPayload));
      
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Token expired' };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  _createSignature(data) {
    return crypto.createHmac('sha256', this.secret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  _base64URLEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  _base64URLDecode(str) {
    str += '==='.slice(0, (4 - str.length % 4) % 4);
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  _parseExpiration(expiresIn) {
    if (typeof expiresIn === 'number') return expiresIn;
    if (typeof expiresIn !== 'string') return 3600;
    
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 3600;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600;
    }
  }
}

/**
 * Audit Logger
 * Simple file-based audit logging
 */
class AuditLogger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.logFile = options.logFile || './alphabase-audit.log';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
  }

  log(operation, key, user, metadata = {}) {
    if (!this.enabled) return;

    const fs = require('fs');
    const path = require('path');

    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      key,
      user,
      metadata
    };

    try {
      // Ensure directory exists
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Rotate log if needed
      this._rotateLogIfNeeded();

      // Append log entry
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.warn('Failed to write audit log:', error.message);
    }
  }

  getLogs(options = {}) {
    const fs = require('fs');
    try {
      if (!fs.existsSync(this.logFile)) return [];
      
      const content = fs.readFileSync(this.logFile, 'utf8');
      if (!content.trim()) return [];
      
      const lines = content.trim().split('\n');
      let logs = lines.map(line => JSON.parse(line)).reverse();
      
      // Apply filters
      if (options.operation) {
        logs = logs.filter(log => log.operation === options.operation);
      }
      
      if (options.user) {
        logs = logs.filter(log => log.user === options.user);
      }
      
      if (options.limit) {
        logs = logs.slice(0, options.limit);
      }
      
      return logs;
    } catch (error) {
      console.warn('Failed to read audit logs:', error.message);
      return [];
    }
  }

  _rotateLogIfNeeded() {
    const fs = require('fs');
    try {
      if (!fs.existsSync(this.logFile)) return;
      
      const stats = fs.statSync(this.logFile);
      if (stats.size >= this.maxFileSize) {
        // Rotate logs
        for (let i = this.maxFiles - 1; i > 0; i--) {
          const oldFile = `${this.logFile}.${i}`;
          const newFile = `${this.logFile}.${i + 1}`;
          if (fs.existsSync(oldFile)) {
            fs.renameSync(oldFile, newFile);
          }
        }
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.warn('Failed to rotate audit log:', error.message);
    }
  }
}

/**
 * Data Integrity Checker
 * Simple SHA256 checksum verification
 */
class DataIntegrity {
  constructor() {
    // Simple in-memory implementation
  }

  generateHash(data) {
    if (data == null) throw new Error('Data cannot be null or undefined');
    return crypto.createHash('sha256').update(String(data)).digest('hex');
  }

  verify(data, expectedHash) {
    if (!expectedHash) return false;
    const actualHash = this.generateHash(data);
    return actualHash === expectedHash;
  }
}

/**
 * RSA Encryption Handler
 * Simple RSA key generation and encryption/decryption
 */
class RSAEncryption {
  constructor() {
    // No initialization needed
  }

  generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  encrypt(data, publicKey) {
    try {
      // For large data, we would need to chunk it
      // For simplicity, assuming data fits in one RSA block
      const buffer = Buffer.from(data, 'utf8');
      const encrypted = crypto.publicEncrypt(publicKey, buffer);
      return encrypted.toString('base64');
    } catch (error) {
      throw new Error(`RSA encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedData, privateKey) {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      const decrypted = crypto.privateDecrypt(privateKey, buffer);
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`RSA decryption failed: ${error.message}`);
    }
  }
}

module.exports = {
  JWTAuth,
  AuditLogger,
  DataIntegrity,
  RSAEncryption
};
