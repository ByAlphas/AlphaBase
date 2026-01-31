import { QueryBuilder, QueryFilter, QueryResult, QuerySort } from './QueryBuilder';
import { QueryError } from '../errors';

/**
 * Query Engine
 * Executes queries on data
 */
export class QueryEngine {
  private readonly dataRef: Record<string, unknown>;

  constructor(dataRef: Record<string, unknown>) {
    this.dataRef = dataRef;
  }

  /**
   * Execute a query
   */
  public execute(query: QueryBuilder): QueryResult {
    const { filters, sorts, pagination, projection } = query.build();

    // Get all values as array
    let results = Object.values(this.dataRef);

    // Apply filters
    for (const filter of filters) {
      results = this.applyFilter(results, filter);
    }

    // Apply sorts
    for (const sort of sorts) {
      results = this.applySort(results, sort);
    }

    // Count after filters/sorts
    const filteredTotal = results.length;

    // Apply pagination
    let hasMore = false;
    if (pagination) {
      const { offset, limit } = pagination;
      hasMore = offset + limit < filteredTotal;
      results = results.slice(offset, offset + limit);
    }

    // Apply projection
    if (projection && projection.length > 0) {
      results = results.map(item => this.applyProjection(item, projection));
    }

    return {
      data: results,
      total: filteredTotal,
      offset: pagination?.offset || 0,
      limit: pagination?.limit || filteredTotal,
      hasMore
    };
  }

  /**
   * Apply a single filter
   */
  private applyFilter(data: unknown[], filter: QueryFilter): unknown[] {
    const { field, operator, value } = filter;

    return data.filter(item => {
      const fieldValue = this.getFieldValue(item, field);

      switch (operator) {
        case 'eq':
          return fieldValue === value;

        case 'ne':
          return fieldValue !== value;

        case 'gt':
          return typeof fieldValue === 'number' && fieldValue > (value as number);

        case 'gte':
          return typeof fieldValue === 'number' && fieldValue >= (value as number);

        case 'lt':
          return typeof fieldValue === 'number' && fieldValue < (value as number);

        case 'lte':
          return typeof fieldValue === 'number' && fieldValue <= (value as number);

        case 'in':
          return Array.isArray(value) && value.includes(fieldValue);

        case 'nin':
          return Array.isArray(value) && !value.includes(fieldValue);

        case 'contains':
          return typeof fieldValue === 'string' &&
                 typeof value === 'string' &&
                 fieldValue.toLowerCase().includes(value.toLowerCase());

        case 'startsWith':
          return typeof fieldValue === 'string' &&
                 typeof value === 'string' &&
                 fieldValue.startsWith(value);

        case 'endsWith':
          return typeof fieldValue === 'string' &&
                 typeof value === 'string' &&
                 fieldValue.endsWith(value);

        case 'regex':
          if (typeof fieldValue !== 'string') return false;
          const pattern = typeof value === 'string' ? new RegExp(value) : value as RegExp;
          return pattern.test(fieldValue);

        default:
          throw new QueryError(`Unknown operator: ${operator}`, { filter });
      }
    });
  }

  /**
   * Apply sorting
   */
  private applySort(data: unknown[], sort: QuerySort): unknown[] {
    const { field, order } = sort;

    return [...data].sort((a, b) => {
      const aValue = this.getFieldValue(a, field);
      const bValue = this.getFieldValue(b, field);

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Compare
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Apply field projection
   */
  private applyProjection(item: unknown, fields: string[]): unknown {
    if (typeof item !== 'object' || item === null) {
      return item;
    }

    const projected: Record<string, unknown> = {};

    for (const field of fields) {
      const value = this.getFieldValue(item, field);
      this.setFieldValue(projected, field, value);
    }

    return projected;
  }

  /**
   * Get nested field value using dot notation
   */
  private getFieldValue(obj: unknown, field: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }

    const parts = field.split('.');
    let current: any = obj;

    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Set nested field value using dot notation
   */
  private setFieldValue(obj: Record<string, unknown>, field: string, value: unknown): void {
    const parts = field.split('.');
    let current: any = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Count documents matching query
   */
  public count(query: QueryBuilder): number {
    const { filters } = query.build();

    let results = Object.values(this.dataRef);

    for (const filter of filters) {
      results = this.applyFilter(results, filter);
    }

    return results.length;
  }

  /**
   * Find first matching document
   */
  public findOne(query: QueryBuilder): unknown | null {
    const result = this.execute(query.limit(1));
    return result.data[0] || null;
  }

  /**
   * Check if any document matches query
   */
  public exists(query: QueryBuilder): boolean {
    return this.count(query) > 0;
  }

  /**
   * Get distinct values for a field
   */
  public distinct(field: string, query?: QueryBuilder): unknown[] {
    let data = Object.values(this.dataRef);

    if (query) {
      const { filters } = query.build();
      for (const filter of filters) {
        data = this.applyFilter(data, filter);
      }
    }

    const values = data.map(item => this.getFieldValue(item, field));
    return [...new Set(values)];
  }

  /**
   * Group by field and count
   */
  public groupBy(field: string): Record<string, number> {
    const data = Object.values(this.dataRef);
    const groups: Record<string, number> = {};

    for (const item of data) {
      const value = String(this.getFieldValue(item, field));
      groups[value] = (groups[value] || 0) + 1;
    }

    return groups;
  }

  /**
   * Aggregate functions
   */
  public aggregate(field: string, operation: 'sum' | 'avg' | 'min' | 'max', query?: QueryBuilder): number | null {
    let data = Object.values(this.dataRef);

    if (query) {
      const { filters } = query.build();
      for (const filter of filters) {
        data = this.applyFilter(data, filter);
      }
    }

    const values = data
      .map(item => this.getFieldValue(item, field))
      .filter(v => typeof v === 'number') as number[];

    if (values.length === 0) {
      return null;
    }

    switch (operation) {
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);

      case 'avg':
        return values.reduce((sum, v) => sum + v, 0) / values.length;

      case 'min':
        return Math.min(...values);

      case 'max':
        return Math.max(...values);

      default:
        throw new QueryError(`Unknown aggregate operation: ${operation}`, { operation });
    }
  }
}
