import * as path from 'path';
import { Repository, Resource, ResourceCategory, ResourceState } from '../src/models';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';

function createRepository(type: 'traditional' | 'direct', basePath: string): Repository {
  if (type === 'traditional') {
    return {
      id: 'traditional',
      name: 'Traditional',
      rootPath: basePath,
      catalogPath: path.join(basePath, 'copilot_catalog'),
      runtimePath: path.join(basePath, '.github'),
      isActive: true
    };
  } else {
    return {
      id: 'direct',
      name: 'Direct',
      rootPath: basePath,
      catalogPath: basePath,
      runtimePath: path.join(basePath, '.github'),
      isActive: true
    };
  }
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
  console.log('Testing resource activation with different repository structures...');
  
  // Test 1: Traditional structure activation with workspace fallback
  console.log('✅ Test 1: Traditional structure activation');
  const traditionalRepo = createRepository('traditional', '/workspace/project');
  const traditionalStructure: Record<string, string> = {
    '/workspace/project/copilot_catalog/chatmodes/agent.chatmode.md': '# Agent Mode\nHelp with development tasks.'
  };
  
  const fs1 = new MockFileService(traditionalStructure);
  const svc1 = new ResourceService(fs1 as any);
  svc1.setCurrentWorkspaceRoot('/workspace/active');
  
  const resources1 = await svc1.discoverResources(traditionalRepo);
  const chatmode1 = resources1.find(r => r.category === ResourceCategory.CHATMODES);
  
  if (!chatmode1) {
    throw new Error('Chatmode resource not discovered in traditional structure');
  }
  
  // Verify target path uses current workspace
  const targetPath1 = svc1.getTargetPath(chatmode1);
  const expectedPath1 = '/workspace/active/.github/chatmodes/agent.chatmode.md';
  if (normalizePath(targetPath1) !== normalizePath(expectedPath1)) {
    throw new Error(`Traditional target: expected '${expectedPath1}', got '${targetPath1}'`);
  }
  
  // Activate and verify
  const result1 = await svc1.activateResource(chatmode1);
  if (!result1.success) {
    throw new Error(`Traditional activation failed: ${result1.message}`);
  }
  
  // Test 2: Direct catalog structure activation with workspace fallback
  console.log('✅ Test 2: Direct catalog structure activation');
  const directRepo = createRepository('direct', 'Q:/shared/team-catalog');
  const directStructure: Record<string, string> = {
    'Q:/shared/team-catalog/prompts/template.prompt.md': '# Template Prompt\nGenerate code templates.'
  };
  
  const fs2 = new MockFileService(directStructure);
  const svc2 = new ResourceService(fs2 as any);
  svc2.setCurrentWorkspaceRoot('C:/workspace/current');
  
  const resources2 = await svc2.discoverResources(directRepo);
  const prompt2 = resources2.find(r => r.category === ResourceCategory.PROMPTS);
  
  if (!prompt2) {
    throw new Error('Prompt resource not discovered in direct structure');
  }
  
  // Verify target path uses current workspace (not catalog directory)
  const targetPath2 = svc2.getTargetPath(prompt2);
  const expectedPath2 = 'C:/workspace/current/.github/prompts/template.prompt.md';
  if (normalizePath(targetPath2) !== normalizePath(expectedPath2)) {
    throw new Error(`Direct target: expected '${expectedPath2}', got '${targetPath2}'`);
  }
  
  // Activate and verify
  const result2 = await svc2.activateResource(prompt2);
  if (!result2.success) {
    throw new Error(`Direct activation failed: ${result2.message}`);
  }
  
  // Test 3: MCP activation with different structures
  console.log('✅ Test 3: MCP activation behavior');
  const mcpContent = JSON.stringify({
    servers: {
      TestServer: { command: 'test-mcp-server', args: ['--port', '3000'] }
    }
  });
  
  const traditionalMcpStructure: Record<string, string> = {
    '/workspace/project/copilot_catalog/mcp/servers.mcp.json': mcpContent
  };
  
  const fs3 = new MockFileService(traditionalMcpStructure);
  const svc3 = new ResourceService(fs3 as any);
  svc3.setCurrentWorkspaceRoot('/workspace/active');
  
  const resources3 = await svc3.discoverResources(traditionalRepo);
  const mcp3 = resources3.find(r => r.category === ResourceCategory.MCP);
  
  if (!mcp3) {
    throw new Error('MCP resource not discovered');
  }
  
  // MCP should always target .vscode/mcp.json in current workspace
  const mcpTargetPath = svc3.getTargetPath(mcp3);
  const expectedMcpPath = '/workspace/active/.vscode/mcp.json';
  if (normalizePath(mcpTargetPath) !== normalizePath(expectedMcpPath)) {
    throw new Error(`MCP target: expected '${expectedMcpPath}', got '${mcpTargetPath}'`);
  }
  
  // Test 4: Resource state calculation
  console.log('✅ Test 4: Resource state calculation');
  const stateStructure: Record<string, string> = {
    '/workspace/project/copilot_catalog/tasks/build.task.json': '{"label": "Build", "command": "npm run build"}',
    '/workspace/active/.github/tasks/build.task.json': '{"label": "Build", "command": "npm run build"}' // Same content
  };
  
  const fs4 = new MockFileService(stateStructure);
  const svc4 = new ResourceService(fs4 as any);
  svc4.setCurrentWorkspaceRoot('/workspace/active');
  
  const resources4 = await svc4.discoverResources(traditionalRepo);
  const task4 = resources4.find(r => r.category === ResourceCategory.TASKS);
  
  if (!task4) {
    throw new Error('Task resource not discovered');
  }
  
  const state4 = await svc4.getResourceState(task4);
  if (state4 !== ResourceState.ACTIVE) {
    throw new Error(`Expected ACTIVE state, got ${state4}`);
  }
  
  console.log('🎉 All resource activation tests passed!');
}

run().catch(e => {
  console.error('resourceActivation.test FAIL', e);
  process.exit(1);
});
