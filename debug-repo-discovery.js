// Debug test to understand the current behavior
const path = require('path');
const os = require('os');

// Import shared utilities (would normally use ES modules, but keeping CommonJS for simplicity)
function createTestPaths(baseName) {
  const tempDir = os.tmpdir();
  const baseDir = path.join(tempDir, 'copilot-catalog-tests', baseName || 'debug-repo-discovery');
  
  return {
    // Repository paths
    repoRoot: path.join(baseDir, 'test-repo'),
    catalogPath: path.join(baseDir, 'test-repo', 'copilot_catalog'),
    runtimePath: path.join(baseDir, 'test-repo', '.github'),
    
    // Workspace paths  
    workspaceRoot: path.join(baseDir, 'workspace'),
    workspaceGithub: path.join(baseDir, 'workspace', '.github'),
    workspaceVscode: path.join(baseDir, 'workspace', '.vscode'),
    
    // Base directory for cleanup
    baseDir
  };
}

// Mock the discoverRepositories function to see what's happening
function debugDiscoverRepositories(runtimeDirName) {
    const repos = [];
    const testPaths = createTestPaths();
    
    // Mock test configuration with portable paths
    const catalogDirectories = {
        [testPaths.catalogPath]: 'Remote'
    };
    
    for (const [catalogPath, displayName] of Object.entries(catalogDirectories)) {
        const absoluteCatalogPath = catalogPath;
        
        let repoRoot;
        let runtimePath;
        
        if (path.basename(absoluteCatalogPath).toLowerCase() === 'copilot_catalog') {
            // Traditional structure: repo/copilot_catalog -> repo root is parent
            repoRoot = path.dirname(absoluteCatalogPath);
            runtimePath = path.join(repoRoot, runtimeDirName);
        } else {
            // Direct catalog directory: use catalog directory as repo root
            repoRoot = absoluteCatalogPath;
            runtimePath = path.join(repoRoot, runtimeDirName);
        }
        
        console.log('DEBUG: Repository being created:');
        console.log('  catalogPath:', absoluteCatalogPath);
        console.log('  displayName:', displayName);
        console.log('  repoRoot:', repoRoot);
        console.log('  runtimePath:', runtimePath);
        console.log('  basename check:', path.basename(absoluteCatalogPath).toLowerCase());
        
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

// Test the current behavior
console.log('=== Current Repository Discovery Behavior ===');
const testPaths = createTestPaths();
const repos = debugDiscoverRepositories('.github');

console.log('\n=== Target Workspace Setting ===');
console.log('copilotCatalog.targetWorkspace:', testPaths.workspaceRoot);

console.log('\n=== Expected Behavior ===');
console.log('User assets should be discovered from:', testPaths.workspaceGithub);
console.log('Catalog assets should come from:', testPaths.catalogPath);
console.log('Catalog .github should be IGNORED:', path.join(path.dirname(testPaths.catalogPath), '.github'));

console.log('\n=== Actual Behavior (WRONG) ===');
console.log('Repository runtimePath:', repos[0].runtimePath);
console.log('This means user assets are being discovered from the CATALOG repository, not the target workspace!');
