/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric data
 */
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

/**
 * Histogram bucket
 */
interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

/**
 * Histogram metric
 */
interface HistogramMetric {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

/**
 * Metrics Collector
 * Collects and exposes metrics in Prometheus format
 */
export class MetricsCollector {
  private counters: Map<string, number>;
  private gauges: Map<string, number>;
  private histograms: Map<string, HistogramMetric>;
  private readonly defaultBuckets: number[];

  constructor(buckets?: number[]) {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.defaultBuckets = buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  /**
   * Increment a counter
   */
  public incrementCounter(name: string, value: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  /**
   * Set a gauge value
   */
  public setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Increment a gauge
   */
  public incrementGauge(name: string, value: number = 1): void {
    const current = this.gauges.get(name) || 0;
    this.gauges.set(name, current + value);
  }

  /**
   * Decrement a gauge
   */
  public decrementGauge(name: string, value: number = 1): void {
    const current = this.gauges.get(name) || 0;
    this.gauges.set(name, current - value);
  }

  /**
   * Observe a histogram value
   */
  public observeHistogram(name: string, value: number, buckets?: number[]): void {
    const usedBuckets = buckets || this.defaultBuckets;

    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        buckets: usedBuckets.map(le => ({ le, count: 0 })),
        sum: 0,
        count: 0
      });
    }

    const histogram = this.histograms.get(name)!;
    histogram.sum += value;
    histogram.count++;

    // Update buckets
    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Get counter value
   */
  public getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Get gauge value
   */
  public getGauge(name: string): number {
    return this.gauges.get(name) || 0;
  }

  /**
   * Get histogram stats
   */
  public getHistogram(name: string): HistogramMetric | null {
    return this.histograms.get(name) || null;
  }

  /**
   * Reset a counter
   */
  public resetCounter(name: string): void {
    this.counters.delete(name);
  }

  /**
   * Reset a gauge
   */
  public resetGauge(name: string): void {
    this.gauges.delete(name);
  }

  /**
   * Reset all metrics
   */
  public resetAll(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Get all metrics
   */
  public getAllMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, HistogramMetric>;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms)
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  public exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${value}`);
    }

    // Gauges
    for (const [name, value] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Histograms
    for (const [name, histogram] of this.histograms) {
      lines.push(`# TYPE ${name} histogram`);
      
      for (const bucket of histogram.buckets) {
        lines.push(`${name}_bucket{le="${bucket.le}"} ${bucket.count}`);
      }
      
      lines.push(`${name}_bucket{le="+Inf"} ${histogram.count}`);
      lines.push(`${name}_sum ${histogram.sum}`);
      lines.push(`${name}_count ${histogram.count}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Export metrics as JSON
   */
  public exportJSON(): string {
    return JSON.stringify(this.getAllMetrics(), null, 2);
  }

  /**
   * Measure operation duration
   */
  public measureDuration(name: string): () => void {
    const start = Date.now();
    return () => {
      const duration = (Date.now() - start) / 1000; // seconds
      this.observeHistogram(`${name}_duration_seconds`, duration);
    };
  }

  /**
   * Wrap async function with timing
   */
  public async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const end = this.measureDuration(name);
    try {
      const result = await fn();
      end();
      return result;
    } catch (error) {
      end();
      this.incrementCounter(`${name}_errors_total`);
      throw error;
    }
  }

  /**
   * Wrap sync function with timing
   */
  public measureSync<T>(name: string, fn: () => T): T {
    const end = this.measureDuration(name);
    try {
      const result = fn();
      end();
      return result;
    } catch (error) {
      end();
      this.incrementCounter(`${name}_errors_total`);
      throw error;
    }
  }
}

/**
 * Database-specific metrics
 */
export class DatabaseMetrics extends MetricsCollector {
  constructor() {
    super();
    
    // Initialize common database metrics
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Counters
    this.setGauge('alphabase_keys_total', 0);
    this.setGauge('alphabase_size_bytes', 0);
    this.setGauge('alphabase_ttl_keys_total', 0);
    
    // Operation counters
    this.incrementCounter('alphabase_operations_total', 0);
    this.incrementCounter('alphabase_reads_total', 0);
    this.incrementCounter('alphabase_writes_total', 0);
    this.incrementCounter('alphabase_deletes_total', 0);
    this.incrementCounter('alphabase_errors_total', 0);
  }

  /**
   * Record a read operation
   */
  public recordRead(): void {
    this.incrementCounter('alphabase_reads_total');
    this.incrementCounter('alphabase_operations_total');
  }

  /**
   * Record a write operation
   */
  public recordWrite(): void {
    this.incrementCounter('alphabase_writes_total');
    this.incrementCounter('alphabase_operations_total');
  }

  /**
   * Record a delete operation
   */
  public recordDelete(): void {
    this.incrementCounter('alphabase_deletes_total');
    this.incrementCounter('alphabase_operations_total');
  }

  /**
   * Record an error
   */
  public recordError(): void {
    this.incrementCounter('alphabase_errors_total');
  }

  /**
   * Update database statistics
   */
  public updateStats(stats: { keys: number; size: number; ttlKeys: number }): void {
    this.setGauge('alphabase_keys_total', stats.keys);
    this.setGauge('alphabase_size_bytes', stats.size);
    this.setGauge('alphabase_ttl_keys_total', stats.ttlKeys);
  }

  /**
   * Record operation duration
   */
  public recordOperation(operation: string, durationSeconds: number): void {
    this.observeHistogram(`alphabase_operation_duration_seconds{operation="${operation}"}`, durationSeconds);
  }
}
