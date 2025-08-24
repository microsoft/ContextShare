import * as path from 'path';
import { Repository } from '../src/models';
import { createTestPaths, normalizePath } from './testUtils';

// Mock the discoverRepositories function logic since it's in extension.ts and depends on vscode
function mockDiscoverRepositories(catalogDirectories: Record<string, string>, runtimeDirName: string = '.github'): Repository[] {
  const repos: Repository[] = [];
  
  for (const [catalogPath, displayName] of Object.entries(catalogDirectories)) {
    // Simulate the logic from extension.ts - normalize paths for comparison
    const normalizedCatalogPath = path.normalize(catalogPath);
    const basename = path.basename(normalizedCatalogPath).toLowerCase();
    
    let repoRoot: string;
    let runtimePath: string;
    
    if (basename === 'copilot_catalog') {
      // Traditional structure: repo/copilot_catalog -> repo root is parent
      repoRoot = path.dirname(normalizedCatalogPath);
      runtimePath = path.join(repoRoot, runtimeDirName);
    } else {
      // Direct catalog directory: use catalog directory as repo root
      repoRoot = normalizedCatalogPath;
      runtimePath = path.join(repoRoot, runtimeDirName);
    }
    
    const repoName = displayName || path.basename(normalizedCatalogPath);
    
    repos.push({
      id: path.basename(repoRoot) + '_' + path.basename(normalizedCatalogPath),
      name: repoName,
      rootPath: repoRoot,
      catalogPath: normalizedCatalogPath,
      runtimePath,
      isActive: true
    });
  }
  
  return repos;
}

async function run() {
  console.log('Testing repository discovery logic...');
  
  // Test 1: Traditional structure (repo/copilot_catalog)
  console.log('✅ Test 1: Traditional structure');
  const traditional = mockDiscoverRepositories({
    '/workspace/my-project/copilot_catalog': 'My Project Catalog'
  });
  const traditionalRepo = traditional[0];
  
  if (path.normalize(traditionalRepo.rootPath) !== path.normalize('/workspace/my-project')) {
    throw new Error(`Expected rootPath '/workspace/my-project', got '${traditionalRepo.rootPath}'`);
  }
  if (path.normalize(traditionalRepo.catalogPath) !== path.normalize('/workspace/my-project/copilot_catalog')) {
    throw new Error(`Expected catalogPath '/workspace/my-project/copilot_catalog', got '${traditionalRepo.catalogPath}'`);
  }
  if (path.normalize(traditionalRepo.runtimePath) !== path.normalize('/workspace/my-project/.github')) {
    throw new Error(`Expected runtimePath '/workspace/my-project/.github', got '${traditionalRepo.runtimePath}'`);
  }
  
  // Test 2: Direct catalog directory (catalog directory as repo root)
  console.log('✅ Test 2: Direct catalog directory (actual user scenario)');
  const testPaths2 = createTestPaths('repo-discovery-direct');
  const directCatalogPath = path.join(testPaths2.baseDir, 'ai_catalog');
  const direct = mockDiscoverRepositories({
    [directCatalogPath]: 'Remote Catalog'
  });
  const directRepo = direct[0];
  
  // This should be treated as direct since basename is NOT 'copilot_catalog'
  if (normalizePath(directRepo.rootPath) !== normalizePath(directCatalogPath)) {
    throw new Error(`Expected rootPath '${directCatalogPath}', got '${directRepo.rootPath}'`);
  }
  if (normalizePath(directRepo.catalogPath) !== normalizePath(directCatalogPath)) {
    throw new Error(`Expected catalogPath '${directCatalogPath}', got '${directRepo.catalogPath}'`);
  }
  if (normalizePath(directRepo.runtimePath) !== normalizePath(path.join(directCatalogPath, '.github'))) {
    throw new Error(`Expected runtimePath '${path.join(directCatalogPath, '.github')}', got '${directRepo.runtimePath}'`);
  }
  
  // Test 2b: Traditional style but with Windows paths
  console.log('✅ Test 2b: Traditional structure with Windows paths');
  const testPaths2b = createTestPaths('repo-discovery-traditional-win');
  const traditionalWindows = mockDiscoverRepositories({
    [path.join(testPaths2b.repoRoot, 'copilot_catalog')]: 'Traditional Windows'
  });
  const traditionalWinRepo = traditionalWindows[0];
  
  // This should be treated as traditional since basename IS 'copilot_catalog'
  if (normalizePath(traditionalWinRepo.rootPath) !== normalizePath(testPaths2b.repoRoot)) {
    throw new Error(`Expected Windows traditional rootPath '${testPaths2b.repoRoot}', got '${traditionalWinRepo.rootPath}'`);
  }
  if (normalizePath(traditionalWinRepo.runtimePath) !== normalizePath(testPaths2b.runtimePath)) {
    throw new Error(`Expected Windows traditional runtimePath '${testPaths2b.runtimePath}', got '${traditionalWinRepo.runtimePath}'`);
  }
  
  // Test 3: Mixed configurations
  console.log('✅ Test 3: Mixed configurations');
  const testPaths = createTestPaths('repo-discovery-mixed');
  const mixed = mockDiscoverRepositories({
    [path.join(testPaths.repoRoot, 'copilot_catalog')]: 'Traditional',
    [testPaths.altWorkspaceRoot]: 'Direct Team Resources',
    [path.join(testPaths.baseDir, 'company-catalog')]: 'Company Catalog'
  });
  
  if (mixed.length !== 3) {
    throw new Error(`Expected 3 repositories, got ${mixed.length}`);
  }
  
  // Verify traditional structure in mixed
  const mixedTraditional = mixed.find(r => r.name === 'Traditional');
  if (!mixedTraditional || normalizePath(mixedTraditional.rootPath) !== normalizePath(testPaths.repoRoot)) {
    throw new Error('Mixed traditional structure failed');
  }
  
  // Verify direct structures in mixed
  const mixedDirect1 = mixed.find(r => r.name === 'Direct Team Resources');
  if (!mixedDirect1 || normalizePath(mixedDirect1.rootPath) !== normalizePath(testPaths.altWorkspaceRoot)) {
    throw new Error('Mixed direct structure 1 failed');
  }
  
  const mixedDirect2 = mixed.find(r => r.name === 'Company Catalog');
  if (!mixedDirect2 || normalizePath(mixedDirect2.rootPath) !== normalizePath(path.join(testPaths.baseDir, 'company-catalog'))) {
    throw new Error('Mixed direct structure 2 failed');
  }
  
  // Test 4: Custom runtime directory
  console.log('✅ Test 4: Custom runtime directory');
  const customRuntime = mockDiscoverRepositories({
    '/workspace/project/copilot_catalog': 'Custom Runtime'
  }, '.copilot');
  const customRepo = customRuntime[0];
  
  if (path.normalize(customRepo.runtimePath) !== path.normalize('/workspace/project/.copilot')) {
    throw new Error(`Expected custom runtime path '/workspace/project/.copilot', got '${customRepo.runtimePath}'`);
  }
  
  // Test 5: Edge case - catalog named 'copilot_catalog' but in direct mode
  console.log('✅ Test 5: Edge case handling');
  const edgeCase = mockDiscoverRepositories({
    '/direct/copilot_catalog': 'Edge Case'
  });
  const edgeRepo = edgeCase[0];
  
  // Should treat parent as repo root since basename is 'copilot_catalog'
  if (path.normalize(edgeRepo.rootPath) !== path.normalize('/direct')) {
    throw new Error(`Expected edge case rootPath '/direct', got '${edgeRepo.rootPath}'`);
  }
  
  console.log('🎉 All repository discovery tests passed!');
}

run().catch(e => {
  console.error('repositoryDiscovery.test FAIL', e);
  process.exit(1);
});
