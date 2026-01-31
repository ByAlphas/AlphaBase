import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import { SchemaValidationError, ValidationError } from '../errors';

/**
 * Schema Validator using Ajv
 * Provides JSON Schema validation for database values
 */
export class SchemaValidator {
  private readonly ajv: Ajv;
  private validators: Map<string, ValidateFunction<unknown>>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });
    this.validators = new Map();
  }

  /**
   * Register a schema for validation
   */
  public registerSchema(name: string, schema: JSONSchemaType<unknown> | object): void {
    if (typeof name !== 'string' || name.length === 0) {
      throw new ValidationError('Schema name must be a non-empty string', { name });
    }

    try {
      const validator = this.ajv.compile(schema);
      this.validators.set(name, validator);
    } catch (error) {
      throw new ValidationError('Failed to compile schema', {
        name,
        error: (error as Error).message
      });
    }
  }

  /**
   * Validate data against a registered schema
   */
  public validate(schemaName: string, data: unknown): void {
    const validator = this.validators.get(schemaName);

    if (!validator) {
      throw new ValidationError(`Schema '${schemaName}' not found`, { schemaName });
    }

    const valid = validator(data);

    if (!valid) {
      throw new SchemaValidationError(validator.errors || []);
    }
  }

  /**
   * Check if data is valid without throwing
   */
  public isValid(schemaName: string, data: unknown): boolean {
    const validator = this.validators.get(schemaName);

    if (!validator) {
      return false;
    }

    return validator(data);
  }

  /**
   * Get validation errors without throwing
   */
  public getErrors(schemaName: string, data: unknown): unknown[] {
    const validator = this.validators.get(schemaName);

    if (!validator) {
      return [{ message: `Schema '${schemaName}' not found` }];
    }

    validator(data);
    return validator.errors || [];
  }

  /**
   * Remove a registered schema
   */
  public unregisterSchema(name: string): boolean {
    return this.validators.delete(name);
  }

  /**
   * List all registered schema names
   */
  public listSchemas(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Clear all registered schemas
   */
  public clear(): void {
    this.validators.clear();
  }

  /**
   * Validate data type
   */
  public static validateType(
    value: unknown,
    expectedType: 'string' | 'number' | 'boolean' | 'object' | 'array'
  ): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== expectedType) {
      throw new ValidationError(
        `Expected ${expectedType}, got ${actualType}`,
        { expectedType, actualType, value }
      );
    }
  }

  /**
   * Validate key format
   */
  public static validateKey(key: string, options: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowedChars?: RegExp;
  } = {}): void {
    if (typeof key !== 'string') {
      throw new ValidationError('Key must be a string', { key });
    }

    if (options.minLength && key.length < options.minLength) {
      throw new ValidationError(
        `Key length must be at least ${options.minLength}`,
        { key, minLength: options.minLength }
      );
    }

    if (options.maxLength && key.length > options.maxLength) {
      throw new ValidationError(
        `Key length must not exceed ${options.maxLength}`,
        { key, maxLength: options.maxLength }
      );
    }

    if (options.pattern && !options.pattern.test(key)) {
      throw new ValidationError(
        `Key does not match required pattern`,
        { key, pattern: options.pattern.toString() }
      );
    }

    if (options.allowedChars && !options.allowedChars.test(key)) {
      throw new ValidationError(
        `Key contains invalid characters`,
        { key, allowedChars: options.allowedChars.toString() }
      );
    }
  }

  /**
   * Validate value size
   */
  public static validateSize(value: unknown, maxSizeBytes: number): void {
    const size = Buffer.byteLength(JSON.stringify(value), 'utf8');

    if (size > maxSizeBytes) {
      throw new ValidationError(
        `Value size (${size} bytes) exceeds maximum (${maxSizeBytes} bytes)`,
        { size, maxSize: maxSizeBytes }
      );
    }
  }

  /**
   * Validate required fields in object
   */
  public static validateRequiredFields(
    obj: Record<string, unknown>,
    requiredFields: string[]
  ): void {
    const missing = requiredFields.filter(field => !(field in obj));

    if (missing.length > 0) {
      throw new ValidationError(
        `Missing required fields: ${missing.join(', ')}`,
        { missingFields: missing }
      );
    }
  }
}
