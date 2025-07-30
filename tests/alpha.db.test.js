const fs = require('fs');
const path = require('path');
const AlphaBase = require('../index');

describe('AlphaBase', () => {
  const testFile = path.resolve(__dirname, 'testdb.json');
  let db;

  beforeEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    db = new AlphaBase({ filePath: testFile });
  });

  afterAll(() => {
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
});
