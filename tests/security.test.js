const { JWTAuth, AuditLogger, DataIntegrity, RSAEncryption } = require('../security');
const fs = require('fs');
const path = require('path');

describe('Security Module Tests', () => {
  const testDir = path.join(__dirname, 'test-security');
  const testLogFile = path.join(testDir, 'test-audit.log');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testLogFile)) {
        fs.unlinkSync(testLogFile);
      }
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('JWTAuth', () => {
    let jwtAuth;

    beforeEach(() => {
      jwtAuth = new JWTAuth('test-secret');
    });

    test('should create and verify token', () => {
      const payload = { userId: 123, username: 'testuser' };
      const token = jwtAuth.createToken(payload);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      const result = jwtAuth.verifyToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload.userId).toBe(123);
      expect(result.payload.username).toBe('testuser');
    });

    test('should reject invalid token', () => {
      const result = jwtAuth.verifyToken('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should create token with expiration', () => {
      const payload = { userId: 123 };
      const token = jwtAuth.createToken(payload, { expiresIn: '1h' });
      
      const result = jwtAuth.verifyToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload.exp).toBeDefined();
    });
  });

  describe('AuditLogger', () => {
    let auditLogger;

    beforeEach(() => {
      auditLogger = new AuditLogger({
        enabled: true,
        logFile: testLogFile
      });
    });

    test('should log operations', () => {
      auditLogger.log('set', 'testkey', 'testuser', { value: 'testvalue' });
      
      expect(fs.existsSync(testLogFile)).toBe(true);
      const logContent = fs.readFileSync(testLogFile, 'utf8');
      expect(logContent).toContain('set');
      expect(logContent).toContain('testkey');
      expect(logContent).toContain('testuser');
    });

    test('should retrieve logs', () => {
      auditLogger.log('set', 'key1', 'user1');
      auditLogger.log('get', 'key2', 'user2');
      
      const logs = auditLogger.getLogs();
      expect(logs.length).toBe(2);
      expect(logs[0].operation).toBe('get'); // Most recent first
      expect(logs[1].operation).toBe('set');
    });

    test('should filter logs by operation', () => {
      auditLogger.log('set', 'key1', 'user1');
      auditLogger.log('get', 'key2', 'user2');
      auditLogger.log('set', 'key3', 'user3');
      
      const setLogs = auditLogger.getLogs({ operation: 'set' });
      expect(setLogs.length).toBe(2);
      expect(setLogs.every(log => log.operation === 'set')).toBe(true);
    });

    test('should not log when disabled', () => {
      const disabledLogger = new AuditLogger({ enabled: false });
      disabledLogger.log('set', 'key', 'user');
      
      // Should not create any files
      expect(fs.existsSync(testLogFile)).toBe(false);
    });
  });

  describe('DataIntegrity', () => {
    let dataIntegrity;

    beforeEach(() => {
      dataIntegrity = new DataIntegrity();
    });

    test('should generate hash', () => {
      const data = 'test data';
      const hash = dataIntegrity.generateHash(data);
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 hex length
    });

    test('should verify data integrity', () => {
      const data = 'test data';
      const hash = dataIntegrity.generateHash(data);
      
      expect(dataIntegrity.verify(data, hash)).toBe(true);
      expect(dataIntegrity.verify('modified data', hash)).toBe(false);
    });

    test('should handle empty data', () => {
      const hash = dataIntegrity.generateHash('');
      expect(dataIntegrity.verify('', hash)).toBe(true);
    });

    test('should handle null/undefined', () => {
      expect(() => dataIntegrity.generateHash(null)).toThrow();
      expect(() => dataIntegrity.generateHash(undefined)).toThrow();
    });
  });

  describe('RSAEncryption', () => {
    let rsaEncryption;

    beforeEach(() => {
      rsaEncryption = new RSAEncryption();
    });

    test('should generate key pair', () => {
      const keyPair = rsaEncryption.generateKeyPair();
      
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(typeof keyPair.publicKey).toBe('string');
      expect(typeof keyPair.privateKey).toBe('string');
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    });

    test('should encrypt and decrypt data', () => {
      const keyPair = rsaEncryption.generateKeyPair();
      const data = 'Hello, World!';
      
      const encrypted = rsaEncryption.encrypt(data, keyPair.publicKey);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(data);
      
      const decrypted = rsaEncryption.decrypt(encrypted, keyPair.privateKey);
      expect(decrypted).toBe(data);
    });

    test('should handle data within RSA limits', () => {
      const keyPair = rsaEncryption.generateKeyPair();
      // Test with data that fits in one RSA block
      const normalData = 'This is a normal message that fits in RSA block size';
      
      const encrypted = rsaEncryption.encrypt(normalData, keyPair.publicKey);
      const decrypted = rsaEncryption.decrypt(encrypted, keyPair.privateKey);
      
      expect(decrypted).toBe(normalData);
    });

    test('should throw error with invalid keys', () => {
      expect(() => {
        rsaEncryption.encrypt('data', 'invalid-key');
      }).toThrow();

      expect(() => {
        rsaEncryption.decrypt('data', 'invalid-key');
      }).toThrow();
    });
  });
});
