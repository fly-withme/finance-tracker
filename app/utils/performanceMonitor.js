export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.activeOperations = new Map();
  }

  startOperation(operationName) {
    const startTime = performance.now();
    const operationId = `${operationName}_${Date.now()}_${Math.random()}`;
    
    this.activeOperations.set(operationId, {
      name: operationName,
      startTime,
      memoryBefore: this.getMemoryUsage()
    });
    
    return operationId;
  }

  endOperation(operationId) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return null;

    const endTime = performance.now();
    const duration = endTime - operation.startTime;
    const memoryAfter = this.getMemoryUsage();
    
    const metric = {
      name: operation.name,
      duration,
      memoryBefore: operation.memoryBefore,
      memoryAfter,
      memoryDelta: memoryAfter - operation.memoryBefore,
      timestamp: new Date().toISOString()
    };

    // Store metric
    if (!this.metrics.has(operation.name)) {
      this.metrics.set(operation.name, []);
    }
    this.metrics.get(operation.name).push(metric);

    // Keep only last 10 measurements per operation
    const measurements = this.metrics.get(operation.name);
    if (measurements.length > 10) {
      measurements.shift();
    }

    this.activeOperations.delete(operationId);
    
    // Log slow operations
    if (duration > 5000) { // 5 seconds
      console.warn(`Slow operation detected: ${operation.name} took ${duration.toFixed(2)}ms`);
    }

    return metric;
  }

  getMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return 0;
  }

  getOperationStats(operationName) {
    const measurements = this.metrics.get(operationName);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const durations = measurements.map(m => m.duration);
    const memoryDeltas = measurements.map(m => m.memoryDelta);

    return {
      operationName,
      count: measurements.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      averageMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
      lastRun: measurements[measurements.length - 1].timestamp
    };
  }

  getAllStats() {
    const stats = {};
    for (const operationName of this.metrics.keys()) {
      stats[operationName] = this.getOperationStats(operationName);
    }
    return stats;
  }

  // Check if system is under heavy load
  isSystemOverloaded() {
    const activeOps = this.activeOperations.size;
    const memoryUsage = this.getMemoryUsage();
    
    // Check if we have too many active operations
    if (activeOps > 3) return true;
    
    // Check memory usage (threshold at 100MB)
    if (memoryUsage > 100 * 1024 * 1024) return true;
    
    // Check if any operation is taking too long
    const now = performance.now();
    for (const operation of this.activeOperations.values()) {
      if (now - operation.startTime > 15000) { // 15 seconds
        return true;
      }
    }
    
    return false;
  }

  // Get recommendations for optimization
  getOptimizationRecommendations() {
    const stats = this.getAllStats();
    const recommendations = [];

    for (const [name, stat] of Object.entries(stats)) {
      if (stat.averageDuration > 10000) { // 10 seconds
        recommendations.push({
          type: 'SLOW_OPERATION',
          operation: name,
          message: `${name} is running slowly (avg: ${(stat.averageDuration / 1000).toFixed(1)}s)`,
          suggestion: 'Consider reducing input size or optimizing processing'
        });
      }

      if (stat.averageMemoryDelta > 50 * 1024 * 1024) { // 50MB
        recommendations.push({
          type: 'HIGH_MEMORY_USAGE',
          operation: name,
          message: `${name} uses significant memory (avg: ${(stat.averageMemoryDelta / 1024 / 1024).toFixed(1)}MB)`,
          suggestion: 'Consider processing data in smaller chunks'
        });
      }
    }

    return recommendations;
  }

  // Clear old metrics to prevent memory leaks
  cleanup() {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    
    for (const [operationName, measurements] of this.metrics.entries()) {
      const filtered = measurements.filter(m => 
        new Date(m.timestamp).getTime() > cutoffTime
      );
      
      if (filtered.length === 0) {
        this.metrics.delete(operationName);
      } else {
        this.metrics.set(operationName, filtered);
      }
    }
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto cleanup every hour
setInterval(() => {
  performanceMonitor.cleanup();
}, 60 * 60 * 1000);