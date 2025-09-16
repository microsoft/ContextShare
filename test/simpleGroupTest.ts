// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Simple test to validate group extraction logic without VSCode dependencies

import { ResourceCategory, ResourceGroup, Resource, ResourceState, Repository } from '../src/models';

const repo: Repository = { id:'test', name:'test', rootPath:'/test', catalogPath:'/test/catalog', runtimePath:'/test/.github', isActive:true };

// Mock extractGroupPath function standalone (copy from resourceService.ts)
function extractGroupPath(relativePath: string, category: ResourceCategory): string | undefined {
  const categoryPrefix = `${category}/`;
  if (!relativePath.startsWith(categoryPrefix)) {
    return undefined;
  }
  
  const pathWithinCategory = relativePath.substring(categoryPrefix.length);
  const pathParts = pathWithinCategory.split('/');
  
  // If file is directly in category folder, no group
  if (pathParts.length <= 1) {
    return undefined;
  }
  
  // Return all path parts except the filename as the group path
  return pathParts.slice(0, -1).join('/');
}

function testGroupExtraction() {
  console.log('Testing group path extraction...');
  
  // Test cases
  const testCases = [
    {
      path: 'chatmodes/ai-agents/code-assistant.chatmode.md',
      category: ResourceCategory.CHATMODES,
      expected: 'ai-agents'
    },
    {
      path: 'prompts/workflows/advanced/setup.prompt.md',
      category: ResourceCategory.PROMPTS,
      expected: 'workflows/advanced'
    },
    {
      path: 'instructions/simple.instructions.md',
      category: ResourceCategory.INSTRUCTIONS,
      expected: undefined
    },
    {
      path: 'chatmodes/top-level.chatmode.md',
      category: ResourceCategory.CHATMODES,
      expected: undefined
    }
  ];
  
  for (const testCase of testCases) {
    const result = extractGroupPath(testCase.path, testCase.category);
    if (result !== testCase.expected) {
      throw new Error(`Failed for ${testCase.path}: expected ${testCase.expected}, got ${result}`);
    }
    console.log(`✓ ${testCase.path} -> ${result || '(no group)'}`);
  }
  
  console.log('All group extraction tests passed!');
}

// Test creating mock resources with groups
function testMockResourceCreation() {
  console.log('\nTesting mock resource creation with groups...');
  
  const resources: Resource[] = [
    {
      id: 'test:chatmodes/ai-agents/code-assistant.chatmode.md',
      relativePath: 'chatmodes/ai-agents/code-assistant.chatmode.md',
      absolutePath: '/test/catalog/chatmodes/ai-agents/code-assistant.chatmode.md',
      category: ResourceCategory.CHATMODES,
      targetSubdir: 'chatmodes',
      repository: repo,
      state: ResourceState.ACTIVE,
      origin: 'catalog',
      groupPath: extractGroupPath('chatmodes/ai-agents/code-assistant.chatmode.md', ResourceCategory.CHATMODES)
    },
    {
      id: 'test:chatmodes/ai-agents/documentation-writer.chatmode.md',
      relativePath: 'chatmodes/ai-agents/documentation-writer.chatmode.md',
      absolutePath: '/test/catalog/chatmodes/ai-agents/documentation-writer.chatmode.md',
      category: ResourceCategory.CHATMODES,
      targetSubdir: 'chatmodes',
      repository: repo,
      state: ResourceState.INACTIVE,
      origin: 'catalog',
      groupPath: extractGroupPath('chatmodes/ai-agents/documentation-writer.chatmode.md', ResourceCategory.CHATMODES)
    },
    {
      id: 'test:chatmodes/simple.chatmode.md',
      relativePath: 'chatmodes/simple.chatmode.md',
      absolutePath: '/test/catalog/chatmodes/simple.chatmode.md',
      category: ResourceCategory.CHATMODES,
      targetSubdir: 'chatmodes',
      repository: repo,
      state: ResourceState.ACTIVE,
      origin: 'catalog',
      groupPath: extractGroupPath('chatmodes/simple.chatmode.md', ResourceCategory.CHATMODES)
    }
  ];
  
  console.log('Created resources:');
  for (const resource of resources) {
    console.log(`- ${resource.relativePath} (group: ${resource.groupPath || 'none'}, state: ${resource.state})`);
  }
  
  // Test grouping logic
  const aiAgentsResources = resources.filter(r => r.groupPath === 'ai-agents');
  const ungroupedResources = resources.filter(r => !r.groupPath);
  
  console.log(`\nGrouping results:`);
  console.log(`- ai-agents group: ${aiAgentsResources.length} resources`);
  console.log(`- ungrouped: ${ungroupedResources.length} resources`);
  
  if (aiAgentsResources.length !== 2) {
    throw new Error(`Expected 2 ai-agents resources, got ${aiAgentsResources.length}`);
  }
  
  if (ungroupedResources.length !== 1) {
    throw new Error(`Expected 1 ungrouped resource, got ${ungroupedResources.length}`);
  }
  
  console.log('Resource creation and grouping tests passed!');
}

function runTests() {
  try {
    testGroupExtraction();
    testMockResourceCreation();
    console.log('\n🎉 All tests passed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  runTests();
}

export { testGroupExtraction, testMockResourceCreation };