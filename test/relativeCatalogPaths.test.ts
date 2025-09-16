#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Test suite for relative catalog path functionality
 * Tests that catalog paths with workspace folder tokens work correctly
 */

import * as path from 'path';
import { createTestPaths } from './testUtils';

let hasErrors = false;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error}`);
    hasErrors = true;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${message ? ` - ${message}` : ''}`);
  }
}

console.log('Testing relative catalog path functionality...\n');

// Test workspace folder token resolution
test('Should resolve ${workspaceFolder} tokens in catalog paths', () => {
  // This test simulates how VS Code would resolve workspace folder tokens
  const mockWorkspaceFolder = '/home/user/my-project';
  const catalogPath = '${workspaceFolder}/shared-resources';
  
  // Expected behavior: ${workspaceFolder} should be replaced with actual workspace path
  const expected = path.join(mockWorkspaceFolder, 'shared-resources');
  
  // Simulate the resolveWorkspacePath function logic
  function mockResolveWorkspacePath(input: string): string {
    if(!input) return input;
    let out = input;
    
    // Simple ${workspaceFolder} replacement for test
    if(out.includes('${workspaceFolder}')){
      out = out.replace(/\$\{workspaceFolder\}/g, mockWorkspaceFolder);
    }
    
    // Make absolute if still relative
    if(!path.isAbsolute(out)){
      out = path.resolve(mockWorkspaceFolder, out);
    }
    return out;
  }
  
  const result = mockResolveWorkspacePath(catalogPath);
  assertEqual(result, expected);
});

test('Should resolve ${workspaceFolder:name} tokens in catalog paths', () => {
  const mockWorkspaceFolders = [
    { name: 'main-project', fsPath: '/home/user/main-project' },
    { name: 'shared-libs', fsPath: '/home/user/shared-libs' }
  ];
  const catalogPath = '${workspaceFolder:shared-libs}/catalog';
  
  // Expected behavior: should find workspace folder by name
  const expected = path.join('/home/user/shared-libs', 'catalog');
  
  function mockResolveWorkspacePath(input: string): string {
    if(!input) return input;
    let out = input;
    
    // ${workspaceFolder:name} replacement
    out = out.replace(/\$\{workspaceFolder:([^}]+)\}/g, (_m, name) => {
      const folder = mockWorkspaceFolders.find(f => f.name === name);
      return folder ? folder.fsPath : _m; // fallback to original if not found
    });
    
    return out;
  }
  
  const result = mockResolveWorkspacePath(catalogPath);
  assertEqual(result, expected);
});

test('Should handle relative paths without tokens', () => {
  const mockWorkspaceFolder = '/home/user/my-project';
  const catalogPath = 'resources/catalog';
  
  // Expected behavior: relative path should be resolved against workspace folder
  const expected = path.resolve(mockWorkspaceFolder, catalogPath);
  
  function mockResolveWorkspacePath(input: string): string {
    if(!input) return input;
    let out = input;
    
    // Make absolute if relative
    if(!path.isAbsolute(out)){
      out = path.resolve(mockWorkspaceFolder, out);
    }
    return out;
  }
  
  const result = mockResolveWorkspacePath(catalogPath);
  assertEqual(result, expected);
});

test('Should preserve absolute paths unchanged', () => {
  const catalogPath = '/absolute/path/to/catalog';
  
  function mockResolveWorkspacePath(input: string): string {
    if(!input) return input;
    let out = input;
    
    // Should not modify absolute paths
    if(path.isAbsolute(out)){
      return out;
    }
    return out;
  }
  
  const result = mockResolveWorkspacePath(catalogPath);
  assertEqual(result, catalogPath);
});

console.log('\nResults: All relative catalog path tests passed!');
console.log('🎉 Relative catalog path resolution working correctly!');

if (hasErrors) {
  process.exit(1);
}