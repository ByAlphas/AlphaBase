import { ValidationError } from '../errors';

/**
 * Input Sanitizer
 * Provides XSS prevention and input sanitization
 */
export class InputSanitizer {
  /**
   * Sanitize string input to prevent XSS
   */
  public static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize object recursively
   */
  public static sanitizeObject(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Remove dangerous HTML tags
   */
  public static stripHtml(input: string): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Remove SQL injection patterns
   */
  public static sanitizeSql(input: string): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    const dangerous = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
      /(;|--|\/\*|\*\/|xp_|sp_)/gi,
      /('|('')|(\-\-)|;|\/\*|\*\/)/gi
    ];

    let sanitized = input;
    for (const pattern of dangerous) {
      sanitized = sanitized.replace(pattern, '');
    }

    return sanitized;
  }

  /**
   * Remove NoSQL injection patterns
   */
  public static sanitizeNoSql(input: unknown): unknown {
    if (typeof input === 'string') {
      // Remove MongoDB operators
      return input.replace(/\$[\w]+/g, '');
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeNoSql(item));
    }

    if (input !== null && typeof input === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        // Skip keys starting with $
        if (!key.startsWith('$')) {
          sanitized[key] = this.sanitizeNoSql(value);
        }
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Validate and sanitize file path
   */
  public static sanitizePath(input: string): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Path must be a string', { input });
    }

    // Remove path traversal attempts
    const sanitized = input
      .replace(/\.\./g, '')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/');

    // Remove dangerous characters
    return sanitized.replace(/[<>:"|?*]/g, '');
  }

  /**
   * Validate email format
   */
  public static isValidEmail(email: string): boolean {
    if (typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  public static isValidUrl(url: string): boolean {
    if (typeof url !== 'string') {
      return false;
    }

    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Sanitize filename
   */
  public static sanitizeFilename(filename: string): string {
    if (typeof filename !== 'string') {
      throw new ValidationError('Filename must be a string', { filename });
    }

    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.+/g, '.')
      .replace(/_+/g, '_')
      .slice(0, 255);
  }

  /**
   * Escape regular expression special characters
   */
  public static escapeRegex(input: string): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Remove control characters
   */
  public static removeControlChars(input: string): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    // Remove control characters except newline, tab, and carriage return
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Truncate string to maximum length
   */
  public static truncate(input: string, maxLength: number, suffix: string = '...'): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    if (typeof maxLength !== 'number' || maxLength <= 0) {
      throw new ValidationError('Max length must be a positive number', { maxLength });
    }

    if (input.length <= maxLength) {
      return input;
    }

    return input.slice(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Whitelist characters
   */
  public static whitelist(input: string, allowedChars: RegExp): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    return input.split('').filter(char => allowedChars.test(char)).join('');
  }

  /**
   * Blacklist characters
   */
  public static blacklist(input: string, forbiddenChars: RegExp): string {
    if (typeof input !== 'string') {
      throw new ValidationError('Input must be a string', { input });
    }

    return input.split('').filter(char => !forbiddenChars.test(char)).join('');
  }
}
