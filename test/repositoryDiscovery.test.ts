import * as path from 'path';
import { assertPathEquals, createTestPaths, logTestSection, mockDiscoverRepositories, normalizePath, normalizeFsPath } from './testUtils';

async function run() {
  console.log('Testing repository discovery logic...');
  
  // Test 1: Traditional structure (repo/copilot_catalog)
  logTestSection(1, 'Traditional structure');
  const traditionalCatalogPath = '/workspace/my-project/copilot_catalog';
  const traditional = mockDiscoverRepositories({
    [traditionalCatalogPath]: 'My Project Catalog'
  });
  const traditionalRepo = traditional[0];
  
  assertPathEquals(traditionalRepo.rootPath, path.dirname(path.resolve(traditionalCatalogPath)), 'Traditional repo rootPath');
  assertPathEquals(traditionalRepo.catalogPath, path.resolve(traditionalCatalogPath), 'Traditional repo catalogPath');
  assertPathEquals(traditionalRepo.runtimePath, path.join(path.dirname(path.resolve(traditionalCatalogPath)), '.github'), 'Traditional repo runtimePath');
  
  // Test 2: Direct catalog directory (catalog directory as repo root)
  logTestSection(2, 'Direct catalog directory (actual user scenario)');
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
  logTestSection(2, 'b: Traditional structure with Windows paths');
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
  logTestSection(3, 'Mixed configurations');
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
  logTestSection(4, 'Custom runtime directory');
  const customCatalogPath = '/workspace/project/copilot_catalog';
  const customRuntime = mockDiscoverRepositories({
    [customCatalogPath]: 'Custom Runtime'
  }, '.copilot');
  const customRepo = customRuntime[0];
  
  assertPathEquals(customRepo.runtimePath, path.join(path.dirname(path.resolve(customCatalogPath)), '.copilot'), 'Custom runtime directory path');
  
  // Test 5: Edge case - catalog named 'copilot_catalog' but in direct mode
  logTestSection(5, 'Edge case handling');
  const edgeCatalogPath = '/direct/copilot_catalog';
  const edgeCase = mockDiscoverRepositories({
    [edgeCatalogPath]: 'Edge Case'
  });
  const edgeRepo = edgeCase[0];
  
  // Should treat parent as repo root since basename is 'copilot_catalog'
  assertPathEquals(edgeRepo.rootPath, path.dirname(path.resolve(edgeCatalogPath)), 'Edge case rootPath (parent of copilot_catalog)');
  
  console.log('🎉 All repository discovery tests passed!');
}

run().catch(e => {
  console.error('repositoryDiscovery.test FAIL', e);
  process.exit(1);
});
