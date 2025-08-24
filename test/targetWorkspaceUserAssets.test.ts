// Test that user assets are discovered from targetWorkspace location

// Mock file service for testing
class MockFileService {
  constructor(private files: Record<string, string>) {}
  
  async stat(filePath: string): Promise<'file' | 'dir' | 'missing'> {
    if (this.files[filePath] !== undefined) return 'file';
    // Check if it's a directory by seeing if any files start with this path + separator
    const normalizedPath = filePath.replace(/\\/g, '/');
    const hasChildren = Object.keys(this.files).some(f => 
      f.replace(/\\/g, '/').startsWith(normalizedPath + '/')
    );
    return hasChildren ? 'dir' : 'missing';
  }
  
  async listDirectory(dirPath: string): Promise<string[]> {
    const normalizedPath = dirPath.replace(/\\/g, '/');
    const children = new Set<string>();
    
    for (const filePath of Object.keys(this.files)) {
      const normalizedFilePath = filePath.replace(/\\/g, '/');
      if (normalizedFilePath.startsWith(normalizedPath + '/')) {
        const relativePath = normalizedFilePath.substring(normalizedPath.length + 1);
        const nextSegment = relativePath.split('/')[0];
        children.add(nextSegment);
      }
    }
    
    return Array.from(children);
  }
  
  async readFile(filePath: string): Promise<string> {
    return this.files[filePath] || '';
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    this.files[filePath] = content;
  }
  
  async ensureDirectory(dirPath: string): Promise<void> {}
  
  async pathExists(filePath: string): Promise<boolean> {
    return this.files[filePath] !== undefined;
  }
  
  async copyFile(srcPath: string, destPath: string): Promise<void> {
    if (this.files[srcPath] !== undefined) {
      this.files[destPath] = this.files[srcPath];
    }
  }
}

// Mock ResourceService imports
const ResourceService = require('../../dist/src/services/resourceService').ResourceService;
const { ResourceCategory, ResourceState } = require('../../dist/src/models');

async function run() {
  console.log('Testing user asset discovery with targetWorkspace...');
  
  // Test repository structure (catalog is remote)
  const repository = {
    id: 'remote-catalog',
    name: 'Remote Catalog',
    rootPath: 'Q:\\dev\\Overlake-FPGA-AI',
    catalogPath: 'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog',
    runtimePath: 'Q:\\dev\\Overlake-FPGA-AI\\.github',
    isActive: true
  };
  
  // Mock file structure:
  // - Catalog has some resources
  // - Target workspace has user assets
  const mockFiles = {
    // Catalog resources
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog\\chatmodes\\remote.chatmode.md': 'Remote chatmode',
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog\\prompts\\remote.prompt.md': 'Remote prompt',
    
    // User assets in target workspace (where they should be discovered from)
    'Q:\\dev\\vscode-copilot-catalog-manager\\.github\\chatmodes\\local-user.chatmode.md': 'Local user chatmode',
    'Q:\\dev\\vscode-copilot-catalog-manager\\.github\\prompts\\local-user.prompt.md': 'Local user prompt',
    'Q:\\dev\\vscode-copilot-catalog-manager\\.github\\tasks\\local-build.task.json': 'Local user task',
    
    // Some assets in repository runtime path (should NOT be discovered when targetWorkspace is set)
    'Q:\\dev\\Overlake-FPGA-AI\\.github\\chatmodes\\old-user.chatmode.md': 'Old user chatmode'
  };
  
  const fs = new MockFileService(mockFiles);
  const svc = new ResourceService(fs);
  
  // Configure service to use target workspace
  svc.setTargetWorkspaceOverride('Q:\\dev\\vscode-copilot-catalog-manager');
  svc.setCurrentWorkspaceRoot('Q:\\dev\\vscode-copilot-catalog-manager');
  
  // Discover resources
  const resources = await svc.discoverResources(repository);
  
  // Check catalog resources
  const catalogResources = resources.filter((r: any) => r.origin === 'catalog');
  console.log(`Found ${catalogResources.length} catalog resources`);
  
  const remoteChatmode = catalogResources.find((r: any) => r.relativePath.includes('remote.chatmode.md'));
  if (!remoteChatmode) {
    throw new Error('Remote catalog chatmode not found');
  }
  console.log('✅ Catalog resources discovered correctly');
  
  // Check user resources - should come from target workspace, not repository runtime path
  const userResources = resources.filter((r: any) => r.origin === 'user');
  console.log(`Found ${userResources.length} user resources`);
  
  const localUserChatmode = userResources.find((r: any) => r.absolutePath.includes('local-user.chatmode.md'));
  if (!localUserChatmode) {
    throw new Error('Local user chatmode not found in target workspace');
  }
  
  const localUserPrompt = userResources.find((r: any) => r.absolutePath.includes('local-user.prompt.md'));
  if (!localUserPrompt) {
    throw new Error('Local user prompt not found in target workspace');
  }
  
  const localUserTask = userResources.find((r: any) => r.absolutePath.includes('local-build.task.json'));
  if (!localUserTask) {
    throw new Error('Local user task not found in target workspace');
  }
  
  // Verify that old user assets from repository runtime path are NOT discovered
  const oldUserChatmode = userResources.find((r: any) => r.absolutePath.includes('old-user.chatmode.md'));
  if (oldUserChatmode) {
    throw new Error('Old user chatmode should NOT be discovered when targetWorkspace is set');
  }
  
  // Verify paths
  const expectedTargetPath = 'Q:\\dev\\vscode-copilot-catalog-manager\\.github';
  if (!localUserChatmode.absolutePath.includes(expectedTargetPath)) {
    throw new Error(`User assets should be from target workspace: ${localUserChatmode.absolutePath}`);
  }
  
  console.log('✅ User assets discovered from target workspace correctly');
  console.log('✅ Repository runtime path assets correctly ignored when targetWorkspace is set');
  
  // Test without targetWorkspace - should use currentWorkspaceRoot
  console.log('Testing fallback behavior without targetWorkspace...');
  
  const svc2 = new ResourceService(fs);
  // Set currentWorkspaceRoot but no targetWorkspace override
  svc2.setCurrentWorkspaceRoot('Q:\\dev\\vscode-copilot-catalog-manager');
  // No targetWorkspace override set
  
  const resources2 = await svc2.discoverResources(repository);
  const userResources2 = resources2.filter((r: any) => r.origin === 'user');
  
  // Should find target workspace assets via currentWorkspaceRoot
  const localUserChatmode2 = userResources2.find((r: any) => r.absolutePath.includes('local-user.chatmode.md'));
  if (!localUserChatmode2) {
    throw new Error('Without targetWorkspace but with currentWorkspaceRoot, should find workspace assets');
  }
  
  console.log('✅ Fallback to currentWorkspaceRoot works correctly');
  
  // Test completely without workspace settings - should fall back to repository runtime path
  console.log('Testing complete fallback to repository runtime path...');
  
  const svc3 = new ResourceService(fs);
  // No targetWorkspace override, no currentWorkspaceRoot
  
  const resources3 = await svc3.discoverResources(repository);
  const userResources3 = resources3.filter((r: any) => r.origin === 'user');
  
  // Should now find the old user assets from repository runtime path
  const oldUserChatmode3 = userResources3.find((r: any) => r.absolutePath.includes('old-user.chatmode.md'));
  if (!oldUserChatmode3) {
    throw new Error('Without any workspace settings, should discover assets from repository runtime path');
  }
  
  console.log('✅ Complete fallback to repository runtime path works correctly');
  
  console.log('🎉 All targetWorkspace user asset discovery tests passed!');
}

run().catch(console.error);
