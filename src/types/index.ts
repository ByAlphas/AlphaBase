/**
 * Common type definitions for AlphaBase
 */

// Re-export all types from modules
export type { DatabaseOptions } from '../core/Database';
export type { BackupMetadata, BackupOptions } from '../core/BackupManager';
export type { StreamingOptions } from '../streaming/StreamingAPI';
export type { QueryFilter, QuerySort, QueryPagination, QueryResult } from '../query/QueryBuilder';
export type { Metric, MetricType } from '../monitoring/MetricsCollector';
export type { HealthStatus, HealthCheckResult, ComponentHealth } from '../monitoring/HealthCheck';
export type { AlphaBaseOptions } from '../AlphaBase';

/**
 * Batch operation
 */
export interface BatchOperation {
  type: 'set' | 'delete';
  key: string;
  value?: unknown;
  ttl?: number;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  keys: number;
  size: number;
  filePath: string;
  backupDir: string;
  backupCount: number;
  ttl: {
    total: number;
    expired: number;
    active: number;
  };
}

/**
 * Query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  select?: string[];
}

/**
 * Export options
 */
export interface ExportOptions {
  pretty?: boolean;
  compress?: boolean;
  encrypt?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Import options
 */
export interface ImportOptions {
  merge?: boolean;
  validate?: boolean;
  schema?: string;
}
