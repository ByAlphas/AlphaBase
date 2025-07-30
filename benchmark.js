// AlphaBase only benchmark
const AlphaBase = require('./index');
const fs = require('fs');
const path = require('path');

const COUNT = 1000;
const TMP = './bench_tmp/';
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP);

async function cleanFile(file) {
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
}

async function benchAlphaBase() {
  const file = path.join(TMP, 'alphabase.json');
  await cleanFile(file);
  const db = new AlphaBase({ filePath: file });
  const t0 = Date.now();
  for (let i = 0; i < COUNT; i++) await db.set('key' + i, { val: i });
  const write = Date.now() - t0;
  const t1 = Date.now();
  for (let i = 0; i < COUNT; i++) await db.get('key' + i);
  const read = Date.now() - t1;
  await cleanFile(file);
  return { write, read };
}

(async () => {
  console.log('AlphaBase benchmark started (1000 write/read)...\n');
  const { write, read } = await benchAlphaBase();
  console.log(`Write time (total): ${write} ms`);
  console.log(`Read time (total): ${read} ms`);
  console.log(`Write (average): ${(write/COUNT).toFixed(2)} ms`);
  console.log(`Read (average): ${(read/COUNT).toFixed(2)} ms`);
})();
