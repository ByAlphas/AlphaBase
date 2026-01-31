import { ValidationError } from '../errors';

/**
 * Query filter condition
 */
export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  value: unknown;
}

/**
 * Query sort option
 */
export interface QuerySort {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Query pagination
 */
export interface QueryPagination {
  offset: number;
  limit: number;
}

/**
 * Query result
 */
export interface QueryResult<T = unknown> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Query Builder
 * Provides fluent API for building queries
 */
export class QueryBuilder {
  private filters: QueryFilter[];
  private sorts: QuerySort[];
  private pagination: QueryPagination | null;
  private projection: string[] | null;

  constructor() {
    this.filters = [];
    this.sorts = [];
    this.pagination = null;
    this.projection = null;
  }

  /**
   * Add a filter condition
   */
  public where(field: string, operator: QueryFilter['operator'], value: unknown): this {
    this.filters.push({ field, operator, value });
    return this;
  }

  /**
   * Shorthand for equality filter
   */
  public equals(field: string, value: unknown): this {
    return this.where(field, 'eq', value);
  }

  /**
   * Shorthand for inequality filter
   */
  public notEquals(field: string, value: unknown): this {
    return this.where(field, 'ne', value);
  }

  /**
   * Greater than filter
   */
  public greaterThan(field: string, value: number): this {
    return this.where(field, 'gt', value);
  }

  /**
   * Greater than or equal filter
   */
  public greaterThanOrEqual(field: string, value: number): this {
    return this.where(field, 'gte', value);
  }

  /**
   * Less than filter
   */
  public lessThan(field: string, value: number): this {
    return this.where(field, 'lt', value);
  }

  /**
   * Less than or equal filter
   */
  public lessThanOrEqual(field: string, value: number): this {
    return this.where(field, 'lte', value);
  }

  /**
   * In array filter
   */
  public in(field: string, values: unknown[]): this {
    return this.where(field, 'in', values);
  }

  /**
   * Not in array filter
   */
  public notIn(field: string, values: unknown[]): this {
    return this.where(field, 'nin', values);
  }

  /**
   * Contains substring filter (case-insensitive)
   */
  public contains(field: string, value: string): this {
    return this.where(field, 'contains', value);
  }

  /**
   * Starts with filter
   */
  public startsWith(field: string, value: string): this {
    return this.where(field, 'startsWith', value);
  }

  /**
   * Ends with filter
   */
  public endsWith(field: string, value: string): this {
    return this.where(field, 'endsWith', value);
  }

  /**
   * Regex filter
   */
  public regex(field: string, pattern: string | RegExp): this {
    return this.where(field, 'regex', pattern);
  }

  /**
   * Sort by field
   */
  public sort(field: string, order: 'asc' | 'desc' = 'asc'): this {
    this.sorts.push({ field, order });
    return this;
  }

  /**
   * Sort ascending
   */
  public sortAsc(field: string): this {
    return this.sort(field, 'asc');
  }

  /**
   * Sort descending
   */
  public sortDesc(field: string): this {
    return this.sort(field, 'desc');
  }

  /**
   * Set pagination
   */
  public paginate(offset: number, limit: number): this {
    if (typeof offset !== 'number' || offset < 0) {
      throw new ValidationError('Offset must be a non-negative number', { offset });
    }

    if (typeof limit !== 'number' || limit <= 0) {
      throw new ValidationError('Limit must be a positive number', { limit });
    }

    this.pagination = { offset, limit };
    return this;
  }

  /**
   * Set limit
   */
  public limit(limit: number): this {
    return this.paginate(0, limit);
  }

  /**
   * Set field projection
   */
  public select(...fields: string[]): this {
    this.projection = fields;
    return this;
  }

  /**
   * Get query configuration
   */
  public build(): {
    filters: QueryFilter[];
    sorts: QuerySort[];
    pagination: QueryPagination | null;
    projection: string[] | null;
  } {
    return {
      filters: [...this.filters],
      sorts: [...this.sorts],
      pagination: this.pagination ? { ...this.pagination } : null,
      projection: this.projection ? [...this.projection] : null
    };
  }

  /**
   * Reset query
   */
  public reset(): this {
    this.filters = [];
    this.sorts = [];
    this.pagination = null;
    this.projection = null;
    return this;
  }
}
