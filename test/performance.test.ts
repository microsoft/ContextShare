// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { createTestPaths, createMockFileStructure, logTestSuccess, logTestStep } from './testUtils';

/**
 * Performance tests for large catalogs, memory usage, and concurrent operations
 */

interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage: number;
  success: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = (process as any).memoryUsage?.()?.heapUsed || 0;
    
    try {
      const result = await fn();
      const endTime = Date.now();
      const endMemory = (process as any).memoryUsage?.()?.heapUsed || 0;
      
      this.metrics.push({
        operation,
        duration: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        success: true
      });
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      const endMemory = (process as any).memoryUsage?.()?.heapUsed || 0;
      
      this.metrics.push({
        operation,
        duration: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        success: false
      });
      
      throw error;
    }
  }
  
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
  
  getAverageDuration(operation: string): number {
    const operationMetrics = this.metrics.filter(m => m.operation === operation && m.success);
    if (operationMetrics.length === 0) return 0;
    
    const totalDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalDuration / operationMetrics.length;
  }
  
  getMaxMemoryUsage(): number {
    return Math.max(...this.metrics.map(m => m.memoryUsage));
  }
}

async function testLargeCatalogHandling() {
  console.log('Testing large catalog handling...');
  
  const monitor = new PerformanceMonitor();
  
  // Create a large mock file structure
  const largeFileStructure: Record<string, string> = {};
  
  // Generate 1000 files across different categories
  for (let i = 0; i < 1000; i++) {
    const category = ['chatmodes', 'prompts', 'tasks', 'instructions', 'mcp'][i % 5];
    const fileName = `file-${i}.${category === 'mcp' ? 'json' : 'md'}`;
    const filePath = `/large-catalog/${category}/${fileName}`;
    
    if (category === 'mcp') {
      largeFileStructure[filePath] = JSON.stringify({
        mcpServers: {
          [`server-${i}`]: {
            command: `test-command-${i}`,
            args: [`arg-${i}`]
          }
        }
      });
    } else {
      largeFileStructure[filePath] = `Content for file ${i} in category ${category}`;
    }
  }
  
  const fileService = new MockFileService(largeFileStructure);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Large catalog discovery
  logTestStep('Large catalog discovery performance');
  
  await monitor.measureOperation('large-catalog-discovery', async () => {
    const mockRepo = {
      id: 'large-repo',
      name: 'Large Repository',
      rootPath: '/large-catalog',
      catalogPath: '/large-catalog',
      runtimePath: '/large-catalog/.github',
      isActive: true
    };
    
    const resources = await resourceService.discoverResources(mockRepo);
    
    if (resources.length !== 1000) {
      throw new Error(`Expected 1000 resources, got ${resources.length}`);
    }
  });
  
  // Test 2: Resource state calculation for large catalog
  logTestStep('Resource state calculation performance');
  
  const mockRepo = {
    id: 'large-repo',
    name: 'Large Repository',
    rootPath: '/large-catalog',
    catalogPath: '/large-catalog',
    runtimePath: '/large-catalog/.github',
    isActive: true
  };
  
  const resources = await resourceService.discoverResources(mockRepo);
  
  await monitor.measureOperation('resource-state-calculation', async () => {
    for (const resource of resources.slice(0, 100)) { // Test first 100 resources
      await resourceService.getResourceState(resource);
    }
  });
  
  const avgDiscoveryTime = monitor.getAverageDuration('large-catalog-discovery');
  const avgStateTime = monitor.getAverageDuration('resource-state-calculation');
  
  console.log(`Average discovery time: ${avgDiscoveryTime}ms`);
  console.log(`Average state calculation time: ${avgStateTime}ms`);
  
  // Performance thresholds (adjust based on requirements)
  if (avgDiscoveryTime > 5000) { // 5 seconds
    throw new Error(`Discovery too slow: ${avgDiscoveryTime}ms`);
  }
  
  if (avgStateTime > 100) { // 100ms per resource
    throw new Error(`State calculation too slow: ${avgStateTime}ms`);
  }
  
  logTestSuccess('large catalog handling');
}

async function testMemoryUsage() {
  console.log('Testing memory usage patterns...');
  
  const monitor = new PerformanceMonitor();
  
  // Test 1: Memory usage during operations
  logTestStep('Memory usage during operations');
  
  const testPaths = createTestPaths('memory-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Perform multiple operations and monitor memory
  for (let i = 0; i < 10; i++) {
    await monitor.measureOperation('memory-test-operation', async () => {
      // Simulate resource discovery and processing
      const mockRepo = {
        id: `repo-${i}`,
        name: `Repository ${i}`,
        rootPath: testPaths.repoRoot,
        catalogPath: testPaths.catalogPath,
        runtimePath: testPaths.runtimePath,
        isActive: true
      };
      
      const resources = await resourceService.discoverResources(mockRepo);
      
      // Process each resource
      for (const resource of resources) {
        await resourceService.getResourceState(resource);
      }
    });
  }
  
  const maxMemoryUsage = monitor.getMaxMemoryUsage();
  console.log(`Maximum memory usage: ${(maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
  
  // Memory threshold (adjust based on requirements)
  if (maxMemoryUsage > 50 * 1024 * 1024) { // 50MB
    throw new Error(`Memory usage too high: ${(maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
  }
  
  // Test 2: Memory cleanup
  logTestStep('Memory cleanup verification');
  
  const initialMemory = (process as any).memoryUsage?.()?.heapUsed || 0;
  
  // Perform operations that should be cleaned up
  await monitor.measureOperation('cleanup-test', async () => {
    const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: `data-${i}` }));
    // Simulate processing
    const processed = largeArray.map(item => ({ ...item, processed: true }));
    // Array should be garbage collected after this scope
  });
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = (process as any).memoryUsage?.()?.heapUsed || 0;
  const memoryDiff = finalMemory - initialMemory;
  
  console.log(`Memory difference after cleanup: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
  
  // Memory should not grow significantly after cleanup
  if (memoryDiff > 10 * 1024 * 1024) { // 10MB
    console.warn(`Potential memory leak detected: ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`);
  }
  
  logTestSuccess('memory usage');
}

async function testConcurrentOperations() {
  console.log('Testing concurrent operations...');
  
  const monitor = new PerformanceMonitor();
  
  const testPaths = createTestPaths('concurrent-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Concurrent resource operations
  logTestStep('Concurrent resource operations');
  
  const mockRepo = {
    id: 'concurrent-repo',
    name: 'Concurrent Repository',
    rootPath: testPaths.repoRoot,
    catalogPath: testPaths.catalogPath,
    runtimePath: testPaths.runtimePath,
    isActive: true
  };
  
  await monitor.measureOperation('concurrent-operations', async () => {
    const concurrentPromises = [];
    
    // Start 10 concurrent operations
    for (let i = 0; i < 10; i++) {
      concurrentPromises.push(
        resourceService.discoverResources({
          ...mockRepo,
          id: `repo-${i}`,
          name: `Repository ${i}`
        })
      );
    }
    
    const results = await Promise.all(concurrentPromises);
    
    // Verify all operations completed successfully
    for (const result of results) {
      if (!Array.isArray(result)) {
        throw new Error('Expected array result from discoverResources');
      }
    }
  });
  
  // Test 2: Concurrent file operations
  logTestStep('Concurrent file operations');
  
  await monitor.measureOperation('concurrent-file-ops', async () => {
    const filePromises = [];
    
    // Start 20 concurrent file operations
    for (let i = 0; i < 20; i++) {
      filePromises.push(
        fileService.writeFile(`/concurrent/file-${i}.txt`, `content-${i}`)
      );
    }
    
    await Promise.all(filePromises);
    
    // Verify all files were created
    for (let i = 0; i < 20; i++) {
      const content = await fileService.readFile(`/concurrent/file-${i}.txt`);
      if (content !== `content-${i}`) {
        throw new Error(`Concurrent file operation failed for file ${i}`);
      }
    }
  });
  
  const concurrentOpsTime = monitor.getAverageDuration('concurrent-operations');
  const concurrentFileTime = monitor.getAverageDuration('concurrent-file-ops');
  
  console.log(`Concurrent operations time: ${concurrentOpsTime}ms`);
  console.log(`Concurrent file operations time: ${concurrentFileTime}ms`);
  
  // Performance thresholds
  if (concurrentOpsTime > 2000) { // 2 seconds
    throw new Error(`Concurrent operations too slow: ${concurrentOpsTime}ms`);
  }
  
  if (concurrentFileTime > 1000) { // 1 second
    throw new Error(`Concurrent file operations too slow: ${concurrentFileTime}ms`);
  }
  
  logTestSuccess('concurrent operations');
}

async function testCachePerformance() {
  console.log('Testing cache performance...');
  
  const monitor = new PerformanceMonitor();
  
  const testPaths = createTestPaths('cache-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Cache hit/miss ratios
  logTestStep('Cache hit/miss ratios');
  
  const mockRepo = {
    id: 'cache-repo',
    name: 'Cache Repository',
    rootPath: testPaths.repoRoot,
    catalogPath: testPaths.catalogPath,
    runtimePath: testPaths.runtimePath,
    isActive: true
  };
  
  // First call (cache miss)
  await monitor.measureOperation('cache-miss', async () => {
    await resourceService.discoverResources(mockRepo);
  });
  
  // Second call (cache hit)
  await monitor.measureOperation('cache-hit', async () => {
    await resourceService.discoverResources(mockRepo);
  });
  
  const cacheMissTime = monitor.getAverageDuration('cache-miss');
  const cacheHitTime = monitor.getAverageDuration('cache-hit');
  
  console.log(`Cache miss time: ${cacheMissTime}ms`);
  console.log(`Cache hit time: ${cacheHitTime}ms`);
  
  // Cache hit should be significantly faster
  if (cacheHitTime >= cacheMissTime) {
    console.warn('Cache hit not faster than cache miss - caching may not be working');
  }
  
  // Test 2: Cache size limits
  logTestStep('Cache size limits');
  
  // Test with multiple repositories to trigger cache eviction
  for (let i = 0; i < 10; i++) {
    await monitor.measureOperation('cache-size-test', async () => {
      await resourceService.discoverResources({
        ...mockRepo,
        id: `cache-repo-${i}`,
        name: `Cache Repository ${i}`
      });
    });
  }
  
  logTestSuccess('cache performance');
}

async function runPerformanceTests() {
  console.log('Running performance tests...');
  
  try {
    await testLargeCatalogHandling();
    await testMemoryUsage();
    await testConcurrentOperations();
    await testCachePerformance();
    
    console.log('🎉 All performance tests passed!');
  } catch (error) {
    console.error('Performance tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runPerformanceTests();
}

export { runPerformanceTests };
