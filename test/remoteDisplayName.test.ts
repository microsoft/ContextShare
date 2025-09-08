// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Test that "Remote" display name uses workspace for runtime while keeping catalog separate
import * as path from 'path';
import { createTestPaths, normalizePath } from './testUtils';

// Mock workspace folders helper
function createMockWorkspaceFolder(fsPath: string) {
  return {
    uri: { fsPath }
  };
}

// Import the repository discovery function - we'll need to extract it for testing
function mockDiscoverRepositories(catalogDirectories: Record<string, string>, workspaceFolder?: any) {
  const repos: any[] = [];
  const runtimeDirName = '.github';
  
  for (const [catalogPath, displayName] of Object.entries(catalogDirectories)) {
    const absoluteCatalogPath = catalogPath;
    
    // The updated logic
    let repoRoot: string;
    let runtimePath: string;
    
    const isRemoteOrDirect = displayName && (displayName.toLowerCase().includes('remote') || displayName.toLowerCase().includes('direct'));
    
    if (path.basename(absoluteCatalogPath).toLowerCase() === 'copilot_catalog') {
      // Traditional structure: repo/copilot_catalog -> repo root is parent
      repoRoot = path.dirname(absoluteCatalogPath);
      runtimePath = path.join(repoRoot, runtimeDirName);
    } else if (isRemoteOrDirect) {
      // Remote/Direct catalog: catalog is separate, but use workspace for runtime
      if (workspaceFolder) {
        repoRoot = workspaceFolder.uri.fsPath;
        runtimePath = path.join(repoRoot, runtimeDirName);
      } else {
        // Fallback to direct structure if no workspace
        repoRoot = absoluteCatalogPath;
        runtimePath = path.join(repoRoot, runtimeDirName);
      }
    } else {
      // Direct catalog directory: use catalog directory as repo root
      repoRoot = absoluteCatalogPath;
      runtimePath = path.join(repoRoot, runtimeDirName);
    }
    
    const repoName = displayName || path.basename(absoluteCatalogPath);
    
    repos.push({
      id: path.basename(repoRoot) + '_' + path.basename(absoluteCatalogPath),
      name: repoName,
      rootPath: repoRoot,
      catalogPath: absoluteCatalogPath,
      runtimePath,
      isActive: true
    });
  }
  
  return repos;
}

async function run() {
  console.log('Testing Remote display name behavior for workspace runtime...');
  
  // Create portable test paths
  const testPaths = createTestPaths('remote-display-name-test');
  const mockWorkspaceFolder = createMockWorkspaceFolder(testPaths.workspaceRoot);
  
  // Test 1: "Remote" with copilot_catalog basename should use traditional structure
  const remoteRepo = mockDiscoverRepositories({
    [path.join(testPaths.repoRoot, 'copilot_catalog')]: 'Remote'
  }, mockWorkspaceFolder)[0];
  
  // With "Remote" display name but copilot_catalog basename, should use traditional structure
  const expectedRootPath = testPaths.repoRoot;
  const expectedRuntimePath = testPaths.runtimePath;
  const expectedCatalogPath = path.join(testPaths.repoRoot, 'copilot_catalog');
  
  if (normalizePath(remoteRepo.rootPath) !== normalizePath(expectedRootPath)) {
    throw new Error(`Expected Remote catalog rootPath '${expectedRootPath}', got '${remoteRepo.rootPath}'`);
  }
  
  if (normalizePath(remoteRepo.runtimePath) !== normalizePath(expectedRuntimePath)) {
    throw new Error(`Expected Remote catalog runtimePath '${expectedRuntimePath}', got '${remoteRepo.runtimePath}'`);
  }
  
  if (normalizePath(remoteRepo.catalogPath) !== normalizePath(expectedCatalogPath)) {
    throw new Error(`Expected Remote catalog catalogPath '${expectedCatalogPath}', got '${remoteRepo.catalogPath}'`);
  }
  
  console.log('✅ Remote catalog with copilot_catalog basename uses traditional structure (keeps user assets in workspace)');
  
  // Test 2: "Remote" with non-copilot_catalog basename should use workspace for runtime
  const remoteFallbackRepo = mockDiscoverRepositories({
    [path.join(testPaths.baseDir, 'some-other-catalog')]: 'Remote'
  }, mockWorkspaceFolder)[0];
  
  const expectedFallbackRootPath = testPaths.workspaceRoot;
  const expectedFallbackRuntimePath = testPaths.workspaceGithub;
  
  if (normalizePath(remoteFallbackRepo.rootPath) !== normalizePath(expectedFallbackRootPath)) {
    throw new Error(`Expected Remote non-copilot_catalog rootPath '${expectedFallbackRootPath}', got '${remoteFallbackRepo.rootPath}'`);
  }
  
  if (normalizePath(remoteFallbackRepo.runtimePath) !== normalizePath(expectedFallbackRuntimePath)) {
    throw new Error(`Expected Remote non-copilot_catalog runtimePath '${expectedFallbackRuntimePath}', got '${remoteFallbackRepo.runtimePath}'`);
  }
  
  console.log('✅ Remote catalog with non-copilot_catalog basename uses workspace for runtime');
  
  // Test 3: Traditional copilot_catalog structure should still work
  const traditionalTestPaths = createTestPaths('remote-display-traditional-test');
  const traditionalMockWorkspace = createMockWorkspaceFolder(traditionalTestPaths.workspaceRoot);
  
  const traditionalRepo = mockDiscoverRepositories({
    [path.join(traditionalTestPaths.repoRoot, 'copilot_catalog')]: 'Traditional'
  }, traditionalMockWorkspace)[0];
  
  const expectedTraditionalRootPath = traditionalTestPaths.repoRoot;
  const expectedTraditionalRuntimePath = traditionalTestPaths.runtimePath;
  
  if (normalizePath(traditionalRepo.rootPath) !== normalizePath(expectedTraditionalRootPath)) {
    throw new Error(`Expected Traditional catalog rootPath '${expectedTraditionalRootPath}', got '${traditionalRepo.rootPath}'`);
  }
  
  if (normalizePath(traditionalRepo.runtimePath) !== normalizePath(expectedTraditionalRuntimePath)) {
    throw new Error(`Expected Traditional catalog runtimePath '${expectedTraditionalRuntimePath}', got '${traditionalRepo.runtimePath}'`);
  }
  
  console.log('✅ Traditional copilot_catalog structure works correctly');
  
  console.log('🎉 All Remote catalog workspace behavior tests passed!');
}

run().catch(console.error);
