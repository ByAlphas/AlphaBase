import { TransactionError } from '../errors';

/**
 * Transaction state snapshot
 */
interface TransactionSnapshot {
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * Transaction manager for atomic operations
 * Provides rollback capability for failed operations
 */
export class TransactionManager {
  private transaction: TransactionSnapshot | null;
  private readonly dataRef: Record<string, unknown>;

  constructor(dataRef: Record<string, unknown>) {
    this.transaction = null;
    this.dataRef = dataRef;
  }

  /**
   * Begin a new transaction
   * Takes a snapshot of current data state
   */
  public begin(): void {
    if (this.transaction) {
      throw new TransactionError('Transaction already in progress');
    }

    // Deep clone to prevent reference issues
    this.transaction = {
      data: JSON.parse(JSON.stringify(this.dataRef)),
      timestamp: Date.now()
    };
  }

  /**
   * Commit current transaction
   * Discards the snapshot as changes are kept
   */
  public commit(): void {
    if (!this.transaction) {
      throw new TransactionError('No transaction in progress');
    }

    this.transaction = null;
  }

  /**
   * Rollback current transaction
   * Restores data to snapshot state
   */
  public rollback(): void {
    if (!this.transaction) {
      throw new TransactionError('No transaction in progress');
    }

    // Restore from snapshot
    const keys = Object.keys(this.dataRef);
    for (const key of keys) {
      delete this.dataRef[key];
    }

    for (const [key, value] of Object.entries(this.transaction.data)) {
      this.dataRef[key] = value;
    }

    this.transaction = null;
  }

  /**
   * Check if transaction is active
   */
  public isActive(): boolean {
    return this.transaction !== null;
  }

  /**
   * Get transaction age in milliseconds
   */
  public getAge(): number {
    if (!this.transaction) {
      return 0;
    }

    return Date.now() - this.transaction.timestamp;
  }

  /**
   * Execute operations within a transaction
   * Automatically commits on success, rollbacks on error
   */
  public async execute<T>(operations: () => Promise<T>): Promise<T> {
    this.begin();

    try {
      const result = await operations();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  /**
   * Execute synchronous operations within a transaction
   * Automatically commits on success, rollbacks on error
   */
  public executeSync<T>(operations: () => T): T {
    this.begin();

    try {
      const result = operations();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }
}
