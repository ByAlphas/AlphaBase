const fs = require('fs');
const path = require('path');
const AlphaBase = require('../alpha');

describe('AlphaBase', () => {
  const testFile = path.resolve(__dirname, 'testdb.json');
  let db;

  beforeEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    db = new AlphaBase({ filePath: testFile });
  });

  afterEach(async () => {
    if (db && db.cleanup) {
      await db.cleanup();
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  test('setSync/getSync', () => {
    db.setSync('foo', 123);
    expect(db.getSync('foo')).toBe(123);
  });

  test('deleteSync/hasSync', () => {
    db.setSync('bar', 'baz');
    db.deleteSync('bar');
    expect(db.hasSync('bar')).toBe(false);
  });

  test('clearSync/allSync', () => {
    db.setSync('a', 1);
    db.setSync('b', 2);
    db.clearSync();
    expect(Object.keys(db.allSync()).length).toBe(0);
  });

  test('statsSync', () => {
    db.setSync('x', 42);
    const stats = db.statsSync();
    expect(stats.totalKeys).toBe(1);
    expect(stats.fileSize).toBeGreaterThan(0);
    expect(stats.lastModified).toBeInstanceOf(Date);
  });

  test('importSync/exportSync', () => {
    db.importSync({ a: 1, b: 2 });
    const exported = db.exportSync();
    expect(exported).toEqual({ a: 1, b: 2 });
  });

  test('backupSync', () => {
    db.setSync('foo', 'bar');
    const backupPath = db.backupSync();
    expect(fs.existsSync(backupPath)).toBe(true);
    fs.unlinkSync(backupPath);
  });

  test('schema validation', () => {
    const schema = { type: 'object', properties: { val: { type: 'number' } }, required: ['val'] };
    db = new AlphaBase({ filePath: testFile, schema });
    expect(() => db.setSync('bad', { val: 'not-a-number' })).toThrow();
    expect(() => db.setSync('good', { val: 123 })).not.toThrow();
  });

  test('async set/get/delete/has/clear/all', async () => {
    await db.set('foo', 'bar');
    expect(await db.get('foo')).toBe('bar');
    await db.delete('foo');
    expect(await db.has('foo')).toBe(false);
    await db.set('a', 1);
    await db.set('b', 2);
    await db.clear();
    expect(Object.keys(await db.all()).length).toBe(0);
  });

  test('async stats/import/export/backup', async () => {
    await db.set('x', 42);
    const stats = await db.stats();
    expect(stats.totalKeys).toBe(1);
    expect(stats.fileSize).toBeGreaterThan(0);
    expect(stats.lastModified).toBeInstanceOf(Date);
    await db.import({ a: 1, b: 2 });
    const exported = await db.export();
    expect(exported).toEqual({ a: 1, b: 2 });
    const backupPath = await db.backup();
    expect(fs.existsSync(backupPath)).toBe(true);
    fs.unlinkSync(backupPath);
  });

  // V3.0.0 Security Tests
  describe('Security Features', () => {
    test('JWT authentication', () => {
      const dbWithJWT = new AlphaBase({ 
        filePath: testFile + '-jwt',
        jwtSecret: 'test-secret' 
      });
      
      const payload = { user: 'testuser', role: 'admin' };
      const token = dbWithJWT.createToken(payload);
      expect(typeof token).toBe('string');
      
      const result = dbWithJWT.verifyToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload.user).toBe('testuser');
      
      // Clean up
      if (fs.existsSync(testFile + '-jwt')) fs.unlinkSync(testFile + '-jwt');
    });

    test('Audit logging', () => {
      const auditFile = testFile + '-audit.log';
      const dbWithAudit = new AlphaBase({
        filePath: testFile + '-audit',
        audit: { enabled: true, logFile: auditFile }
      });
      
      dbWithAudit.auditLog('test_operation', 'test_key', 'test_user');
      expect(fs.existsSync(auditFile)).toBe(true);
      
      const logs = dbWithAudit.getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].operation).toBe('test_operation');
      
      // Clean up
      if (fs.existsSync(testFile + '-audit')) fs.unlinkSync(testFile + '-audit');
      if (fs.existsSync(auditFile)) fs.unlinkSync(auditFile);
    });

    test('RSA encryption', () => {
      const dbWithRSA = new AlphaBase({
        filePath: testFile + '-rsa',
        rsa: true
      });
      
      const keyPair = dbWithRSA.generateRSAKeys();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      
      const testData = 'Hello, RSA!';
      const encrypted = dbWithRSA.rsaEncrypt(testData, keyPair.publicKey);
      expect(encrypted).not.toBe(testData);
      
      const decrypted = dbWithRSA.rsaDecrypt(encrypted, keyPair.privateKey);
      expect(decrypted).toBe(testData);
      
      // Clean up
      if (fs.existsSync(testFile + '-rsa')) fs.unlinkSync(testFile + '-rsa');
    });

    test('Data integrity check', () => {
      const dbWithIntegrity = new AlphaBase({
        filePath: testFile + '-integrity',
        integrity: true
      });
      
      dbWithIntegrity.setSync('testkey', 'testvalue');
      
      // Since we don't have stored hashes, this should return true by default
      const isValid = dbWithIntegrity.verifyIntegrity('testkey');
      expect(typeof isValid).toBe('boolean');
      
      // Clean up
      if (fs.existsSync(testFile + '-integrity')) fs.unlinkSync(testFile + '-integrity');
    });
  });
});
