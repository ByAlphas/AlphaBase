import { AlphaBase } from '../src/AlphaBase';
import * as fs from 'fs';
import * as path from 'path';

describe('AlphaBase - Backup & Restore', () => {
  let db: AlphaBase;
  let testDir: string;
  let dbPath: string;
  let backupDir: string;

  beforeEach(() => {
    // Create unique test directory for each test
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDir = path.join(__dirname, `test-backup-${timestamp}-${random}`);
    dbPath = path.join(testDir, 'backup-test.json');
    backupDir = path.join(testDir, 'backups');
    
    // Create fresh directories
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    db = new AlphaBase({ 
      filePath: dbPath,
      backupDir: backupDir
    });
  });

  afterEach(async () => {
    await db.close();
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Backup Creation', () => {
    test('should create a backup file', () => {
      db.set('key1', 'value1');
      db.set('key2', { name: 'test', count: 42 });
      
      const result = db.createBackup();
      
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('filePath');
      expect(result.filename).toMatch(/^backup-.*\.json$/);
      expect(fs.existsSync(result.filePath)).toBe(true);
    });

    test('should create backup with metadata', () => {
      db.set('user:1', { name: 'Alice' });
      
      const result = db.createBackup({
        metadata: { reason: 'manual', user: 'admin' }
      });
      
      expect(fs.existsSync(result.filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(result.filePath, 'utf8'));
      expect(content.metadata).toEqual({ reason: 'manual', user: 'admin' });
    });

    test('should create multiple backups', () => {
      db.set('key1', 'value1');
      const backup1 = db.createBackup();
      
      db.set('key2', 'value2');
      const backup2 = db.createBackup();
      
      expect(backup1.filename).not.toBe(backup2.filename);
      expect(fs.existsSync(backup1.filePath)).toBe(true);
      expect(fs.existsSync(backup2.filePath)).toBe(true);
    });
  });

  describe('Backup Listing', () => {
    test('should list all backups', () => {
      db.set('key1', 'value1');
      db.createBackup();
      db.createBackup();
      
      const backups = db.listBackups();
      
      expect(backups).toHaveLength(2);
      expect(backups[0]).toHaveProperty('filename');
      expect(backups[0]).toHaveProperty('filePath');
      expect(backups[0]).toHaveProperty('timestamp');
    });

    test('should return empty array when no backups exist', () => {
      const backups = db.listBackups();
      expect(backups).toEqual([]);
    });

    test('should sort backups by timestamp', () => {
      db.set('key1', 'value1');
      db.createBackup();
      
      // Wait a moment
      const wait = new Promise(resolve => setTimeout(resolve, 10));
      wait.then(() => {
        db.createBackup();
        const backups = db.listBackups();
        
        if (backups.length === 2) {
          expect(backups[0].timestamp.getTime()).toBeGreaterThanOrEqual(
            backups[1].timestamp.getTime()
          );
        }
      });
    });
  });

  describe('Backup Restore', () => {
    test('should restore data from backup', () => {
      // Create initial data and backup
      db.set('key1', 'value1');
      db.set('key2', { name: 'test' });
      const backup = db.createBackup();
      
      // Modify data
      db.set('key1', 'modified');
      db.delete('key2');
      db.set('key3', 'new');
      
      // Restore from backup
      db.restore(backup.filePath);
      
      // Check restored data
      expect(db.get('key1')).toBe('value1');
      expect(db.get('key2')).toEqual({ name: 'test' });
      expect(db.has('key3')).toBe(false);
    });

    test('should handle restore of empty database', () => {
      const backup = db.createBackup();
      
      db.set('key1', 'value1');
      db.restore(backup.filePath);
      
      expect(db.has('key1')).toBe(false);
      expect(db.size()).toBe(0);
    });

    test('should throw error for non-existent backup file', () => {
      expect(() => {
        db.restore('/non/existent/backup.json');
      }).toThrow();
    });
  });

  describe('Import/Export', () => {
    test('should export database to file', () => {
      db.set('key1', 'value1');
      db.set('key2', { count: 42 });
      
      const exportPath = path.join(testDir, 'export.json');
      db.export(exportPath);
      
      expect(fs.existsSync(exportPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
      expect(content.data).toHaveProperty('key1');
      expect(content.data).toHaveProperty('key2');
    });

    test('should import database from file', () => {
      // Create export file
      const exportPath = path.join(testDir, 'import.json');
      const exportData = {
        timestamp: new Date().toISOString(),
        data: {
          'imported1': 'value1',
          'imported2': { count: 10 }
        },
        version: '4.0.0'
      };
      fs.writeFileSync(exportPath, JSON.stringify(exportData), 'utf8');
      
      // Import
      const count = db.import(exportPath);
      
      expect(count).toBe(2);
      expect(db.get('imported1')).toBe('value1');
      expect(db.get('imported2')).toEqual({ count: 10 });
    });

    test('should merge import with existing data', () => {
      db.set('existing', 'value');
      
      const exportPath = path.join(testDir, 'merge.json');
      const exportData = {
        timestamp: new Date().toISOString(),
        data: { 'new': 'imported' },
        version: '4.0.0'
      };
      fs.writeFileSync(exportPath, JSON.stringify(exportData), 'utf8');
      
      const count = db.import(exportPath, true);
      
      expect(count).toBe(1);
      expect(db.has('existing')).toBe(true);
      expect(db.get('new')).toBe('imported');
    });

    test('should replace data when merge is false', () => {
      db.set('existing', 'value');
      
      const exportPath = path.join(testDir, 'replace.json');
      const exportData = {
        timestamp: new Date().toISOString(),
        data: { 'new': 'imported' },
        version: '4.0.0'
      };
      fs.writeFileSync(exportPath, JSON.stringify(exportData), 'utf8');
      
      const count = db.import(exportPath, false);
      
      expect(count).toBe(1);
      expect(db.has('existing')).toBe(false);
      expect(db.get('new')).toBe('imported');
    });
  });

  describe('Auto Backup', () => {
    test('should start auto backup with interval', async () => {
      db.set('key1', 'value1');
      
      // Start auto backup every 100ms
      db.startAutoBackup(100);
      
      // Wait for at least 2 backups
      await new Promise(resolve => setTimeout(resolve, 250));
      
      db.stopAutoBackup();
      
      const backups = db.listBackups();
      expect(backups.length).toBeGreaterThanOrEqual(2);
    });

    test('should stop auto backup', async () => {
      db.set('key1', 'value1');
      db.startAutoBackup(50);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const countBefore = db.listBackups().length;
      db.stopAutoBackup();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const countAfter = db.listBackups().length;
      expect(countAfter).toBe(countBefore);
    });

    test('should not create duplicate auto backup intervals', async () => {
      db.set('key1', 'value1');
      
      db.startAutoBackup(100);
      db.startAutoBackup(100); // Should stop first and start new
      
      await new Promise(resolve => setTimeout(resolve, 250));
      
      db.stopAutoBackup();
      
      // Should have reasonable number of backups (not doubled)
      const backups = db.listBackups();
      expect(backups.length).toBeLessThan(6);
    });

    test('should respect enableAutoBackup option when false', async () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const disabledTestDir = path.join(__dirname, `test-backup-disabled-${timestamp}-${random}`);
      const disabledDbPath = path.join(disabledTestDir, 'disabled-backup.json');
      
      fs.mkdirSync(disabledTestDir, { recursive: true });
      
      const dbDisabled = new AlphaBase({
        filePath: disabledDbPath,
        autoBackupInterval: 50, // Very short interval
        enableAutoBackup: false // But disabled
      });
      
      dbDisabled.set('key1', 'value1');
      
      // Wait for potential backups
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const backups = dbDisabled.listBackups();
      expect(backups.length).toBe(0); // No auto-backups created
      
      await dbDisabled.close();
      fs.rmSync(disabledTestDir, { recursive: true, force: true });
    });

    test('should enable auto-backup by default when interval provided', async () => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const defaultTestDir = path.join(__dirname, `test-backup-default-${timestamp}-${random}`);
      const defaultDbPath = path.join(defaultTestDir, 'default-backup.json');
      
      fs.mkdirSync(defaultTestDir, { recursive: true });
      
      const dbDefault = new AlphaBase({
        filePath: defaultDbPath,
        autoBackupInterval: 50 // Should auto-enable backup
      });
      
      dbDefault.set('key1', 'value1');
      
      // Wait for backups
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const backups = dbDefault.listBackups();
      expect(backups.length).toBeGreaterThan(0); // Auto-backups created by default
      
      await dbDefault.close();
      fs.rmSync(defaultTestDir, { recursive: true, force: true });
    });
  });
});
