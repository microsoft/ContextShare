import * as path from 'path';
import { Repository, Resource, ResourceCategory, ResourceState } from '../src/models';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';

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
  console.log('Testing getTargetPath method...');
  
  // Test 1: Traditional structure with no target workspace override
  console.log('✅ Test 1: Traditional structure, no target workspace override');
  const traditionalRepo: Repository = {
    id: 'traditional',
    name: 'Traditional',
    rootPath: '/workspace/project',
    catalogPath: '/workspace/project/copilot_catalog',
    runtimePath: '/workspace/project/.github',
    isActive: true
  };
  
  const fs1 = new MockFileService({});
  const svc1 = new ResourceService(fs1 as any);
  svc1.setCurrentWorkspaceRoot('/workspace/current');
  
  const chatmodeResource = createTestResource(traditionalRepo, ResourceCategory.CHATMODES, 'test.chatmode.md');
  const targetPath1 = svc1.getTargetPath(chatmodeResource);
  const expectedPath1 = '/workspace/current/.github/chatmodes/test.chatmode.md';
  
  if (path.normalize(targetPath1) !== path.normalize(expectedPath1)) {
    throw new Error(`Expected '${expectedPath1}', got '${targetPath1}'`);
  }
  
  // Test 2: Direct catalog structure with no target workspace override
  console.log('✅ Test 2: Direct catalog structure, no target workspace override');
  const directRepo: Repository = {
    id: 'direct',
    name: 'Direct',
    rootPath: 'Q:\\dev\\catalog',
    catalogPath: 'Q:\\dev\\catalog',
    runtimePath: 'Q:\\dev\\catalog\\.github',
    isActive: true
  };
  
  const fs2 = new MockFileService({});
  const svc2 = new ResourceService(fs2 as any);
  svc2.setCurrentWorkspaceRoot('C:\\workspace\\current');
  
  const promptResource = createTestResource(directRepo, ResourceCategory.PROMPTS, 'test.prompt.md');
  const targetPath2 = svc2.getTargetPath(promptResource);
  const expectedPath2 = 'C:\\workspace\\current\\.github\\prompts\\test.prompt.md';
  
  if (path.normalize(targetPath2) !== path.normalize(expectedPath2)) {
    throw new Error(`Expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Test 3: With explicit target workspace override
  console.log('✅ Test 3: With explicit target workspace override');
  const fs3 = new MockFileService({});
  const svc3 = new ResourceService(fs3 as any);
  svc3.setCurrentWorkspaceRoot('/workspace/current');
  svc3.setTargetWorkspaceOverride('/explicit/target');
  
  const instructionResource = createTestResource(traditionalRepo, ResourceCategory.INSTRUCTIONS, 'test.instruction.md');
  const targetPath3 = svc3.getTargetPath(instructionResource);
  const expectedPath3 = '/explicit/target/.github/instructions/test.instruction.md';
  
  if (path.normalize(targetPath3) !== path.normalize(expectedPath3)) {
    throw new Error(`Expected '${expectedPath3}', got '${targetPath3}'`);
  }
  
  // Test 4: MCP resource targeting .vscode/mcp.json
  console.log('✅ Test 4: MCP resource targeting .vscode/mcp.json');
  const fs4 = new MockFileService({});
  const svc4 = new ResourceService(fs4 as any);
  svc4.setCurrentWorkspaceRoot('/workspace/current');
  
  const mcpResource = createTestResource(traditionalRepo, ResourceCategory.MCP, 'test.mcp.json');
  const targetPath4 = svc4.getTargetPath(mcpResource);
  const expectedPath4 = '/workspace/current/.vscode/mcp.json';
  
  if (path.normalize(targetPath4) !== path.normalize(expectedPath4)) {
    throw new Error(`Expected '${expectedPath4}', got '${targetPath4}'`);
  }
  
  // Test 5: MCP resource with explicit target workspace
  console.log('✅ Test 5: MCP resource with explicit target workspace');
  const fs5 = new MockFileService({});
  const svc5 = new ResourceService(fs5 as any);
  svc5.setCurrentWorkspaceRoot('/workspace/current');
  svc5.setTargetWorkspaceOverride('/explicit/target');
  
  const mcpResource2 = createTestResource(directRepo, ResourceCategory.MCP, 'servers.mcp.json');
  const targetPath5 = svc5.getTargetPath(mcpResource2);
  const expectedPath5 = '/explicit/target/.vscode/mcp.json';
  
  if (path.normalize(targetPath5) !== path.normalize(expectedPath5)) {
    throw new Error(`Expected '${expectedPath5}', got '${targetPath5}'`);
  }
  
  // Test 6: No current workspace root fallback (should use repo root)
  console.log('✅ Test 6: Fallback to repository root when no current workspace');
  const fs6 = new MockFileService({});
  const svc6 = new ResourceService(fs6 as any);
  // Don't set current workspace root
  
  const taskResource = createTestResource(traditionalRepo, ResourceCategory.TASKS, 'test.task.json');
  const targetPath6 = svc6.getTargetPath(taskResource);
  const expectedPath6 = '/workspace/project/.github/tasks/test.task.json';
  
  if (path.normalize(targetPath6) !== path.normalize(expectedPath6)) {
    throw new Error(`Expected '${expectedPath6}', got '${targetPath6}'`);
  }
  
  // Test 7: Custom runtime directory
  console.log('✅ Test 7: Custom runtime directory');
  const fs7 = new MockFileService({});
  const svc7 = new ResourceService(fs7 as any);
  svc7.setCurrentWorkspaceRoot('/workspace/current');
  svc7.setRuntimeDirectoryName('.copilot');
  
  const customResource = createTestResource(traditionalRepo, ResourceCategory.CHATMODES, 'custom.chatmode.md');
  const targetPath7 = svc7.getTargetPath(customResource);
  const expectedPath7 = '/workspace/current/.copilot/chatmodes/custom.chatmode.md';
  
  if (path.normalize(targetPath7) !== path.normalize(expectedPath7)) {
    throw new Error(`Expected '${expectedPath7}', got '${targetPath7}'`);
  }
  
  // Test 8: Empty target workspace override (should clear it)
  console.log('✅ Test 8: Empty target workspace override');
  const fs8 = new MockFileService({});
  const svc8 = new ResourceService(fs8 as any);
  svc8.setCurrentWorkspaceRoot('/workspace/current');
  svc8.setTargetWorkspaceOverride('  '); // Empty/whitespace should clear override
  
  const emptyResource = createTestResource(traditionalRepo, ResourceCategory.PROMPTS, 'empty.prompt.md');
  const targetPath8 = svc8.getTargetPath(emptyResource);
  const expectedPath8 = '/workspace/current/.github/prompts/empty.prompt.md';
  
  if (path.normalize(targetPath8) !== path.normalize(expectedPath8)) {
    throw new Error(`Expected '${expectedPath8}', got '${targetPath8}'`);
  }
  
  console.log('🎉 All getTargetPath tests passed!');
}

run().catch(e => {
  console.error('targetPath.test FAIL', e);
  process.exit(1);
});
