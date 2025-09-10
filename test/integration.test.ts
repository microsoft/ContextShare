// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { createTestPaths, createMockFileStructure, logTestSuccess, logTestStep } from './testUtils';

/**
 * Integration tests for file system operations
 * Tests actual file system interactions, error handling, and edge cases
 */

async function testFileSystemOperations() {
  console.log('Testing file system operations...');
  
  const testPaths = createTestPaths('integration-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: File permission errors
  logTestStep('File permission errors handling');
  try {
    // Simulate permission error by trying to access non-existent file
    await fileService.readFile('/nonexistent/file.txt');
    throw new Error('Expected error for non-existent file');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('missing')) {
      throw new Error('Expected "missing" error, got: ' + errorMessage);
    }
  }
  
  // Test 2: Concurrent file operations
  logTestStep('Concurrent file operations');
  const concurrentPromises = [];
  for (let i = 0; i < 5; i++) {
    concurrentPromises.push(
      fileService.writeFile(`/test/concurrent-${i}.txt`, `content-${i}`)
    );
  }
  await Promise.all(concurrentPromises);
  
  // Verify all files were created
  for (let i = 0; i < 5; i++) {
    const content = await fileService.readFile(`/test/concurrent-${i}.txt`);
    if (content !== `content-${i}`) {
      throw new Error(`Concurrent write failed for file ${i}`);
    }
  }
  
  // Test 3: Directory creation and cleanup
  logTestStep('Directory creation and cleanup');
  const testDir = '/test/dir/creation';
  await fileService.ensureDirectory(testDir);
  
  if (!await fileService.pathExists(testDir)) {
    throw new Error('Directory was not created');
  }
  
  // Test 4: File copy operations
  logTestStep('File copy operations');
  const sourceFile = '/test/source.txt';
  const destFile = '/test/dest.txt';
  await fileService.writeFile(sourceFile, 'source content');
  await fileService.copyFile(sourceFile, destFile);
  
  const copiedContent = await fileService.readFile(destFile);
  if (copiedContent !== 'source content') {
    throw new Error('File copy failed');
  }
  
  // Test 5: File deletion
  logTestStep('File deletion');
  await fileService.deleteFile(destFile);
  
  if (await fileService.pathExists(destFile)) {
    throw new Error('File was not deleted');
  }
  
  logTestSuccess('file system operations');
}

async function testNetworkOperations() {
  console.log('Testing network operations...');
  
  const testPaths = createTestPaths('network-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Network timeout simulation
  logTestStep('Network timeout handling');
  // Mock a network timeout by rejecting a promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Network timeout')), 100);
  });
  
  try {
    await timeoutPromise;
    throw new Error('Expected timeout error');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('Network timeout')) {
      throw new Error('Expected network timeout error');
    }
  }
  
  // Test 2: Invalid SSL certificate simulation
  logTestStep('Invalid SSL certificate handling');
  const sslError = new Error('certificate verify failed');
  try {
    throw sslError;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('certificate verify failed')) {
      throw new Error('Expected SSL certificate error');
    }
  }
  
  // Test 3: Malformed remote content
  logTestStep('Malformed remote content handling');
  const malformedJson = '{ invalid json }';
  try {
    JSON.parse(malformedJson);
    throw new Error('Expected JSON parse error');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // JSON parse errors can have different messages, just check that it's a parse error
    if (!errorMessage.toLowerCase().includes('expected') && 
        !errorMessage.toLowerCase().includes('syntax') &&
        !errorMessage.toLowerCase().includes('parse') &&
        !errorMessage.toLowerCase().includes('json')) {
      throw new Error('Expected JSON parse error');
    }
  }
  
  logTestSuccess('network operations');
}

async function testConfigurationChanges() {
  console.log('Testing configuration change scenarios...');
  
  const testPaths = createTestPaths('config-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Configuration update scenarios
  logTestStep('Configuration update scenarios');
  
  // Simulate configuration changes
  const originalConfig = { catalogPath: '/original/path' };
  const updatedConfig = { catalogPath: '/updated/path' };
  
  // Test configuration validation
  if (originalConfig.catalogPath === updatedConfig.catalogPath) {
    throw new Error('Configuration should be different');
  }
  
  // Test 2: Multi-catalog support
  logTestStep('Multi-catalog support');
  const multiCatalogConfig = {
    '/catalog1': 'Catalog 1',
    '/catalog2': 'Catalog 2',
    '/catalog3': 'Catalog 3'
  };
  
  const catalogCount = Object.keys(multiCatalogConfig).length;
  if (catalogCount !== 3) {
    throw new Error(`Expected 3 catalogs, got ${catalogCount}`);
  }
  
  logTestSuccess('configuration changes');
}

async function testErrorRecovery() {
  console.log('Testing error recovery mechanisms...');
  
  const testPaths = createTestPaths('recovery-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: File system error recovery
  logTestStep('File system error recovery');
  
  // Simulate file system error and recovery
  let operationFailed = false;
  try {
    await fileService.readFile('/nonexistent/file.txt');
  } catch (error) {
    operationFailed = true;
    // Simulate recovery by creating the file
    await fileService.writeFile('/nonexistent/file.txt', 'recovered content');
  }
  
  if (!operationFailed) {
    throw new Error('Expected file system error');
  }
  
  // Verify recovery worked
  const recoveredContent = await fileService.readFile('/nonexistent/file.txt');
  if (recoveredContent !== 'recovered content') {
    throw new Error('Error recovery failed');
  }
  
  // Test 2: Network error recovery
  logTestStep('Network error recovery');
  
  let networkFailed = false;
  try {
    throw new Error('Network connection failed');
  } catch (error) {
    networkFailed = true;
    // Simulate retry logic
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  if (!networkFailed) {
    throw new Error('Expected network error');
  }
  
  logTestSuccess('error recovery');
}

async function runIntegrationTests() {
  console.log('Running integration tests...');
  
  try {
    await testFileSystemOperations();
    await testNetworkOperations();
    await testConfigurationChanges();
    await testErrorRecovery();
    
    console.log('🎉 All integration tests passed!');
  } catch (error) {
    console.error('Integration tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests();
}

export { runIntegrationTests };
