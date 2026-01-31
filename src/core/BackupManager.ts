import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { BackupError, FileOperationError, ValidationError } from '../errors';

/**
 * Backup metadata
 */
export interface BackupMetadata {
  filename: string;
  filePath: string;
  timestamp: Date;
  size: number;
  keys: number;
}

/**
 * Backup options
 */
export interface BackupOptions {
  compress?: boolean;
  encrypt?: boolean;
  metadata?: Record<string, unknown>;
  /** Maximum number of backups to keep (oldest will be deleted automatically) */
  maxBackups?: number;
}

/**
 * Backup Manager
 * Handles database backup, restore, and backup management
 */
export class BackupManager {
  private readonly dataRef: Record<string, unknown>;
  private readonly backupDir: string;
  private autoBackupInterval: NodeJS.Timeout | null;

  constructor(dataRef: Record<string, unknown>, backupDir: string) {
    this.dataRef = dataRef;
    this.backupDir = backupDir;
    this.autoBackupInterval = null;

    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists (synchronous - legacy)
   * @deprecated Use ensureBackupDirAsync() instead
   */
  private ensureBackupDir(): void {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (error) {
      throw new FileOperationError('ensure_backup_dir', this.backupDir, error as Error);
    }
  }

  /**
   * Ensure backup directory exists (async - recommended)
   */
  private async ensureBackupDirAsync(): Promise<void> {
    try {
      try {
        await fsPromises.access(this.backupDir);
      } catch {
        await fsPromises.mkdir(this.backupDir, { recursive: true });
      }
    } catch (error) {
      throw new FileOperationError('ensure_backup_dir', this.backupDir, error as Error);
    }
  }

  /**
   * Create a backup (synchronous - legacy)
   * @deprecated Use createAsync() instead
   */
  public create(options: BackupOptions = {}): BackupMetadata {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = path.join(this.backupDir, filename);

    try {
      const backup = {
        timestamp: new Date().toISOString(),
        data: this.dataRef,
        metadata: options.metadata || {},
        version: '4.0.0'
      };

      const content = JSON.stringify(backup, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');

      const stats = fs.statSync(filePath);

      const result = {
        filename,
        filePath,
        timestamp: new Date(),
        size: stats.size,
        keys: Object.keys(this.dataRef).length
      };

      // Auto-cleanup old backups if maxBackups is set
      if (options.maxBackups && options.maxBackups > 0) {
        const backups = this.list();
        if (backups.length > options.maxBackups) {
          const toDelete = backups.slice(options.maxBackups);
          for (const backup of toDelete) {
            try {
              this.delete(backup.filename);
            } catch (err) {
              // Continue even if deletion fails
              console.warn(`Failed to delete old backup ${backup.filename}:`, err);
            }
          }
        }
      }

      return result;
    } catch (error) {
      throw new BackupError('create', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * Create a backup (async - recommended)
   */
  public async createAsync(options: BackupOptions = {}): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = path.join(this.backupDir, filename);

    try {
      await this.ensureBackupDirAsync();

      const backup = {
        timestamp: new Date().toISOString(),
        data: this.dataRef,
        metadata: options.metadata || {},
        version: '4.0.0'
      };

      const content = JSON.stringify(backup, null, 2);
      await fsPromises.writeFile(filePath, content, 'utf8');

      const stats = await fsPromises.stat(filePath);

      const result = {
        filename,
        filePath,
        timestamp: new Date(),
        size: stats.size,
        keys: Object.keys(this.dataRef).length
      };

      // Auto-cleanup old backups if maxBackups is set
      if (options.maxBackups && options.maxBackups > 0) {
        const backups = await this.listAsync();
        if (backups.length > options.maxBackups) {
          const toDelete = backups.slice(options.maxBackups);
          for (const backup of toDelete) {
            try {
              await this.deleteAsync(backup.filename);
            } catch (err) {
              // Continue even if deletion fails
              console.warn(`Failed to delete old backup ${backup.filename}:`, err);
            }
          }
        }
      }

      return result;
    } catch (error) {
      throw new BackupError('create', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * Restore from a backup file (synchronous - legacy)
   * @deprecated Use restoreAsync() instead
   */
  public restore(backupFile: string): void {
    const filePath = path.isAbsolute(backupFile)
      ? backupFile
      : path.join(this.backupDir, backupFile);

    try {
      if (!fs.existsSync(filePath)) {
        throw new BackupError('restore', {
          filePath,
          reason: 'Backup file does not exist'
        });
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      // Support both old and new backup formats
      const data = parsed.data || parsed;

      // Clear current data
      const keys = Object.keys(this.dataRef);
      for (const key of keys) {
        delete this.dataRef[key];
      }

      // Restore from backup
      for (const [key, value] of Object.entries(data)) {
        this.dataRef[key] = value;
      }
    } catch (error) {
      if (error instanceof BackupError) {
        throw error;
      }
      throw new BackupError('restore', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * Restore from a backup file (async - recommended)
   */
  public async restoreAsync(backupFile: string): Promise<void> {
    const filePath = path.isAbsolute(backupFile)
      ? backupFile
      : path.join(this.backupDir, backupFile);

    try {
      try {
        await fsPromises.access(filePath);
      } catch {
        throw new BackupError('restore', {
          filePath,
          reason: 'Backup file does not exist'
        });
      }

      const raw = await fsPromises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      // Support both old and new backup formats
      const data = parsed.data || parsed;

      // Clear current data
      const keys = Object.keys(this.dataRef);
      for (const key of keys) {
        delete this.dataRef[key];
      }

      // Restore from backup
      for (const [key, value] of Object.entries(data)) {
        this.dataRef[key] = value;
      }
    } catch (error) {
      if (error instanceof BackupError) {
        throw error;
      }
      throw new BackupError('restore', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * List all backups (synchronous - legacy)
   * @deprecated Use listAsync() instead
   */
  public list(): BackupMetadata[] {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .sort()
        .reverse();

      return files.map(filename => {
        const filePath = path.join(this.backupDir, filename);
        const stats = fs.statSync(filePath);

        // Try to read backup metadata
        let keys = 0;
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          const data = parsed.data || parsed;
          keys = Object.keys(data).length;
        } catch {
          // If parsing fails, keys remain 0
        }

        return {
          filename,
          filePath,
          timestamp: stats.mtime,
          size: stats.size,
          keys
        };
      });
    } catch (error) {
      throw new BackupError('list', {
        backupDir: this.backupDir,
        error: (error as Error).message
      });
    }
  }

  /**
   * List all backups (async - recommended)
   */
  public async listAsync(): Promise<BackupMetadata[]> {
    try {
      try {
        await fsPromises.access(this.backupDir);
      } catch {
        return [];
      }

      const allFiles = await fsPromises.readdir(this.backupDir);
      const files = allFiles
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .sort()
        .reverse();

      const backupList = await Promise.all(files.map(async filename => {
        const filePath = path.join(this.backupDir, filename);
        const stats = await fsPromises.stat(filePath);

        // Try to read backup metadata
        let keys = 0;
        try {
          const raw = await fsPromises.readFile(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          const data = parsed.data || parsed;
          keys = Object.keys(data).length;
        } catch {
          // If parsing fails, keys remain 0
        }

        return {
          filename,
          filePath,
          timestamp: stats.mtime,
          size: stats.size,
          keys
        };
      }));

      return backupList;
    } catch (error) {
      throw new BackupError('list', {
        backupDir: this.backupDir,
        error: (error as Error).message
      });
    }
  }

  /**
   * Delete a backup file (synchronous - legacy)
   * @deprecated Use deleteAsync() instead
   */
  public delete(backupFile: string): void {
    const filePath = path.isAbsolute(backupFile)
      ? backupFile
      : path.join(this.backupDir, backupFile);

    try {
      if (!fs.existsSync(filePath)) {
        throw new BackupError('delete', {
          filePath,
          reason: 'Backup file does not exist'
        });
      }

      fs.unlinkSync(filePath);
    } catch (error) {
      if (error instanceof BackupError) {
        throw error;
      }
      throw new BackupError('delete', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * Delete a backup file (async - recommended)
   */
  public async deleteAsync(backupFile: string): Promise<void> {
    const filePath = path.isAbsolute(backupFile)
      ? backupFile
      : path.join(this.backupDir, backupFile);

    try {
      try {
        await fsPromises.access(filePath);
      } catch {
        throw new BackupError('delete', {
          filePath,
          reason: 'Backup file does not exist'
        });
      }

      await fsPromises.unlink(filePath);
    } catch (error) {
      if (error instanceof BackupError) {
        throw error;
      }
      throw new BackupError('delete', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * Delete old backups, keeping only the most recent N backups
   */
  public prune(keepCount: number): number {
    if (typeof keepCount !== 'number' || keepCount < 0) {
      throw new ValidationError('Keep count must be a non-negative number', { keepCount });
    }

    const backups = this.list();
    const toDelete = backups.slice(keepCount);

    for (const backup of toDelete) {
      this.delete(backup.filename);
    }

    return toDelete.length;
  }

  /**
   * Start automatic backup
   */
  public startAutoBackup(intervalMs: number, options: BackupOptions = {}): void {
    if (typeof intervalMs !== 'number' || intervalMs <= 0) {
      throw new ValidationError('Interval must be a positive number', { intervalMs });
    }

    if (this.autoBackupInterval) {
      this.stopAutoBackup();
    }

    this.autoBackupInterval = setInterval(() => {
      this.create(options);
    }, intervalMs);
  }

  /**
   * Stop automatic backup
   */
  public stopAutoBackup(): void {
    if (this.autoBackupInterval) {
      clearInterval(this.autoBackupInterval);
      this.autoBackupInterval = null;
    }
  }

  /**
   * Export database to a file
   */
  public export(filePath: string, options: BackupOptions = {}): void {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        data: this.dataRef,
        metadata: options.metadata || {},
        version: '4.0.0'
      };

      const content = JSON.stringify(exportData, null, 2);
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new BackupError('export', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * Import database from a file
   */
  public import(filePath: string, merge: boolean = false): number {
    try {
      if (!fs.existsSync(filePath)) {
        throw new BackupError('import', {
          filePath,
          reason: 'Import file does not exist'
        });
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);

      // Support both old and new formats
      const importData = parsed.data || parsed;

      if (typeof importData !== 'object' || importData === null) {
        throw new BackupError('import', {
          filePath,
          reason: 'Invalid import data format'
        });
      }

      let imported = 0;

      if (merge) {
        // Merge with existing data
        for (const [key, value] of Object.entries(importData)) {
          this.dataRef[key] = value;
          imported++;
        }
      } else {
        // Replace all data
        const keys = Object.keys(this.dataRef);
        for (const key of keys) {
          delete this.dataRef[key];
        }

        for (const [key, value] of Object.entries(importData)) {
          this.dataRef[key] = value;
          imported++;
        }
      }

      return imported;
    } catch (error) {
      if (error instanceof BackupError) {
        throw error;
      }
      throw new BackupError('import', {
        filePath,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get backup statistics
   */
  public stats(): {
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  } {
    const backups = this.list();

    if (backups.length === 0) {
      return {
        totalBackups: 0,
        totalSize: 0,
        oldestBackup: null,
        newestBackup: null
      };
    }

    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      oldestBackup: backups[backups.length - 1].timestamp,
      newestBackup: backups[0].timestamp
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopAutoBackup();
  }
}
