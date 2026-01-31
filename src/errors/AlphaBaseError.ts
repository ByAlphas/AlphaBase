/**
 * Base class for all AlphaBase errors
 * Provides consistent error handling with error codes and details
 */
export class AlphaBaseError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AlphaBaseError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * Thrown when a validation error occurs
 */
export class ValidationError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E001_VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when a key is not found
 */
export class KeyNotFoundError extends AlphaBaseError {
  constructor(key: string) {
    super('E002_KEY_NOT_FOUND', `Key not found: ${key}`, { key });
    this.name = 'KeyNotFoundError';
  }
}

/**
 * Thrown when encryption/decryption fails
 */
export class EncryptionError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E003_ENCRYPTION_ERROR', message, details);
    this.name = 'EncryptionError';
  }
}

/**
 * Thrown when file I/O operations fail
 */
export class FileOperationError extends AlphaBaseError {
  constructor(operation: string, filePath: string, originalError?: Error) {
    super(
      'E004_FILE_OPERATION_ERROR',
      `File operation failed: ${operation}`,
      {
        operation,
        filePath,
        originalError: originalError?.message
      }
    );
    this.name = 'FileOperationError';
  }
}

/**
 * Thrown when transaction operations fail
 */
export class TransactionError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E005_TRANSACTION_ERROR', message, details);
    this.name = 'TransactionError';
  }
}

/**
 * Thrown when authentication fails
 */
export class AuthenticationError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E006_AUTHENTICATION_ERROR', message, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when authorization fails
 */
export class AuthorizationError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E007_AUTHORIZATION_ERROR', message, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Thrown when rate limit is exceeded
 */
export class RateLimitError extends AlphaBaseError {
  constructor(limit: number, windowMs: number) {
    super(
      'E008_RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      { limit, windowMs }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Thrown when schema validation fails
 */
export class SchemaValidationError extends AlphaBaseError {
  constructor(errors: unknown[]) {
    super(
      'E009_SCHEMA_VALIDATION_ERROR',
      'Schema validation failed',
      { errors }
    );
    this.name = 'SchemaValidationError';
  }
}

/**
 * Thrown when TTL operations fail
 */
export class TTLError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E010_TTL_ERROR', message, details);
    this.name = 'TTLError';
  }
}

/**
 * Thrown when backup/restore operations fail
 */
export class BackupError extends AlphaBaseError {
  constructor(operation: string, details?: Record<string, unknown>) {
    super('E011_BACKUP_ERROR', `Backup operation failed: ${operation}`, details);
    this.name = 'BackupError';
  }
}

/**
 * Thrown when configuration is invalid
 */
export class ConfigurationError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E012_CONFIGURATION_ERROR', message, details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Thrown when connection pool operations fail
 */
export class ConnectionPoolError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E013_CONNECTION_POOL_ERROR', message, details);
    this.name = 'ConnectionPoolError';
  }
}

/**
 * Thrown when a timeout occurs
 */
export class TimeoutError extends AlphaBaseError {
  constructor(operation: string, timeoutMs: number) {
    super(
      'E014_TIMEOUT_ERROR',
      `Operation timed out: ${operation}`,
      { operation, timeoutMs }
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when query operations fail
 */
export class QueryError extends AlphaBaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('E015_QUERY_ERROR', message, details);
    this.name = 'QueryError';
  }
}

/**
 * Error code documentation
 */
export const ERROR_CODES = {
  E001_VALIDATION_ERROR: 'Validation failed',
  E002_KEY_NOT_FOUND: 'Key does not exist',
  E003_ENCRYPTION_ERROR: 'Encryption or decryption failed',
  E004_FILE_OPERATION_ERROR: 'File system operation failed',
  E005_TRANSACTION_ERROR: 'Transaction operation failed',
  E006_AUTHENTICATION_ERROR: 'Authentication failed',
  E007_AUTHORIZATION_ERROR: 'Authorization failed',
  E008_RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  E009_SCHEMA_VALIDATION_ERROR: 'Schema validation failed',
  E010_TTL_ERROR: 'TTL operation failed',
  E011_BACKUP_ERROR: 'Backup or restore operation failed',
  E012_CONFIGURATION_ERROR: 'Invalid configuration',
  E013_CONNECTION_POOL_ERROR: 'Connection pool operation failed',
  E014_TIMEOUT_ERROR: 'Operation timed out',
  E015_QUERY_ERROR: 'Query operation failed'
} as const;
