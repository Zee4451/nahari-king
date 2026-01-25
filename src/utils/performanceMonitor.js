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

// Performance reporting interval variable
let performanceReportingInterval;

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

// Firebase operation monitoring with enhanced tracking and optimization suggestions
export const monitorFirebaseOperation = async (operationName, operation) => {
  perfMonitor.start(operationName);
  try {
    const result = await operation();
    const duration = perfMonitor.end(operationName);
    
    // Log Firebase operations that take longer than 100ms
    if (duration > 100) {
      console.warn(`Slow Firebase operation: ${operationName} took ${duration.toFixed(2)}ms`);
      
      // Provide optimization suggestions based on operation type
      if (operationName === 'getAllTables' && duration > 1000) {
        console.info('💡 Optimization suggestion: Consider using getTablesByIds for partial loading or implement pagination');
      } else if (operationName === 'getAllMenuItems' && duration > 500) {
        console.info('💡 Optimization suggestion: Menu items data might benefit from selective field querying');
      } else if (operationName.includes('update') && duration > 500) {
        console.info('💡 Optimization suggestion: Consider using batch operations for multiple updates');
      } else if (operationName.includes('addHistory') && duration > 500) {
        console.info('💡 Optimization suggestion: Consider batchAddHistory for multiple history entries');
      }
    }
    
    // Track operation frequency
    const frequencyKey = `${operationName}_frequency`;
    const currentCount = perfMonitor.metrics.get(frequencyKey)?.count || 0;
    perfMonitor.metrics.set(frequencyKey, {
      count: currentCount + 1,
      total: 0,
      max: 0,
      min: 0,
      last: Date.now()
    });
    
    // Alert if operation frequency is too high (potential cost concern)
    if (currentCount > 50) { // More than 50 operations of the same type
      console.warn(`High frequency Firebase operations detected: ${operationName} called ${currentCount} times`);
      if (operationName.includes('update')) {
        console.info('💡 Consider debouncing rapid updates or using batch operations');
      }
    }
    
    return result;
  } catch (error) {
    perfMonitor.end(operationName);
    console.error(`Firebase operation failed: ${operationName}`, error);
    throw error;
  }
};

// Monitor Firestore listener performance
export const monitorFirestoreListener = (listenerName, unsubscribeFn) => {
  const startTime = Date.now();
  
  // Wrap the unsubscribe function to track listener duration
  const wrappedUnsubscribe = () => {
    const duration = Date.now() - startTime;
    console.log(`Firestore listener '${listenerName}' active for ${Math.floor(duration/1000)} seconds`);
    
    // Check for long-running listeners that might cause performance issues
    if (duration > 300000) { // 5 minutes
      console.warn(`Long-running Firestore listener detected: ${listenerName}`);
    }
    
    unsubscribeFn();
  };
  
  return wrappedUnsubscribe;
};

// Enhanced performance report with optimization recommendations
export const getPerformanceReport = () => {
  const metrics = perfMonitor.getMetrics();
  const report = {
    timestamp: new Date().toISOString(),
    operations: {},
    warnings: [],
    recommendations: [],
    optimizationOpportunities: []
  };
  
  // Analyze Firebase operations
  Object.entries(metrics).forEach(([name, data]) => {
    if (name.includes('Firebase') || name.includes('getAll') || name.includes('update') || name.includes('add')) {
      report.operations[name] = {
        count: data.count,
        average: data.average,
        max: data.max,
        min: data.min,
        totalDuration: data.total
      };
      
      // Generate warnings
      if (data.average > 1000) {
        report.warnings.push(`Critical slow operation: ${name} averages ${data.average.toFixed(2)}ms`);
        report.optimizationOpportunities.push({
          operation: name,
          issue: 'Extremely slow operation',
          suggestion: getOptimizationSuggestion(name)
        });
      } else if (data.average > 200) {
        report.warnings.push(`Slow operation: ${name} averages ${data.average.toFixed(2)}ms`);
        report.optimizationOpportunities.push({
          operation: name,
          issue: 'Slow operation detected',
          suggestion: getOptimizationSuggestion(name)
        });
      }
      
      if (data.count > 100) {
        report.warnings.push(`High frequency: ${name} called ${data.count} times`);
        if (name.includes('update') || name.includes('add')) {
          report.optimizationOpportunities.push({
            operation: name,
            issue: 'High frequency operations',
            suggestion: 'Consider debouncing or batching operations'
          });
        }
      }
    }
  });
  
  // Generate recommendations
  if (report.warnings.length > 0) {
    report.recommendations.push('Implement caching for frequently accessed data');
    report.recommendations.push('Use batch operations for multiple document updates');
    report.recommendations.push('Consider pagination for large dataset queries');
    report.recommendations.push('Implement connection state awareness to prevent offline operations');
  }
  
  return report;
};

// Helper function to provide specific optimization suggestions
const getOptimizationSuggestion = (operationName) => {
  if (operationName === 'getAllTables') {
    return 'Use getTablesByIds for partial loading or implement pagination with limit/startAfter';
  } else if (operationName === 'getAllMenuItems') {
    return 'Consider selective field querying or implement lazy loading';
  } else if (operationName.includes('updateTable')) {
    return 'Use batchUpdateTables for multiple table updates';
  } else if (operationName.includes('addHistory')) {
    return 'Use batchAddHistory for multiple history entries';
  } else if (operationName.includes('updateMenuItem')) {
    return 'Use bulkUpdateMenuItems for multiple menu item updates';
  }
  return 'Review Firestore indexes and consider implementing caching';
};

// Enhanced periodic performance reporting with actionable insights
export const startPerformanceReporting = (intervalMs = 30000) => { // Every 30 seconds
  if (performanceReportingInterval) {
    clearInterval(performanceReportingInterval);
  }
  
  performanceReportingInterval = setInterval(() => {
    const report = getPerformanceReport();
    if (report.warnings.length > 0 || Object.keys(report.operations).length > 0) {
      console.group('📊 Performance Report');
      console.table(report.operations);
      
      if (report.warnings.length > 0) {
        console.warn('⚠️  Warnings:', report.warnings);
      }
      
      if (report.optimizationOpportunities.length > 0) {
        console.group('🔧 Optimization Opportunities');
        report.optimizationOpportunities.forEach(opportunity => {
          console.log(`${opportunity.operation}: ${opportunity.issue}`);
          console.info(`💡 Suggestion: ${opportunity.suggestion}`);
        });
        console.groupEnd();
      }
      
      if (report.recommendations.length > 0) {
        console.info('✅ Recommendations:', report.recommendations);
      }
      
      console.groupEnd();
    }
  }, intervalMs);
};

export const stopPerformanceReporting = () => {
  if (performanceReportingInterval) {
    clearInterval(performanceReportingInterval);
    performanceReportingInterval = null;
  }
};

// Export the monitor for direct access
export { perfMonitor };
export default perfMonitor;

// Start performance reporting on module load
if (typeof window !== 'undefined') {
  startPerformanceReporting();
}