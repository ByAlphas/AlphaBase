const express = require('express');
const path = require('path');
const fs = require('fs');
const AlphaBase = require('./index');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = process.cwd();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let currentFile = path.join(DB_DIR, 'alphabase.json');
let db = new AlphaBase({ filePath: currentFile });

function getDbFiles() {
  return fs.readdirSync(DB_DIR).filter(f => f.endsWith('.json'));
}

app.get('/api/files', (req, res) => {
  res.json(getDbFiles());
});

app.post('/api/switch', (req, res) => {
  const { file } = req.body;
  if (!file || !fs.existsSync(path.join(DB_DIR, file))) return res.status(400).json({ error: 'File not found' });
  currentFile = path.join(DB_DIR, file);
  db = new AlphaBase({ filePath: currentFile });
  res.json({ success: true });
});

app.get('/api/all', (req, res) => {
  res.json(db.allSync());
});

app.get('/api/stats', (req, res) => {
  res.json(db.statsSync());
});

app.post('/api/set', (req, res) => {
  const { key, value } = req.body;
  try {
    db.setSync(key, value);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/delete', (req, res) => {
  const { key } = req.body;
  db.deleteSync(key);
  res.json({ success: true });
});

app.post('/api/clear', (req, res) => {
  db.clearSync();
  res.json({ success: true });
});

app.get('/api/search', (req, res) => {
  const { q } = req.query;
  const all = db.allSync();
  const result = Object.entries(all).filter(([k, v]) => k.includes(q) || JSON.stringify(v).includes(q));
  res.json(Object.fromEntries(result));
});

app.post('/api/backup', (req, res) => {
  const backupPath = db.backupSync();
  res.json({ backupPath });
});

app.get('/api/export', (req, res) => {
  res.json(db.exportSync());
});

app.listen(PORT, () => {
  console.log(`AlphaBase Dashboard running at http://localhost:${PORT}`);
});
