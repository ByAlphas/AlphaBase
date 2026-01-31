import { EventEmitter } from 'events';

/**
 * Event types that AlphaBase can emit
 */
export type AlphaBaseEvent = 
  | 'set' 
  | 'get' 
  | 'delete' 
  | 'clear'
  | 'batch'
  | 'transaction:begin'
  | 'transaction:commit'
  | 'transaction:rollback'
  | 'backup:created'
  | 'backup:restored'
  | 'ttl:expired'
  | 'error';

export type BeforeEvent = `before:${AlphaBaseEvent}`;
export type AfterEvent = `after:${AlphaBaseEvent}`;
export type EventType = AlphaBaseEvent | BeforeEvent | AfterEvent;

/**
 * Event data payloads
 */
export interface SetEventData {
  key: string;
  value: unknown;
  ttl?: number;
}

export interface GetEventData {
  key: string;
  value: unknown;
}

export interface DeleteEventData {
  key: string;
  existed: boolean;
}

export interface BatchEventData {
  operations: Array<{ type: 'set' | 'delete'; key: string; value?: unknown }>;
  count: number;
}

export interface BackupEventData {
  filename: string;
  filePath: string;
  timestamp: Date;
}

export interface TTLExpiredEventData {
  key: string;
  value: unknown;
}

export interface ErrorEventData {
  error: Error;
  operation: string;
  key?: string;
}

export type EventData = 
  | SetEventData 
  | GetEventData 
  | DeleteEventData 
  | BatchEventData 
  | BackupEventData
  | TTLExpiredEventData
  | ErrorEventData
  | Record<string, unknown>;

/**
 * Event handler function type
 */
export type EventHandler<T = EventData> = (data: T) => void | Promise<void>;

/**
 * Event Manager for AlphaBase
 * Provides event emission and subscription capabilities
 * Uses native Node.js EventEmitter for zero dependencies
 */
export class EventManager {
  private emitter: EventEmitter;

  constructor(maxListeners: number = 100) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(maxListeners);
  }

  /**
   * Subscribe to an event
   */
  public on<T = EventData>(event: EventType, handler: EventHandler<T>): void {
    this.emitter.on(event, handler as any);
  }

  /**
   * Subscribe to an event (once)
   */
  public once<T = EventData>(event: EventType, handler: EventHandler<T>): void {
    this.emitter.once(event, handler as any);
  }

  /**
   * Unsubscribe from an event
   */
  public off<T = EventData>(event: EventType, handler: EventHandler<T>): void {
    this.emitter.off(event, handler as any);
  }

  /**
   * Unsubscribe all handlers for an event
   */
  public removeAllListeners(event?: EventType): void {
    this.emitter.removeAllListeners(event);
  }

  /**
   * Emit an event
   */
  public emit(event: EventType, data?: EventData): void {
    this.emitter.emit(event, data);
  }

  /**
   * Emit an async event and wait for all handlers
   */
  public async emitAsync(event: EventType, data?: EventData): Promise<void> {
    const listeners = this.emitter.listeners(event);
    
    for (const listener of listeners) {
      try {
        await Promise.resolve(listener(data));
      } catch (error) {
        // Emit error event if handler fails
        this.emit('error', {
          error: error as Error,
          operation: `event:${event}`,
        } as ErrorEventData);
      }
    }
  }

  /**
   * Get listener count for an event
   */
  public listenerCount(event: EventType): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Get all event names
   */
  public eventNames(): Array<string | symbol> {
    return this.emitter.eventNames();
  }

  /**
   * Check if event has listeners
   */
  public hasListeners(event: EventType): boolean {
    return this.emitter.listenerCount(event) > 0;
  }

  /**
   * Clear all event listeners
   */
  public clear(): void {
    this.emitter.removeAllListeners();
  }

  /**
   * Get the underlying EventEmitter instance
   */
  public getEmitter(): EventEmitter {
    return this.emitter;
  }
}
