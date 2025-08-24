// Debug resource discovery behavior with CORRECTED repository discovery logic
const path = require('path');

// Mock the CORRECTED discoverRepositories function
function debugCorrectedRepositoryDiscovery() {
    // Your settings
    const catalogDirectories = {
        'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog': 'Remote'
    };
    const targetWorkspace = 'Q:\\dev\\vscode-copilot-catalog-manager\\';
    const runtimeDirName = '.github';
    
    console.log('=== Testing CORRECTED Repository Discovery ===');
    console.log('catalogDirectory setting:', catalogDirectories);
    console.log('targetWorkspace setting:', targetWorkspace);
    
    for (const [catalogPath, displayName] of Object.entries(catalogDirectories)) {
        const absoluteCatalogPath = catalogPath;
        
        let repoRoot;
        let runtimePath;
        
        // NEW CORRECTED LOGIC
        if (targetWorkspace && targetWorkspace.trim()) {
            // When targetWorkspace is set, use it as the repository root
            repoRoot = targetWorkspace.trim();
            runtimePath = path.join(repoRoot, runtimeDirName);
        } else {
            // Fallback to old logic when no targetWorkspace is set
            if (path.basename(absoluteCatalogPath).toLowerCase() === 'copilot_catalog') {
                repoRoot = path.dirname(absoluteCatalogPath);
                runtimePath = path.join(repoRoot, runtimeDirName);
            } else {
                repoRoot = absoluteCatalogPath;
                runtimePath = path.join(repoRoot, runtimeDirName);
            }
        }
        
        console.log('\n=== Repository Created ===');
        console.log('catalogPath:', absoluteCatalogPath);
        console.log('repoRoot:', repoRoot);
        console.log('runtimePath:', runtimePath);
        
        console.log('\n=== This Means ===');
        console.log('Catalog resources come FROM:', absoluteCatalogPath);
        console.log('User assets are discovered FROM:', runtimePath);
        console.log('Activated resources go TO:', runtimePath);
        
        return {
            catalogPath: absoluteCatalogPath,
            rootPath: repoRoot,
            runtimePath: runtimePath
        };
    }
}

const repo = debugCorrectedRepositoryDiscovery();

console.log('\n=== Verification ===');
console.log('✅ Should user assets be discovered from catalog .github?', 
    repo.runtimePath.includes('Overlake-FPGA-AI') ? 'NO - FIXED!' : 'YES - STILL BROKEN');
console.log('✅ Should user assets be discovered from workspace .github?', 
    repo.runtimePath.includes('vscode-copilot-catalog-manager') ? 'YES - CORRECT!' : 'NO - STILL BROKEN');
