/**
 * AlphaBase v4.0.0
 * A lightweight, feature-rich JSON database with TypeScript support
 * 
 * @packageDocumentation
 */

// Main class
export { AlphaBase, AlphaBaseOptions } from './AlphaBase';

// Core modules
export { Database, DatabaseOptions } from './core/Database';
export { TransactionManager } from './core/TransactionManager';
export { TTLManager } from './core/TTLManager';
export { BackupManager, BackupMetadata, BackupOptions } from './core/BackupManager';

// Validation
export { SchemaValidator } from './validation/SchemaValidator';
export { InputSanitizer } from './validation/InputSanitizer';

// Query
export { QueryBuilder, QueryFilter, QuerySort, QueryPagination, QueryResult } from './query/QueryBuilder';
export { QueryEngine } from './query/QueryEngine';

// Streaming
export { StreamingAPI, StreamingOptions } from './streaming/StreamingAPI';

// Monitoring
export { MetricsCollector, DatabaseMetrics, Metric, MetricType } from './monitoring/MetricsCollector';
export { HealthCheck, DatabaseHealthCheck, HealthStatus, HealthCheckResult, ComponentHealth } from './monitoring/HealthCheck';

// Errors
export {
  AlphaBaseError,
  ValidationError,
  KeyNotFoundError,
  EncryptionError,
  FileOperationError,
  TransactionError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  SchemaValidationError,
  TTLError,
  BackupError,
  ConfigurationError,
  ConnectionPoolError,
  TimeoutError,
  QueryError,
  ERROR_CODES
} from './errors';

// Types
export type {
  BatchOperation,
  DatabaseStats,
  QueryOptions,
  ExportOptions,
  ImportOptions
} from './types';

// Default export
export { AlphaBase as default } from './AlphaBase';
