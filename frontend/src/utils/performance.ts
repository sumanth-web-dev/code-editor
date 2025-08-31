/**
 * Performance monitoring utilities for the code editor.
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers(): void {
    // Monitor navigation timing
    if ('PerformanceObserver' in window) {
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.fetchStart);
              this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.fetchStart);
              this.recordMetric('first_paint', navEntry.loadEventEnd - navEntry.fetchStart);
            }
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (error) {
        console.warn('Navigation timing observer not supported:', error);
      }

      // Monitor resource timing
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              if (resourceEntry.name.includes('monaco') || resourceEntry.name.includes('api')) {
                this.recordMetric('resource_load_time', resourceEntry.responseEnd - resourceEntry.fetchStart, {
                  resource: resourceEntry.name,
                  size: resourceEntry.transferSize
                });
              }
            }
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (error) {
        console.warn('Resource timing observer not supported:', error);
      }
    }
  }

  public recordMetric(name: string, value: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);

    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log significant performance issues
    if (this.isSignificantMetric(name, value)) {
      console.warn(`Performance issue detected: ${name} = ${value}ms`, metadata);
    }
  }

  private isSignificantMetric(name: string, value: number): boolean {
    const thresholds: Record<string, number> = {
      'page_load_time': 3000,
      'api_request_time': 2000,
      'code_execution_time': 5000,
      'editor_render_time': 1000
    };

    return value > (thresholds[name] || 1000);
  }

  public measureApiRequest<T>(
    requestName: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    return requestFn().then(
      (result) => {
        const endTime = performance.now();
        this.recordMetric('api_request_time', endTime - startTime, {
          request: requestName,
          success: true
        });
        return result;
      },
      (error) => {
        const endTime = performance.now();
        this.recordMetric('api_request_time', endTime - startTime, {
          request: requestName,
          success: false,
          error: error.message
        });
        throw error;
      }
    );
  }

  public measureCodeExecution<T>(
    executionFn: () => T
  ): T {
    const startTime = performance.now();
    try {
      const result = executionFn();
      const endTime = performance.now();
      this.recordMetric('code_execution_time', endTime - startTime);
      return result;
    } catch (error) {
      const endTime = performance.now();
      this.recordMetric('code_execution_time', endTime - startTime, {
        error: true
      });
      throw error;
    }
  }

  public measureRender(componentName: string, renderFn: () => void): void {
    const startTime = performance.now();
    renderFn();
    const endTime = performance.now();
    this.recordMetric('editor_render_time', endTime - startTime, {
      component: componentName
    });
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public getAverageMetric(name: string): number {
    const relevantMetrics = this.metrics.filter(m => m.name === name);
    if (relevantMetrics.length === 0) return 0;
    
    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / relevantMetrics.length;
  }

  public getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    const metricNamesSet = new Set(this.metrics.map(m => m.name));
    const metricNames = Array.from(metricNamesSet);
    
    for (const name of metricNames) {
      const metrics = this.metrics.filter(m => m.name === name);
      report[name] = {
        count: metrics.length,
        average: this.getAverageMetric(name),
        min: Math.min(...metrics.map(m => m.value)),
        max: Math.max(...metrics.map(m => m.value)),
        latest: metrics[metrics.length - 1]?.value || 0
      };
    }
    
    return report;
  }

  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  return {
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    measureApiRequest: performanceMonitor.measureApiRequest.bind(performanceMonitor),
    measureRender: performanceMonitor.measureRender.bind(performanceMonitor),
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getReport: performanceMonitor.getPerformanceReport.bind(performanceMonitor)
  };
};

// Performance decorator for class methods
export function measurePerformance(metricName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const startTime = performance.now();
      try {
        const result = method.apply(this, args);
        const endTime = performance.now();
        performanceMonitor.recordMetric(metricName, endTime - startTime, {
          method: propertyName,
          class: target.constructor.name
        });
        return result;
      } catch (error) {
        const endTime = performance.now();
        performanceMonitor.recordMetric(metricName, endTime - startTime, {
          method: propertyName,
          class: target.constructor.name,
          error: true
        });
        throw error;
      }
    };
  };
}

export default performanceMonitor;