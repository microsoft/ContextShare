import * as path from 'path';
import { Repository, Resource, ResourceCategory, ResourceState } from '../src/models';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { createCatalogAsRootPaths, createExpectedTargets, createMockFileStructure, normalizePath } from './testUtils';

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

async function run() {
  console.log('Testing workspace configuration edge cases...');
  
  // Test 1: User's actual configuration scenario (catalog as repo root)
  console.log('✅ Test 1: Real user configuration (catalog as repo root)');
  
  // Create portable test paths
  const testPaths = createCatalogAsRootPaths('workspace-config-test');
  const userRepo = createEdgeCaseRepository(
    testPaths.repoRoot,
    testPaths.catalogPath,
    testPaths.runtimePath
  );
  
  // Create mock file structure
  const mockFiles = createMockFileStructure(testPaths);
  
  const fs1 = new MockFileService(mockFiles);
  const svc1 = new ResourceService(fs1 as any);
  svc1.setCurrentWorkspaceRoot(testPaths.workspaceRoot);
  
  const resource1 = createTestResource(userRepo, ResourceCategory.CHATMODES, 'test.chatmode.md');
  const targetPath1 = svc1.getTargetPath(resource1);
  
  // Should target current workspace, not the catalog directory
  const expectedTargets = createExpectedTargets(testPaths.workspaceRoot);
  const expectedPath1 = path.join(expectedTargets.chatmode, 'test.chatmode.md');
  
  if (normalizePath(targetPath1) !== normalizePath(expectedPath1)) {
    throw new Error(`Expected '${expectedPath1}', got '${targetPath1}'`);
  }
  
  // Test 2: Target workspace override behavior
  console.log('✅ Test 2: Target workspace override behavior');
  const fs2 = new MockFileService({});
  const svc2 = new ResourceService(fs2 as any);
  
  // Initial configuration - should use current workspace
  svc2.setCurrentWorkspaceRoot(testPaths.workspaceRoot);
  svc2.setTargetWorkspaceOverride(''); // Empty override
  
  const resource2 = createTestResource(userRepo, ResourceCategory.TASKS, 'build.task.json');
  let targetPath2 = svc2.getTargetPath(resource2);
  let expectedPath2 = path.join(expectedTargets.task, 'build.task.json');
  
  if (normalizePath(targetPath2) !== normalizePath(expectedPath2)) {
    throw new Error(`Initial config: expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Set explicit target workspace
  svc2.setTargetWorkspaceOverride(testPaths.altWorkspaceRoot);
  targetPath2 = svc2.getTargetPath(resource2);
  const altExpectedTargets = createExpectedTargets(testPaths.altWorkspaceRoot);
  expectedPath2 = path.join(altExpectedTargets.task, 'build.task.json');
  
  if (normalizePath(targetPath2) !== normalizePath(expectedPath2)) {
    throw new Error(`Explicit target: expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Clear explicit target (back to workspace)
  svc2.setTargetWorkspaceOverride('');
  targetPath2 = svc2.getTargetPath(resource2);
  expectedPath2 = path.join(expectedTargets.task, 'build.task.json');
  
  if (normalizePath(targetPath2) !== normalizePath(expectedPath2)) {
    throw new Error(`Cleared target: expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Test 3: MCP resource always targets .vscode in current workspace
  console.log('✅ Test 3: MCP targeting behavior');
  const fs3 = new MockFileService({});
  const svc3 = new ResourceService(fs3 as any);
  svc3.setCurrentWorkspaceRoot(testPaths.workspaceRoot);
  
  const mcpResource = createTestResource(userRepo, ResourceCategory.MCP, 'servers.mcp.json');
  const mcpTargetPath = svc3.getTargetPath(mcpResource);
  const expectedMcpPath = expectedTargets.mcp;
  
  if (normalizePath(mcpTargetPath) !== normalizePath(expectedMcpPath)) {
    throw new Error(`MCP target: expected '${expectedMcpPath}', got '${mcpTargetPath}'`);
  }
  
  console.log('🎉 All workspace configuration edge case tests passed!');
}

run().catch(e => {
  console.error('workspaceConfiguration.test FAIL', e);
  process.exit(1);
});
