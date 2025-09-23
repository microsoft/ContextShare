// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileService } from '../src/services/fileService';
import { ResourceService } from '../src/services/resourceService';
import { createTestPaths, logTestSuccess, logTestStep } from './testUtils';

/**
 * Real integration tests for file system operations using the actual FileService.
 */
async function testRealFileSystemOperations() {
  console.log('Testing REAL file system operations...');
  
  const testDir = path.join(os.tmpdir(), 'contextshare-real-integration-test');
  await fs.rm(testDir, { recursive: true, force: true });
  await fs.mkdir(testDir, { recursive: true });

  const fileService = new FileService();
  
  // Test 1: Directory creation
  logTestStep('Directory creation');
  const newDir = path.join(testDir, 'new-dir');
  await fileService.ensureDirectory(newDir);
  const stats = await fs.stat(newDir);
  if (!stats.isDirectory()) {
    throw new Error('Directory was not created');
  }
  
  // Test 2: File write and read
  logTestStep('File write and read');
  const testFile = path.join(testDir, 'test.txt');
  const content = 'hello world';
  await fileService.writeFile(testFile, content);
  const readContent = await fileService.readFile(testFile);
  if (readContent !== content) {
    throw new Error('File content mismatch');
  }

  // Test 3: File copy
  logTestStep('File copy');
  const copyDest = path.join(testDir, 'test-copy.txt');
  await fileService.copyFile(testFile, copyDest);
  const copiedContent = await fileService.readFile(copyDest);
  if (copiedContent !== content) {
    throw new Error('File copy failed');
  }

  // Test 4: File deletion
  logTestStep('File deletion');
  await fileService.deleteFile(copyDest);
  try {
    await fs.stat(copyDest);
    throw new Error('File was not deleted');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  // Test 5: Path exists
  logTestStep('Path exists');
  if (!await fileService.pathExists(testDir)) {
    throw new Error('pathExists failed for directory');
  }
  if (!await fileService.pathExists(testFile)) {
    throw new Error('pathExists failed for file');
  }
  if (await fileService.pathExists(path.join(testDir, 'non-existent-file'))) {
    throw new Error('pathExists failed for non-existent file');
  }

  await fs.rm(testDir, { recursive: true, force: true });
  logTestSuccess('REAL file system operations');
}


async function runRealIntegrationTests() {
  console.log('Running REAL integration tests...');
  
  try {
    await testRealFileSystemOperations();
    
    console.log('🎉 All REAL integration tests passed!');
  } catch (error) {
    console.error('REAL integration tests failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runRealIntegrationTests().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

export { runRealIntegrationTests };
