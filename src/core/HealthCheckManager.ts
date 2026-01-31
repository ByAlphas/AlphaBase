import * as fs from 'fs';
import * as os from 'os';

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health check result
 */
export interface ComponentHealth {
  /** Component name */
  name: string;
  /** Health status */
  status: HealthStatus;
  /** Response time in milliseconds */
  responseTime: number;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Overall health check result
 */
export interface HealthCheckResult {
  /** Overall status */
  status: HealthStatus;
  /** Timestamp of check */
  timestamp: Date;
  /** Uptime in milliseconds */
  uptime: number;
  /** Component health checks */
  components: ComponentHealth[];
  /** System information */
  system?: {
    memory: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
    cpu: {
      cores: number;
      loadAverage: number[];
    };
    platform: string;
    nodeVersion: string;
  };
}

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<ComponentHealth>;

/**
 * Health Check Manager
 * Provides health monitoring and readiness/liveness checks
 */
export class HealthCheckManager {
  private readonly checks: Map<string, HealthCheckFunction>;
  private readonly startTime: number;
  private isReady: boolean;
  private isAlive: boolean;

  constructor() {
    this.checks = new Map();
    this.startTime = Date.now();
    this.isReady = false;
    this.isAlive = true;
  }

  /**
   * Register a health check
   */
  public registerCheck(name: string, check: HealthCheckFunction): void {
    this.checks.set(name, check);
  }

  /**
   * Remove a health check
   */
  public unregisterCheck(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Mark service as ready
   */
  public setReady(ready: boolean): void {
    this.isReady = ready;
  }

  /**
   * Mark service as alive
   */
  public setAlive(alive: boolean): void {
    this.isAlive = alive;
  }

  /**
   * Check if service is ready
   */
  public getReadiness(): boolean {
    return this.isReady;
  }

  /**
   * Check if service is alive
   */
  public getLiveness(): boolean {
    return this.isAlive;
  }

  /**
   * Run all health checks
   */
  public async getHealth(includeSystem: boolean = true): Promise<HealthCheckResult> {
    const components: ComponentHealth[] = [];
    let overallStatus: HealthStatus = 'healthy';

    // Run all registered checks
    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        components.push(result);

        // Update overall status
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        const errorResult: ComponentHealth = {
          name,
          status: 'unhealthy',
          responseTime: 0,
          error: (error as Error).message
        };
        components.push(errorResult);
        overallStatus = 'unhealthy';
      }
    }

    // Add readiness and liveness checks
    components.push({
      name: 'readiness',
      status: this.isReady ? 'healthy' : 'unhealthy',
      responseTime: 0,
      details: { ready: this.isReady }
    });

    components.push({
      name: 'liveness',
      status: this.isAlive ? 'healthy' : 'unhealthy',
      responseTime: 0,
      details: { alive: this.isAlive }
    });

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      components
    };

    // Add system information if requested
    if (includeSystem) {
      result.system = this.getSystemInfo();
    }

    return result;
  }

  /**
   * Get system information
   */
  private getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      memory: {
        used: usedMem,
        free: freeMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100
      },
      cpu: {
        cores: os.cpus().length,
        loadAverage: os.loadavg()
      },
      platform: os.platform(),
      nodeVersion: process.version
    };
  }

  /**
   * Create a file system health check
   */
  public static createFileSystemCheck(filePath: string): HealthCheckFunction {
    return async () => {
      const start = Date.now();
      
      try {
        // Check if file exists and is readable
        await fs.promises.access(filePath, fs.constants.R_OK | fs.constants.W_OK);
        
        const stats = await fs.promises.stat(filePath);
        const responseTime = Date.now() - start;

        return {
          name: 'filesystem',
          status: 'healthy',
          responseTime,
          details: {
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          }
        };
      } catch (error) {
        const responseTime = Date.now() - start;
        
        return {
          name: 'filesystem',
          status: 'unhealthy',
          responseTime,
          error: (error as Error).message,
          details: {
            path: filePath
          }
        };
      }
    };
  }

  /**
   * Create a memory health check
   */
  public static createMemoryCheck(thresholdPercent: number = 90): HealthCheckFunction {
    return async () => {
      const start = Date.now();
      
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const usedPercent = (usedMem / totalMem) * 100;
      
      const responseTime = Date.now() - start;

      let status: HealthStatus = 'healthy';
      if (usedPercent >= thresholdPercent) {
        status = 'unhealthy';
      } else if (usedPercent >= thresholdPercent * 0.8) {
        status = 'degraded';
      }

      return {
        name: 'memory',
        status,
        responseTime,
        details: {
          used: usedMem,
          free: freeMem,
          total: totalMem,
          percentage: usedPercent,
          threshold: thresholdPercent
        }
      };
    };
  }

  /**
   * Create a database health check
   */
  public static createDatabaseCheck(
    checkFunction: () => Promise<boolean>
  ): HealthCheckFunction {
    return async () => {
      const start = Date.now();
      
      try {
        const isHealthy = await checkFunction();
        const responseTime = Date.now() - start;

        return {
          name: 'database',
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime
        };
      } catch (error) {
        const responseTime = Date.now() - start;
        
        return {
          name: 'database',
          status: 'unhealthy',
          responseTime,
          error: (error as Error).message
        };
      }
    };
  }

  /**
   * Create a custom health check with timeout
   */
  public static createTimedCheck(
    name: string,
    checkFunction: () => Promise<boolean>,
    timeoutMs: number = 5000
  ): HealthCheckFunction {
    return async () => {
      const start = Date.now();
      
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), timeoutMs);
        });

        const isHealthy = await Promise.race([
          checkFunction(),
          timeoutPromise
        ]);

        const responseTime = Date.now() - start;

        return {
          name,
          status: isHealthy ? 'healthy' : 'unhealthy',
          responseTime
        };
      } catch (error) {
        const responseTime = Date.now() - start;
        
        return {
          name,
          status: 'unhealthy',
          responseTime,
          error: (error as Error).message
        };
      }
    };
  }

  /**
   * Format health check result as HTTP response
   */
  public static formatHttpResponse(health: HealthCheckResult): {
    statusCode: number;
    body: string;
  } {
    let statusCode = 200;
    
    if (health.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    } else if (health.status === 'degraded') {
      statusCode = 200; // Still serving requests
    }

    return {
      statusCode,
      body: JSON.stringify(health, null, 2)
    };
  }
}
