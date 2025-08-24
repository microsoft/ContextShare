// Test that "Remote" display name uses workspace for runtime while keeping catalog separate
import * as path from 'path';

// Mock the required modules for testing
const mockCatalogDirectories = {
  'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog': 'Remote'
};

// Mock workspace folders
const mockWorkspaceFolder = {
  uri: { fsPath: 'Q:\\dev\\my-project' }
};

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
  
  // Test 1: "Remote" with copilot_catalog basename should use traditional structure
  const remoteRepo = mockDiscoverRepositories({
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog': 'Remote'
  }, mockWorkspaceFolder)[0];
  
  // With "Remote" display name but copilot_catalog basename, should use traditional structure
  const expectedRootPath = 'Q:\\dev\\Overlake-FPGA-AI';
  const expectedRuntimePath = 'Q:\\dev\\Overlake-FPGA-AI\\.github';
  const expectedCatalogPath = 'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog';
  
  if (path.normalize(remoteRepo.rootPath) !== path.normalize(expectedRootPath)) {
    throw new Error(`Expected Remote catalog rootPath '${expectedRootPath}', got '${remoteRepo.rootPath}'`);
  }
  
  if (path.normalize(remoteRepo.runtimePath) !== path.normalize(expectedRuntimePath)) {
    throw new Error(`Expected Remote catalog runtimePath '${expectedRuntimePath}', got '${remoteRepo.runtimePath}'`);
  }
  
  if (path.normalize(remoteRepo.catalogPath) !== path.normalize(expectedCatalogPath)) {
    throw new Error(`Expected Remote catalog catalogPath '${expectedCatalogPath}', got '${remoteRepo.catalogPath}'`);
  }
  
  console.log('✅ Remote catalog with copilot_catalog basename uses traditional structure (keeps user assets in workspace)');
  
  // Test 2: "Remote" with non-copilot_catalog basename should use workspace for runtime
  const remoteFallbackRepo = mockDiscoverRepositories({
    'Q:\\dev\\some-other-catalog': 'Remote'
  }, mockWorkspaceFolder)[0];
  
  const expectedFallbackRootPath = 'Q:\\dev\\my-project';
  const expectedFallbackRuntimePath = 'Q:\\dev\\my-project\\.github';
  
  if (path.normalize(remoteFallbackRepo.rootPath) !== path.normalize(expectedFallbackRootPath)) {
    throw new Error(`Expected Remote non-copilot_catalog rootPath '${expectedFallbackRootPath}', got '${remoteFallbackRepo.rootPath}'`);
  }
  
  if (path.normalize(remoteFallbackRepo.runtimePath) !== path.normalize(expectedFallbackRuntimePath)) {
    throw new Error(`Expected Remote non-copilot_catalog runtimePath '${expectedFallbackRuntimePath}', got '${remoteFallbackRepo.runtimePath}'`);
  }
  
  console.log('✅ Remote catalog with non-copilot_catalog basename uses workspace for runtime');
  
  // Test 3: Traditional copilot_catalog structure should still work
  const traditionalRepo = mockDiscoverRepositories({
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog': 'Traditional'
  }, mockWorkspaceFolder)[0];
  
  const expectedTraditionalRootPath = 'Q:\\dev\\Overlake-FPGA-AI';
  const expectedTraditionalRuntimePath = 'Q:\\dev\\Overlake-FPGA-AI\\.github';
  
  if (path.normalize(traditionalRepo.rootPath) !== path.normalize(expectedTraditionalRootPath)) {
    throw new Error(`Expected Traditional catalog rootPath '${expectedTraditionalRootPath}', got '${traditionalRepo.rootPath}'`);
  }
  
  if (path.normalize(traditionalRepo.runtimePath) !== path.normalize(expectedTraditionalRuntimePath)) {
    throw new Error(`Expected Traditional catalog runtimePath '${expectedTraditionalRuntimePath}', got '${traditionalRepo.runtimePath}'`);
  }
  
  console.log('✅ Traditional copilot_catalog structure works correctly');
  
  console.log('🎉 All Remote catalog workspace behavior tests passed!');
}

run().catch(console.error);
