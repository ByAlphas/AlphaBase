import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

/**
 * Error recovery options
 */
export interface ErrorRecoveryOptions {
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Initial retry delay in milliseconds */
  initialDelay?: number;
  /** Maximum retry delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Enable circuit breaker */
  enableCircuitBreaker?: boolean;
  /** Circuit breaker threshold */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset timeout in milliseconds */
  circuitBreakerResetTimeout?: number;
}

/**
 * Error context for detailed error tracking
 */
export interface ErrorContext {
  /** Operation that failed */
  operation: string;
  /** Timestamp of error */
  timestamp: Date;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Retry attempt number */
  retryAttempt?: number;
}

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Error Recovery Manager
 * Provides retry logic with exponential backoff and circuit breaker pattern
 */
export class ErrorRecovery {
  private readonly options: Required<ErrorRecoveryOptions>;
  private circuitState: CircuitState;
  private failureCount: number;
  private lastFailureTime: number;
  private successCount: number;
  private errorHistory: ErrorContext[];
  private readonly maxHistorySize = 100;

  constructor(options: ErrorRecoveryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      initialDelay: options.initialDelay ?? 100,
      maxDelay: options.maxDelay ?? 5000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      enableCircuitBreaker: options.enableCircuitBreaker ?? true,
      circuitBreakerThreshold: options.circuitBreakerThreshold ?? 5,
      circuitBreakerResetTimeout: options.circuitBreakerResetTimeout ?? 60000
    };

    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    this.errorHistory = [];
  }

  /**
   * Execute operation with retry logic
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    // Check circuit breaker
    if (this.options.enableCircuitBreaker && !this.canExecute()) {
      const error = new Error(`Circuit breaker is OPEN for operation: ${operationName}`);
      this.recordError(operationName, error, metadata);
      throw error;
    }

    let lastError: Error | null = null;
    let delay = this.options.initialDelay;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordError(operationName, lastError, { ...metadata, retryAttempt: attempt });

        // Don't delay on last attempt
        if (attempt < this.options.maxRetries) {
          await this.sleep(delay);
          delay = Math.min(delay * this.options.backoffMultiplier, this.options.maxDelay);
        }
      }
    }

    // All retries failed
    this.recordFailure();
    throw lastError;
  }

  /**
   * Execute synchronous operation with retry logic
   */
  public executeWithRetrySync<T>(
    operation: () => T,
    operationName: string,
    metadata?: Record<string, unknown>
  ): T {
    // Check circuit breaker
    if (this.options.enableCircuitBreaker && !this.canExecute()) {
      const error = new Error(`Circuit breaker is OPEN for operation: ${operationName}`);
      this.recordError(operationName, error, metadata);
      throw error;
    }

    let lastError: Error | null = null;
    let delay = this.options.initialDelay;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const result = operation();
        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordError(operationName, lastError, { ...metadata, retryAttempt: attempt });

        // Don't delay on last attempt
        if (attempt < this.options.maxRetries) {
          this.sleepSync(delay);
          delay = Math.min(delay * this.options.backoffMultiplier, this.options.maxDelay);
        }
      }
    }

    // All retries failed
    this.recordFailure();
    throw lastError;
  }

  /**
   * Check if operation can be executed (circuit breaker)
   */
  private canExecute(): boolean {
    if (!this.options.enableCircuitBreaker) {
      return true;
    }

    const now = Date.now();

    if (this.circuitState === CircuitState.CLOSED) {
      return true;
    }

    if (this.circuitState === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (now - this.lastFailureTime >= this.options.circuitBreakerResetTimeout) {
        this.circuitState = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow one request
    return true;
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    if (!this.options.enableCircuitBreaker) {
      return;
    }

    this.successCount++;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Success in HALF_OPEN state - close circuit
      this.circuitState = CircuitState.CLOSED;
      this.failureCount = 0;
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    if (!this.options.enableCircuitBreaker) {
      return;
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.circuitBreakerThreshold) {
      this.circuitState = CircuitState.OPEN;
    }
  }

  /**
   * Record error in history
   */
  private recordError(
    operation: string,
    error: Error,
    metadata?: Record<string, unknown>
  ): void {
    const context: ErrorContext = {
      operation,
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      metadata
    };

    this.errorHistory.unshift(context);

    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get error history
   */
  public getErrorHistory(limit?: number): ErrorContext[] {
    return limit ? this.errorHistory.slice(0, limit) : [...this.errorHistory];
  }

  /**
   * Get circuit breaker state
   */
  public getCircuitState(): string {
    return this.circuitState;
  }

  /**
   * Get statistics
   */
  public getStats() {
    return {
      circuitState: this.circuitState,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalErrors: this.errorHistory.length,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
      options: this.options
    };
  }

  /**
   * Reset circuit breaker
   */
  public reset(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.errorHistory = [];
  }

  /**
   * Async sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Synchronous sleep (blocking)
   */
  private sleepSync(ms: number): void {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait
    }
  }

  /**
   * Attempt to recover corrupted database file (async - recommended)
   */
  public static async recoverCorruptedFile(
    filePath: string,
    backupDir?: string
  ): Promise<boolean> {
    let content: string = '';
    
    try {
      // Try to parse current file
      content = await fsPromises.readFile(filePath, 'utf8');
      JSON.parse(content);
      return true; // File is valid
    } catch (parseError) {
      // File is corrupted, try to recover

      // 1. Try to find most recent backup
      if (backupDir) {
        try {
          await fsPromises.access(backupDir);
          const allFiles = await fsPromises.readdir(backupDir);
          const backups = allFiles
            .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
            .sort()
            .reverse();

          for (const backup of backups) {
            try {
              const backupPath = path.join(backupDir, backup);
              const backupContent = await fsPromises.readFile(backupPath, 'utf8');
              const parsed = JSON.parse(backupContent);
              
              // Restore from backup
              const data = parsed.data || parsed;
              await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
              return true;
            } catch {
              // Try next backup
              continue;
            }
          }
        } catch {
          // Backup directory doesn't exist or error reading it
        }
      }

      // 2. Try to salvage partial data (only if content was read)
      if (content) {
        try {
          let salvaged = {};
          const lines = content.split('\n');
        
          // Try to extract valid JSON objects from lines
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (typeof obj === 'object' && obj !== null) {
                salvaged = { ...salvaged, ...obj };
              }
            } catch {
              // Skip invalid lines
            }
          }

          if (Object.keys(salvaged).length > 0) {
            await fsPromises.writeFile(filePath, JSON.stringify(salvaged, null, 2), 'utf8');
            return true;
          }
        } catch {
          // Salvage failed
        }
      }

      // 3. Last resort - create empty database
      await fsPromises.writeFile(filePath, '{}', 'utf8');
      return false;
    }
  }

  /**
   * Attempt to recover corrupted database file (synchronous - legacy)
   * @deprecated Use recoverCorruptedFile() async version instead
   */
  public static recoverCorruptedFileSync(
    filePath: string,
    backupDir?: string
  ): boolean {
    let content: string = '';
    
    try {
      // Try to parse current file
      content = fs.readFileSync(filePath, 'utf8');
      JSON.parse(content);
      return true; // File is valid
    } catch (parseError) {
      // File is corrupted, try to recover

      // 1. Try to find most recent backup
      if (backupDir && fs.existsSync(backupDir)) {
        const backups = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
          .sort()
          .reverse();

        for (const backup of backups) {
          try {
            const backupPath = path.join(backupDir, backup);
            const backupContent = fs.readFileSync(backupPath, 'utf8');
            const parsed = JSON.parse(backupContent);
            
            // Restore from backup
            const data = parsed.data || parsed;
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            return true;
          } catch {
            // Try next backup
            continue;
          }
        }
      }

      // 2. Try to salvage partial data (only if content was read)
      if (content) {
        try {
          let salvaged = {};
          const lines = content.split('\n');
        
          // Try to extract valid JSON objects from lines
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (typeof obj === 'object' && obj !== null) {
                salvaged = { ...salvaged, ...obj };
              }
            } catch {
              // Skip invalid lines
            }
          }

          if (Object.keys(salvaged).length > 0) {
            fs.writeFileSync(filePath, JSON.stringify(salvaged, null, 2), 'utf8');
            return true;
          }
        } catch {
          // Salvage failed
        }
      }

      // 3. Last resort - create empty database
      fs.writeFileSync(filePath, '{}', 'utf8');
      return false;
    }
  }

  /**
   * Create graceful shutdown handler
   */
  public static createShutdownHandler(
    cleanup: () => Promise<void>
  ): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        
        try {
          await cleanup();
          console.log('Cleanup completed successfully');
          process.exit(0);
        } catch (error) {
          console.error('Error during cleanup:', error);
          process.exit(1);
        }
      });
    });

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error('Error during emergency cleanup:', cleanupError);
      }
      
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      
      try {
        await cleanup();
      } catch (cleanupError) {
        console.error('Error during emergency cleanup:', cleanupError);
      }
      
      process.exit(1);
    });
  }
}
