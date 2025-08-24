// Debug test to understand the current behavior
const path = require('path');

// Mock the discoverRepositories function to see what's happening
function debugDiscoverRepositories(runtimeDirName) {
    const repos = [];
    
    // Mock your current configuration
    const catalogDirectories = {
        'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog': 'Remote'
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
const repos = debugDiscoverRepositories('.github');

console.log('\n=== Target Workspace Setting ===');
console.log('copilotCatalog.targetWorkspace: Q:\\dev\\vscode-copilot-catalog-manager\\');

console.log('\n=== Expected Behavior ===');
console.log('User assets should be discovered from: Q:\\dev\\vscode-copilot-catalog-manager\\.github');
console.log('Catalog assets should come from: Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog');
console.log('Catalog .github should be IGNORED: Q:\\dev\\Overlake-FPGA-AI\\.github');

console.log('\n=== Actual Behavior (WRONG) ===');
console.log('Repository runtimePath:', repos[0].runtimePath);
console.log('This means user assets are being discovered from the CATALOG repository, not the target workspace!');
