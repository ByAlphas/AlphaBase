import { Stats } from 'fs';
import { JSONSchemaType } from 'ajv';

export interface AlphaDBOptions {
  filePath?: string;
  backupDir?: string;
  schema?: object;
  autoBackupInterval?: number;
}

export interface AlphaDBStats {
  totalKeys: number;
  fileSize: number;
  lastModified: Date;
}

export default class AlphaDB {
  constructor(options?: AlphaDBOptions);
  setSync(key: string, value: any): void;
  getSync(key: string): any;
  deleteSync(key: string): void;
  hasSync(key: string): boolean;
  clearSync(): void;
  allSync(): Record<string, any>;
  statsSync(): AlphaDBStats;
  importSync(data: object | string): void;
  exportSync(asString?: boolean): object | string;
  backupSync(): string;

  set(key: string, value: any): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  all(): Promise<Record<string, any>>;
  stats(): Promise<AlphaDBStats>;
  import(data: object | string): Promise<void>;
  export(asString?: boolean): Promise<object | string>;
  backup(): Promise<string>;
  startAutoBackup(intervalMs: number): void;
  stopAutoBackup(): void;
}
