import React from 'react';

// Performance monitoring utilities
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.startTime = new Map();
  }

  // Start timing an operation
  start(name) {
    this.startTime.set(name, performance.now());
  }

  // End timing and record metric
  end(name) {
    const start = this.startTime.get(name);
    if (start) {
      const duration = performance.now() - start;
      const existing = this.metrics.get(name) || { count: 0, total: 0, max: 0, min: Infinity };
      
      this.metrics.set(name, {
        count: existing.count + 1,
        total: existing.total + duration,
        max: Math.max(existing.max, duration),
        min: Math.min(existing.min, duration),
        last: duration
      });
      
      this.startTime.delete(name);
      return duration;
    }
    return null;
  }

  // Get average time for an operation
  getAverage(name) {
    const metric = this.metrics.get(name);
    return metric ? metric.total / metric.count : 0;
  }

  // Get all metrics
  getMetrics() {
    const result = {};
    for (const [name, metric] of this.metrics) {
      result[name] = {
        ...metric,
        average: metric.total / metric.count
      };
    }
    return result;
  }

  // Log performance warnings for slow operations
  checkPerformance(name, threshold = 16) { // 16ms = 1 frame
    const avg = this.getAverage(name);
    if (avg > threshold) {
      console.warn(`Performance warning: ${name} average time ${avg.toFixed(2)}ms exceeds ${threshold}ms threshold`);
    }
  }

  // Reset metrics
  reset() {
    this.metrics.clear();
    this.startTime.clear();
  }
}

// Global performance monitor instance
const perfMonitor = new PerformanceMonitor();

// Hook for component render performance monitoring
export const useRenderPerformance = (componentName) => {
  const mountTime = React.useRef(performance.now());
  
  React.useEffect(() => {
    const renderTime = performance.now() - mountTime.current;
    perfMonitor.end(`${componentName}_render`);
    
    // Warn if render time exceeds 16ms (1 frame)
    if (renderTime > 16) {
      console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`);
    }
    
    return () => {
      perfMonitor.start(`${componentName}_render`);
    };
  }, []);
};

// Hook for measuring function performance
export const useFunctionPerformance = (functionName, fn) => {
  return React.useCallback((...args) => {
    perfMonitor.start(functionName);
    try {
      const result = fn(...args);
      perfMonitor.end(functionName);
      return result;
    } catch (error) {
      perfMonitor.end(functionName);
      throw error;
    }
  }, [functionName, fn]);
};

// Firebase operation monitoring
export const monitorFirebaseOperation = async (operationName, operation) => {
  perfMonitor.start(operationName);
  try {
    const result = await operation();
    const duration = perfMonitor.end(operationName);
    
    // Log Firebase operations that take longer than 100ms
    if (duration > 100) {
      console.warn(`Slow Firebase operation: ${operationName} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    perfMonitor.end(operationName);
    console.error(`Firebase operation failed: ${operationName}`, error);
    throw error;
  }
};

// Export the monitor for direct access
export { perfMonitor };
export default perfMonitor;