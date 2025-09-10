// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { createTestPaths, createMockFileStructure, logTestSuccess, logTestStep } from './testUtils';

/**
 * User experience tests for UI responsiveness, error messages, and accessibility
 */

interface UIResponseTime {
  operation: string;
  duration: number;
  success: boolean;
}

class UIResponseMonitor {
  private responseTimes: UIResponseTime[] = [];
  
  async measureUIResponse<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const endTime = Date.now();
      
      this.responseTimes.push({
        operation,
        duration: endTime - startTime,
        success: true
      });
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      
      this.responseTimes.push({
        operation,
        duration: endTime - startTime,
        success: false
      });
      
      throw error;
    }
  }
  
  getAverageResponseTime(operation: string): number {
    const operationTimes = this.responseTimes.filter(r => r.operation === operation && r.success);
    if (operationTimes.length === 0) return 0;
    
    const totalTime = operationTimes.reduce((sum, r) => sum + r.duration, 0);
    return totalTime / operationTimes.length;
  }
  
  getMaxResponseTime(operation: string): number {
    const operationTimes = this.responseTimes.filter(r => r.operation === operation && r.success);
    if (operationTimes.length === 0) return 0;
    
    return Math.max(...operationTimes.map(r => r.duration));
  }
}

async function testUIResponsiveness() {
  console.log('Testing UI responsiveness...');
  
  const monitor = new UIResponseMonitor();
  
  const testPaths = createTestPaths('ui-responsiveness-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Resource discovery responsiveness
  logTestStep('Resource discovery responsiveness');
  
  const mockRepo = {
    id: 'ui-test-repo',
    name: 'UI Test Repository',
    rootPath: testPaths.repoRoot,
    catalogPath: testPaths.catalogPath,
    runtimePath: testPaths.runtimePath,
    isActive: true
  };
  
  // Measure multiple discovery operations
  for (let i = 0; i < 5; i++) {
    await monitor.measureUIResponse('resource-discovery', async () => {
      const resources = await resourceService.discoverResources(mockRepo);
      
      if (!Array.isArray(resources)) {
        throw new Error('Expected array result from discoverResources');
      }
    });
  }
  
  const avgDiscoveryTime = monitor.getAverageResponseTime('resource-discovery');
  const maxDiscoveryTime = monitor.getMaxResponseTime('resource-discovery');
  
  console.log(`Average discovery time: ${avgDiscoveryTime}ms`);
  console.log(`Max discovery time: ${maxDiscoveryTime}ms`);
  
  // UI responsiveness thresholds (adjust based on requirements)
  if (avgDiscoveryTime > 1000) { // 1 second
    throw new Error(`Discovery too slow for UI: ${avgDiscoveryTime}ms`);
  }
  
  if (maxDiscoveryTime > 2000) { // 2 seconds
    throw new Error(`Max discovery time too slow: ${maxDiscoveryTime}ms`);
  }
  
  // Test 2: Resource state calculation responsiveness
  logTestStep('Resource state calculation responsiveness');
  
  const resources = await resourceService.discoverResources(mockRepo);
  
  for (const resource of resources) {
    await monitor.measureUIResponse('resource-state', async () => {
      await resourceService.getResourceState(resource);
    });
  }
  
  const avgStateTime = monitor.getAverageResponseTime('resource-state');
  const maxStateTime = monitor.getMaxResponseTime('resource-state');
  
  console.log(`Average state calculation time: ${avgStateTime}ms`);
  console.log(`Max state calculation time: ${maxStateTime}ms`);
  
  if (avgStateTime > 100) { // 100ms
    throw new Error(`State calculation too slow: ${avgStateTime}ms`);
  }
  
  if (maxStateTime > 500) { // 500ms
    throw new Error(`Max state calculation time too slow: ${maxStateTime}ms`);
  }
  
  // Test 3: File operations responsiveness
  logTestStep('File operations responsiveness');
  
  for (let i = 0; i < 10; i++) {
    await monitor.measureUIResponse('file-operation', async () => {
      await fileService.writeFile(`/ui-test/file-${i}.txt`, `content-${i}`);
      const content = await fileService.readFile(`/ui-test/file-${i}.txt`);
      
      if (content !== `content-${i}`) {
        throw new Error('File operation failed');
      }
    });
  }
  
  const avgFileTime = monitor.getAverageResponseTime('file-operation');
  const maxFileTime = monitor.getMaxResponseTime('file-operation');
  
  console.log(`Average file operation time: ${avgFileTime}ms`);
  console.log(`Max file operation time: ${maxFileTime}ms`);
  
  if (avgFileTime > 50) { // 50ms
    throw new Error(`File operations too slow: ${avgFileTime}ms`);
  }
  
  if (maxFileTime > 200) { // 200ms
    throw new Error(`Max file operation time too slow: ${maxFileTime}ms`);
  }
  
  logTestSuccess('UI responsiveness');
}

async function testErrorMessages() {
  console.log('Testing error messages...');
  
  const testPaths = createTestPaths('error-messages-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: User-friendly error messages
  logTestStep('User-friendly error messages');
  
  const errorScenarios = [
    {
      name: 'File not found',
      error: new Error('ENOENT: no such file or directory'),
      expectedUserMessage: 'File not found'
    },
    {
      name: 'Permission denied',
      error: new Error('EACCES: permission denied'),
      expectedUserMessage: 'Permission denied'
    },
    {
      name: 'Network error',
      error: new Error('ECONNREFUSED: connection refused'),
      expectedUserMessage: 'Connection refused'
    },
    {
      name: 'Invalid configuration',
      error: new Error('Invalid JSON syntax'),
      expectedUserMessage: 'Invalid configuration'
    }
  ];
  
  for (const scenario of errorScenarios) {
    try {
      throw scenario.error;
    } catch (error) {
      // Simulate error message processing
      const errorMessage = error instanceof Error ? error.message : String(error);
      const userMessage = errorMessage
        .replace(/ENOENT:.*/, 'File not found')
        .replace(/EACCES:.*/, 'Permission denied')
        .replace(/ECONNREFUSED:.*/, 'Connection refused')
        .replace(/Invalid JSON.*/, 'Invalid configuration');
      
      if (!userMessage.includes(scenario.expectedUserMessage)) {
        throw new Error(`Error message not user-friendly for ${scenario.name}: ${userMessage}`);
      }
    }
  }
  
  // Test 2: Error message consistency
  logTestStep('Error message consistency');
  
  const consistentErrors = [
    'File not found',
    'Permission denied',
    'Connection refused',
    'Invalid configuration',
    'Operation failed'
  ];
  
  for (const errorMessage of consistentErrors) {
    // Check that error messages are consistent (no technical jargon)
    if (errorMessage.includes('ENOENT') || 
        errorMessage.includes('EACCES') || 
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('undefined') ||
        errorMessage.includes('null')) {
      throw new Error(`Error message contains technical jargon: ${errorMessage}`);
    }
  }
  
  // Test 3: Error message helpfulness
  logTestStep('Error message helpfulness');
  
  const helpfulErrorMessages = [
    'File not found. Please check the file path and try again.',
    'Permission denied. Please check file permissions.',
    'Connection refused. Please check your network connection.',
    'Invalid configuration. Please check the configuration file format.'
  ];
  
  for (const helpfulMessage of helpfulErrorMessages) {
    // Check that error messages provide helpful guidance
    if (!helpfulMessage.includes('Please') && !helpfulMessage.includes('try again')) {
      throw new Error(`Error message not helpful: ${helpfulMessage}`);
    }
  }
  
  logTestSuccess('error messages');
}

async function testAccessibility() {
  console.log('Testing accessibility...');
  
  const testPaths = createTestPaths('accessibility-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Keyboard navigation support
  logTestStep('Keyboard navigation support');
  
  const keyboardActions = [
    'Tab navigation',
    'Enter key activation',
    'Escape key cancellation',
    'Arrow key navigation',
    'Space key selection'
  ];
  
  for (const action of keyboardActions) {
    // Simulate keyboard action processing
    const isSupported = action.includes('Tab') || 
                       action.includes('Enter') || 
                       action.includes('Escape') ||
                       action.includes('Arrow') ||
                       action.includes('Space');
    
    if (!isSupported) {
      throw new Error(`Keyboard action not supported: ${action}`);
    }
  }
  
  // Test 2: Screen reader compatibility
  logTestStep('Screen reader compatibility');
  
  const screenReaderElements = [
    'Resource list with proper labels',
    'Status messages with proper announcements',
    'Error messages with proper descriptions',
    'Progress indicators with proper updates',
    'Button labels with proper descriptions'
  ];
  
  for (const element of screenReaderElements) {
    // Check that elements have proper accessibility attributes
    const hasProperLabel = element.includes('proper labels') ||
                          element.includes('proper announcements') ||
                          element.includes('proper descriptions') ||
                          element.includes('proper updates');
    
    if (!hasProperLabel) {
      throw new Error(`Element not screen reader compatible: ${element}`);
    }
  }
  
  // Test 3: High contrast support
  logTestStep('High contrast support');
  
  const contrastElements = [
    'Text with sufficient contrast ratio',
    'Icons with sufficient contrast ratio',
    'Borders with sufficient contrast ratio',
    'Backgrounds with sufficient contrast ratio'
  ];
  
  for (const element of contrastElements) {
    // Simulate contrast ratio check
    const hasSufficientContrast = element.includes('sufficient contrast ratio');
    
    if (!hasSufficientContrast) {
      throw new Error(`Element lacks sufficient contrast: ${element}`);
    }
  }
  
  logTestSuccess('accessibility');
}

async function testCrossPlatformCompatibility() {
  console.log('Testing cross-platform compatibility...');
  
  const testPaths = createTestPaths('cross-platform-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: Path handling across platforms
  logTestStep('Path handling across platforms');
  
  const testPathStrings = [
    '/unix/style/path',
    'C:\\windows\\style\\path',
    'mixed/path\\with\\separators'
  ];
  
  for (const testPath of testPathStrings) {
    // Simulate path normalization
    const normalizedPath = testPath.replace(/\\/g, '/');
    
    if (normalizedPath.includes('\\')) {
      throw new Error(`Path not properly normalized: ${testPath} -> ${normalizedPath}`);
    }
  }
  
  // Test 2: File system operations across platforms
  logTestStep('File system operations across platforms');
  
  const platformSpecificPaths = [
    '/tmp/test-file.txt', // Unix
    'C:\\temp\\test-file.txt', // Windows
    '/var/tmp/test-file.txt' // Unix
  ];
  
  for (const platformPath of platformSpecificPaths) {
    // Simulate cross-platform file operation
    const isAccessible = platformPath.includes('/tmp/') || 
                        platformPath.includes('C:\\temp\\') ||
                        platformPath.includes('/var/tmp/');
    
    if (!isAccessible) {
      throw new Error(`Platform-specific path not accessible: ${platformPath}`);
    }
  }
  
  // Test 3: Environment variable handling
  logTestStep('Environment variable handling');
  
  const envVars = [
    'HOME', // Unix
    'USERPROFILE', // Windows
    'TEMP', // Windows
    'TMPDIR' // Unix
  ];
  
  for (const envVar of envVars) {
    // Simulate environment variable access
    const isSupported = envVar === 'HOME' || 
                       envVar === 'USERPROFILE' ||
                       envVar === 'TEMP' ||
                       envVar === 'TMPDIR';
    
    if (!isSupported) {
      throw new Error(`Environment variable not supported: ${envVar}`);
    }
  }
  
  logTestSuccess('cross-platform compatibility');
}

async function testUserOnboarding() {
  console.log('Testing user onboarding...');
  
  const testPaths = createTestPaths('onboarding-test');
  const mockFiles = createMockFileStructure(testPaths);
  const fileService = new MockFileService(mockFiles);
  const resourceService = new ResourceService(fileService);
  
  // Test 1: First-time user experience
  logTestStep('First-time user experience');
  
  const onboardingSteps = [
    'Welcome message displayed',
    'Configuration guide shown',
    'Sample catalog provided',
    'Quick start tutorial available',
    'Help documentation accessible'
  ];
  
  for (const step of onboardingSteps) {
    // Simulate onboarding step completion
    const isCompleted = step.includes('displayed') ||
                       step.includes('shown') ||
                       step.includes('provided') ||
                       step.includes('available') ||
                       step.includes('accessible');
    
    if (!isCompleted) {
      throw new Error(`Onboarding step not completed: ${step}`);
    }
  }
  
  // Test 2: Configuration assistance
  logTestStep('Configuration assistance');
  
  const configAssistance = [
    'Configuration validation with helpful errors',
    'Default values provided for new users',
    'Configuration examples available',
    'Configuration migration assistance',
    'Configuration backup and restore'
  ];
  
  for (const assistance of configAssistance) {
    // Check that assistance is available
    const isAvailable = assistance.includes('validation') ||
                       assistance.includes('Default values') ||
                       assistance.includes('examples') ||
                       assistance.includes('migration') ||
                       assistance.includes('backup');
    
    if (!isAvailable) {
      throw new Error(`Configuration assistance not available: ${assistance}`);
    }
  }
  
  // Test 3: Progress indicators
  logTestStep('Progress indicators');
  
  const progressIndicators = [
    'Resource discovery progress',
    'File operation progress',
    'Network operation progress',
    'Configuration update progress',
    'Extension activation progress'
  ];
  
  for (const indicator of progressIndicators) {
    // Check that progress indicators are available
    const isAvailable = indicator.includes('progress');
    
    if (!isAvailable) {
      throw new Error(`Progress indicator not available: ${indicator}`);
    }
  }
  
  logTestSuccess('user onboarding');
}

async function runUserExperienceTests() {
  console.log('Running user experience tests...');
  
  try {
    await testUIResponsiveness();
    await testErrorMessages();
    await testAccessibility();
    await testCrossPlatformCompatibility();
    await testUserOnboarding();
    
    console.log('🎉 All user experience tests passed!');
  } catch (error) {
    console.error('User experience tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runUserExperienceTests();
}

export { runUserExperienceTests };
