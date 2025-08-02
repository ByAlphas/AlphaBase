import { Stats } from 'fs';
import { JSONSchemaType } from 'ajv';

// Security interfaces (V3.0.0)
export interface JWTOptions {
  expiresIn?: string;
  algorithm?: string;
}

export interface AuditOptions {
  enabled?: boolean;
  logFile?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export interface RSAKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface AlphaBaseOptions {
  filePath?: string;
  backupDir?: string;
  schema?: object;
  password?: string;
  encryption?: 'AES' | 'DES' | 'TripleDES' | 'Rabbit' | 'XOR' | 'Base64';
  autoBackupInterval?: number;
  
  // Security options (V3.0.0)
  jwtSecret?: string;
  audit?: AuditOptions;
  integrity?: boolean;
  rsa?: boolean;
  
  // Performance options (V3.0.0 Professional)
  performanceMode?: boolean;
  useConnectionPool?: boolean;
  useFileLocking?: boolean;
  batchWrite?: boolean;
  deferredWriteTimeout?: number;
}

export interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  batchedWrites: number;
  totalOperations: number;
  cacheHitRatio: number;
  avgBatchSize: number;
}

export interface MemoryStats {
  heapUsed: string;
  heapTotal: string;
  external: string;
  readCacheSize: number;
  writeCacheSize: number;
  cacheHitRatio: number;
}

export interface ConnectionPoolStats {
  created: number;
  destroyed: number;
  acquired: number;
  released: number;
  timeouts: number;
  poolSize: number;
  activeConnections: number;
  waitingQueue: number;
  totalConnections: number;
}

export interface AlphaBaseStats {
  totalKeys: number;
  fileSize: number;
  lastModified: Date;
  memoryUsage: number;
  averageValueSize: number;
  largestKey: string;
  largestValueSize: number;
  encryption?: string;
  hasPassword?: boolean;
  
  // Enhanced stats (V3.0.0 Professional)
  performance?: PerformanceMetrics;
  memory?: MemoryStats;
  connectionPool?: ConnectionPoolStats | null;
}

export interface SetOptions {
  ttl?: number;
}

export interface TransactionOptions {
  autoCommit?: boolean;
}

export interface ExportOptions {
  asString?: boolean;
  encrypt?: boolean;
  password?: string;
}

export interface ImportOptions {
  merge?: boolean;
  decrypt?: boolean;
  password?: string;
}

export interface BatchOperation {
  op: 'set' | 'delete';
  key: string;
  value?: any;
  options?: SetOptions;
}

export interface AuditLogEntry {
  timestamp: string;
  operation: string;
  key: string;
  user: string;
  metadata?: any;
}

export interface TokenResult {
  valid: boolean;
  error?: string;
  payload?: any;
}

// Performance optimizer class interface
export interface PerformanceOptimizer {
  getCached(key: string): any;
  setCached(key: string, value: any): void;
  batchWrite(key: string, value: any, options?: SetOptions): void;
  flushWrites(): Promise<void>;
  getMemoryStats(): MemoryStats;
  getPerformanceMetrics(): PerformanceMetrics;
  clearCaches(): void;
  shutdown(): Promise<void>;
}

// Connection pool interface
export interface ConnectionPool {
  acquire(): Promise<any>;
  release(connection: any): void;
  getStats(): ConnectionPoolStats;
  shutdown(): Promise<void>;
}

// Server interfaces (V3.0.0)
export interface AlphaServerOptions {
  allowServerStart?: boolean; // Security requirement
  port?: number;
  host?: string;
  database?: string;
  password?: string;
  encryption?: string;
  jwtSecret?: string;
  auth?: boolean;
  audit?: boolean;
  auditFile?: string;
}

export declare class AlphaServer {
  constructor(options?: AlphaServerOptions);
  start(): AlphaServer;
  stop(): void;
}

export default class AlphaBase {
  constructor(options?: AlphaBaseOptions);
  
  // Core database methods
  setSync(key: string, value: any, options?: SetOptions): void;
  getSync(key: string): any;
  deleteSync(key: string): void;
  hasSync(key: string): boolean;
  clearSync(): void;
  allSync(): Record<string, any>;
  
  // Performance methods (V3.0.0 Professional)
  flushSync(): void;
  batchAsync(operations: BatchOperation[]): Promise<void>;
  statsSync(): AlphaBaseStats;
  
  // Async versions
  set(key: string, value: any, options?: SetOptions): Promise<void>;
  get(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  all(): Promise<Record<string, any>>;
  stats(): Promise<AlphaBaseStats>;
  
  // Import/Export
  importSync(data: object | string, options?: ImportOptions): void;
  exportSync(options?: ExportOptions): object | string;
  import(data: object | string, options?: ImportOptions): Promise<void>;
  export(options?: ExportOptions): Promise<object | string>;
  
  // Collections
  importCollection(name: string, data: any[]): void;
  exportCollection(name: string): any[];
  
  // Backup
  backupSync(): string;
  backup(): Promise<string>;
  startAutoBackup(intervalMs: number): void;
  stopAutoBackup(): void;
  
  // Transaction support
  beginTransaction(options?: TransactionOptions): void;
  commit(): void;
  rollback(): void;
  inTransaction(): boolean;
  
  // Batch operations
  batch(operations: BatchOperation[]): Promise<void>;
  batchSync(operations: BatchOperation[]): void;
  
  // TTL support
  setTTL(key: string, ttl: number): void;
  getTTL(key: string): number | null;
  clearTTL(key: string): void;
  cleanup(): Promise<void>;
  cleanupSync(): void;
  
  // Security methods (V3.0.0)
  createToken(payload: any, options?: JWTOptions): string;
  verifyToken(token: string): TokenResult;
  auditLog(operation: string, key: string, user: string, metadata?: any): void;
  getAuditLogs(options?: any): AuditLogEntry[];
  verifyIntegrity(key: string): boolean;
  generateRSAKeys(): RSAKeyPair;
  rsaEncrypt(data: string, publicKey: string): string;
  rsaDecrypt(encryptedData: string, privateKey: string): string;
  
  // Resource management (V3.0.0 Professional)
  shutdown(): Promise<boolean>;
}

// Multi-database manager
export declare class AlphaBaseManager {
  constructor();
  open(filePath: string, options?: AlphaBaseOptions): AlphaBase;
  close(filePath: string): void;
  list(): string[];
  get(filePath: string): AlphaBase;
}

// Base64 utilities
export declare function base64Encrypt(str: string): string;
export declare function base64Decrypt(str: string): string;
