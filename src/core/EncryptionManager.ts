import * as crypto from 'crypto';
import { ValidationError } from '../errors';

/**
 * Encryption algorithm types
 */
export type EncryptionAlgorithm = 'aes-256-cbc' | 'aes-256-gcm' | 'none';

/**
 * Encryption options
 */
export interface EncryptionOptions {
  algorithm?: EncryptionAlgorithm;
  key?: string;
  enabled?: boolean;
  /** 
   * Optional salt for key derivation (hex string).
   * If not provided, a random salt will be generated.
   * IMPORTANT: Store this salt securely to decrypt data later.
   */
  salt?: string;
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  data: string;
  iv?: string;
  authTag?: string;
  /** Salt used for key derivation (hex string) - MUST be stored to decrypt */
  salt?: string;
  algorithm: EncryptionAlgorithm;
}

/**
 * Encryption Manager
 * Handles data encryption and decryption with multiple algorithms
 * 
 * SECURITY NOTE: Uses unique random salt per instance for proper key derivation.
 * The salt MUST be stored with encrypted data to enable decryption.
 */
export class EncryptionManager {
  private readonly algorithm: EncryptionAlgorithm;
  private readonly key: Buffer | null;
  private readonly salt: Buffer | null;
  private readonly enabled: boolean;

  constructor(options: EncryptionOptions = {}) {
    this.algorithm = options.algorithm || 'aes-256-cbc';
    this.enabled = options.enabled !== false && !!options.key;
    
    if (this.enabled && options.key) {
      // Use provided salt or generate a new random salt
      this.salt = options.salt 
        ? Buffer.from(options.salt, 'hex')
        : crypto.randomBytes(32);
      
      // Derive a 32-byte key from the provided key using scrypt
      // Using unique salt per instance prevents rainbow table attacks
      this.key = crypto.scryptSync(options.key, this.salt, 32);
    } else {
      this.key = null;
      this.salt = null;
    }
  }

  /**
   * Check if encryption is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current algorithm
   */
  public getAlgorithm(): EncryptionAlgorithm {
    return this.algorithm;
  }

  /**
   * Get salt as hex string (for storage/persistence)
   * IMPORTANT: This salt MUST be stored to decrypt data later
   */
  public getSalt(): string | null {
    return this.salt ? this.salt.toString('hex') : null;
  }

  /**
   * Encrypt data
   */
  public encrypt(plaintext: string): EncryptedData {
    if (!this.enabled || !this.key) {
      return {
        data: plaintext,
        algorithm: 'none'
      };
    }

    try {
      if (this.algorithm === 'aes-256-gcm') {
        return this.encryptAesGcm(plaintext);
      } else if (this.algorithm === 'aes-256-cbc') {
        return this.encryptAesCbc(plaintext);
      } else {
        return {
          data: plaintext,
          algorithm: 'none'
        };
      }
    } catch (error) {
      throw new ValidationError('Encryption failed', { error: (error as Error).message });
    }
  }

  /**
   * Decrypt data
   */
  public decrypt(encrypted: EncryptedData): string {
    if (!this.enabled || !this.key || encrypted.algorithm === 'none') {
      return encrypted.data;
    }

    try {
      if (encrypted.algorithm === 'aes-256-gcm') {
        return this.decryptAesGcm(encrypted);
      } else if (encrypted.algorithm === 'aes-256-cbc') {
        return this.decryptAesCbc(encrypted);
      } else {
        return encrypted.data;
      }
    } catch (error) {
      throw new ValidationError('Decryption failed', { error: (error as Error).message });
    }
  }

  /**
   * Encrypt using AES-256-CBC
   */
  private encryptAesCbc(plaintext: string): EncryptedData {
    if (!this.key) throw new ValidationError('Encryption key not set');
    if (!this.salt) throw new ValidationError('Encryption salt not set');

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      data: encrypted,
      iv: iv.toString('hex'),
      salt: this.salt.toString('hex'), // Include salt for decryption
      algorithm: 'aes-256-cbc'
    };
  }

  /**
   * Decrypt using AES-256-CBC
   */
  private decryptAesCbc(encrypted: EncryptedData): string {
    if (!this.key) throw new ValidationError('Encryption key not set');
    if (!encrypted.iv) throw new ValidationError('IV not found in encrypted data');

    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
    
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt using AES-256-GCM (with authentication)
   */
  private encryptAesGcm(plaintext: string): EncryptedData {
    if (!this.key) throw new ValidationError('Encryption key not set');
    if (!this.salt) throw new ValidationError('Encryption salt not set');

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: this.salt.toString('hex'), // Include salt for decryption
      algorithm: 'aes-256-gcm'
    };
  }

  /**
   * Decrypt using AES-256-GCM
   */
  private decryptAesGcm(encrypted: EncryptedData): string {
    if (!this.key) throw new ValidationError('Encryption key not set');
    if (!encrypted.iv) throw new ValidationError('IV not found in encrypted data');
    if (!encrypted.authTag) throw new ValidationError('Auth tag not found in encrypted data');

    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv) as crypto.DecipherGCM;
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt JSON data
   */
  public encryptJSON(data: unknown): string {
    const plaintext = JSON.stringify(data);
    const encrypted = this.encrypt(plaintext);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt JSON data
   */
  public decryptJSON(encryptedJSON: string): unknown {
    const encrypted = JSON.parse(encryptedJSON) as EncryptedData;
    const plaintext = this.decrypt(encrypted);
    return JSON.parse(plaintext);
  }

  /**
   * Generate a random encryption key
   */
  public static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash data (for integrity checks)
   */
  public hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify hash
   */
  public verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }
}
