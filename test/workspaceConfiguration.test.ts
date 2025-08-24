import * as path from 'path';
import { Repository, Resource, ResourceCategory, ResourceState } from '../src/models';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';

function createEdgeCaseRepository(rootPath: string, catalogPath: string, runtimePath: string): Repository {
  return {
    id: path.basename(rootPath) + '_' + path.basename(catalogPath),
    name: path.basename(catalogPath),
    rootPath,
    catalogPath,
    runtimePath,
    isActive: true
  };
}

function createTestResource(repo: Repository, category: ResourceCategory, fileName: string): Resource {
  return {
    id: `${repo.name}:${fileName}`,
    relativePath: `${category}/${fileName}`,
    absolutePath: path.join(repo.catalogPath, category, fileName),
    category,
    targetSubdir: category,
    repository: repo,
    state: ResourceState.INACTIVE,
    origin: 'catalog'
  };
}

function normalizePath(pathStr: string): string {
  return path.normalize(pathStr).replace(/\\/g, '/');
}

async function run() {
  console.log('Testing workspace configuration edge cases...');
  
  // Test 1: User's actual configuration scenario (key test that was failing)
  console.log('✅ Test 1: Real user configuration (catalog as repo root)');
  const userRepo = createEdgeCaseRepository(
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog',
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog',
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog\\.github'
  );
  
  const fs1 = new MockFileService({
    'Q:\\dev\\Overlake-FPGA-AI\\copilot_catalog\\chatmodes\\test.chatmode.md': 'test chatmode'
  });
  const svc1 = new ResourceService(fs1 as any);
  svc1.setCurrentWorkspaceRoot('C:\\workspace\\my-project');
  
  const resource1 = createTestResource(userRepo, ResourceCategory.CHATMODES, 'test.chatmode.md');
  const targetPath1 = svc1.getTargetPath(resource1);
  
  // Should target current workspace, not the catalog directory
  const expectedPath1 = 'C:/workspace/my-project/.github/chatmodes/test.chatmode.md';
  if (normalizePath(targetPath1) !== normalizePath(expectedPath1)) {
    throw new Error(`Expected '${expectedPath1}', got '${targetPath1}'`);
  }
  
  // Test 2: Target workspace override behavior
  console.log('✅ Test 2: Target workspace override behavior');
  const fs2 = new MockFileService({});
  const svc2 = new ResourceService(fs2 as any);
  
  // Initial configuration - should use current workspace
  svc2.setCurrentWorkspaceRoot('/workspace/current');
  svc2.setTargetWorkspaceOverride(''); // Empty override
  
  const resource2 = createTestResource(userRepo, ResourceCategory.TASKS, 'build.task.json');
  let targetPath2 = svc2.getTargetPath(resource2);
  let expectedPath2 = '/workspace/current/.github/tasks/build.task.json';
  
  if (normalizePath(targetPath2) !== normalizePath(expectedPath2)) {
    throw new Error(`Initial config: expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Set explicit target workspace
  svc2.setTargetWorkspaceOverride('/explicit/target');
  targetPath2 = svc2.getTargetPath(resource2);
  expectedPath2 = '/explicit/target/.github/tasks/build.task.json';
  
  if (normalizePath(targetPath2) !== normalizePath(expectedPath2)) {
    throw new Error(`Explicit target: expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Clear explicit target (back to workspace)
  svc2.setTargetWorkspaceOverride('');
  targetPath2 = svc2.getTargetPath(resource2);
  expectedPath2 = '/workspace/current/.github/tasks/build.task.json';
  
  if (normalizePath(targetPath2) !== normalizePath(expectedPath2)) {
    throw new Error(`Cleared target: expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Test 3: MCP resource always targets .vscode in current workspace
  console.log('✅ Test 3: MCP targeting behavior');
  const fs3 = new MockFileService({});
  const svc3 = new ResourceService(fs3 as any);
  svc3.setCurrentWorkspaceRoot('/workspace/active');
  
  const mcpResource = createTestResource(userRepo, ResourceCategory.MCP, 'servers.mcp.json');
  const mcpTargetPath = svc3.getTargetPath(mcpResource);
  const expectedMcpPath = '/workspace/active/.vscode/mcp.json';
  
  if (normalizePath(mcpTargetPath) !== normalizePath(expectedMcpPath)) {
    throw new Error(`MCP target: expected '${expectedMcpPath}', got '${mcpTargetPath}'`);
  }
  
  console.log('🎉 All workspace configuration edge case tests passed!');
}

run().catch(e => {
  console.error('workspaceConfiguration.test FAIL', e);
  process.exit(1);
});
