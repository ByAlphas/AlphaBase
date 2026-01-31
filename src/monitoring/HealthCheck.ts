/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Component health check
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  duration: number;
}

/**
 * Health Check
 * Provides readiness and liveness probes
 */
export class HealthCheck {
  private checks: Map<string, () => Promise<HealthCheckResult>>;
  private readonly timeout: number;

  constructor(timeout: number = 5000) {
    this.checks = new Map();
    this.timeout = timeout;
  }

  /**
   * Register a health check
   */
  public register(name: string, check: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, check);
  }

  /**
   * Unregister a health check
   */
  public unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  /**
   * Execute all health checks
   */
  public async check(): Promise<{
    status: HealthStatus;
    components: ComponentHealth[];
    timestamp: number;
  }> {
    const components: ComponentHealth[] = [];
    let overallStatus: HealthStatus = 'healthy';

    for (const [name, check] of this.checks) {
      const start = Date.now();
      
      try {
        const result = await this.withTimeout(check(), this.timeout);
        const duration = Date.now() - start;

        components.push({
          name,
          status: result.status,
          message: result.message,
          duration
        });

        // Determine overall status
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        const duration = Date.now() - start;
        
        components.push({
          name,
          status: 'unhealthy',
          message: (error as Error).message,
          duration
        });

        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      components,
      timestamp: Date.now()
    };
  }

  /**
   * Liveness probe - checks if service is alive
   */
  public async liveness(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      message: 'Service is alive',
      timestamp: Date.now()
    };
  }

  /**
   * Readiness probe - checks if service is ready to accept traffic
   */
  public async readiness(): Promise<HealthCheckResult> {
    const result = await this.check();

    return {
      status: result.status,
      message: result.status === 'healthy' 
        ? 'Service is ready' 
        : `Service is ${result.status}`,
      details: { components: result.components },
      timestamp: result.timestamp
    };
  }

  /**
   * Execute check with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
      )
    ]);
  }

  /**
   * Create a simple health check
   */
  public static createSimple(name: string, fn: () => boolean | Promise<boolean>): () => Promise<HealthCheckResult> {
    return async (): Promise<HealthCheckResult> => {
      try {
        const result = await fn();
        return {
          status: result ? 'healthy' : 'unhealthy',
          message: result ? `${name} is healthy` : `${name} is unhealthy`,
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `${name} check failed: ${(error as Error).message}`,
          timestamp: Date.now()
        };
      }
    };
  }
}

/**
 * Database Health Check
 */
export class DatabaseHealthCheck extends HealthCheck {
  private readonly dataRef: Record<string, unknown>;
  private readonly maxKeys: number;
  private readonly maxSize: number;

  constructor(
    dataRef: Record<string, unknown>,
    options: {
      timeout?: number;
      maxKeys?: number;
      maxSize?: number;
    } = {}
  ) {
    super(options.timeout);
    this.dataRef = dataRef;
    this.maxKeys = options.maxKeys || 1000000;
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB

    this.registerDatabaseChecks();
  }

  private registerDatabaseChecks(): void {
    // Check database accessibility
    this.register('database', async (): Promise<HealthCheckResult> => {
      try {
        const keyCount = Object.keys(this.dataRef).length;
        const size = Buffer.byteLength(JSON.stringify(this.dataRef), 'utf8');

        let status: HealthStatus = 'healthy';
        const details: Record<string, unknown> = {
          keyCount,
          sizeBytes: size
        };

        // Check if approaching limits
        if (keyCount > this.maxKeys * 0.9) {
          status = 'degraded';
          details.warning = 'Approaching maximum key count';
        }

        if (size > this.maxSize * 0.9) {
          status = 'degraded';
          details.warning = 'Approaching maximum size';
        }

        // Check if exceeded limits
        if (keyCount > this.maxKeys || size > this.maxSize) {
          status = 'unhealthy';
          details.error = 'Database limits exceeded';
        }

        return {
          status,
          message: `Database contains ${keyCount} keys (${size} bytes)`,
          details,
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Database check failed: ${(error as Error).message}`,
          timestamp: Date.now()
        };
      }
    });

    // Check memory usage
    this.register('memory', async (): Promise<HealthCheckResult> => {
      try {
        const usage = process.memoryUsage();
        const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

        let status: HealthStatus = 'healthy';
        if (heapUsedPercent > 90) {
          status = 'unhealthy';
        } else if (heapUsedPercent > 75) {
          status = 'degraded';
        }

        return {
          status,
          message: `Heap used: ${heapUsedPercent.toFixed(2)}%`,
          details: {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            rss: usage.rss,
            external: usage.external
          },
          timestamp: Date.now()
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Memory check failed: ${(error as Error).message}`,
          timestamp: Date.now()
        };
      }
    });
  }
}
