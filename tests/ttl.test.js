const AlphaBase = require('../index');
const path = require('path');
const fs = require('fs');

describe('AlphaBase TTL', () => {
  const testFile = path.resolve(__dirname, 'ttltest.json');
  let db;

  beforeEach(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    db = new AlphaBase({ filePath: testFile });
  });

  afterAll(() => {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  test('set/get with TTL', async () => {
    await db.set('temp', 'val', { ttl: 100 });
    expect(await db.get('temp')).toBe('val');
    await new Promise(r => setTimeout(r, 150));
    expect(await db.get('temp')).toBeUndefined();
  });

  test('getTTL returns remaining time', async () => {
    await db.set('temp', 'val', { ttl: 200 });
    const ttl = db.getTTL('temp');
    expect(ttl).toBeGreaterThan(0);
    await new Promise(r => setTimeout(r, 210));
    expect(db.getTTL('temp')).toBe(0);
  });

  test('cleanup removes expired keys', async () => {
    await db.set('a', 1, { ttl: 50 });
    await db.set('b', 2);
    await new Promise(r => setTimeout(r, 80));
    db.cleanupSync();
    // Dosya işlemi tamamlanana kadar bekleme süresini artır
    await new Promise(r => setTimeout(r, 30));
    expect(db.hasSync('a')).toBe(false);
    expect(db.hasSync('b')).toBe(true);
  });
});
