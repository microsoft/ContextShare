// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ResourceCategory, ResourceGroup, Resource, ResourceState, Repository } from '../src/models';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { createTestRunner, logTestSuccess } from './testUtils';

const repo: Repository = { id:'test', name:'test', rootPath:'/test', catalogPath:'/test/catalog', runtimePath:'/test/.github', isActive:true };

async function testGroupExtraction() {
  const mockFileService = new MockFileService({});
  const resourceService = new ResourceService(mockFileService);
  
  // Create mock resources with group paths
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
      groupPath: 'ai-agents'
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
      groupPath: 'ai-agents'
    },
    {
      id: 'test:chatmodes/workflows/review-process.chatmode.md',
      relativePath: 'chatmodes/workflows/review-process.chatmode.md',
      absolutePath: '/test/catalog/chatmodes/workflows/review-process.chatmode.md',
      category: ResourceCategory.CHATMODES,
      targetSubdir: 'chatmodes',
      repository: repo,
      state: ResourceState.INACTIVE,
      origin: 'catalog',
      groupPath: 'workflows'
    },
    {
      id: 'test:chatmodes/simple.chatmode.md',
      relativePath: 'chatmodes/simple.chatmode.md',
      absolutePath: '/test/catalog/chatmodes/simple.chatmode.md',
      category: ResourceCategory.CHATMODES,
      targetSubdir: 'chatmodes',
      repository: repo,
      state: ResourceState.ACTIVE,
      origin: 'catalog'
      // No groupPath - this is directly in the category folder
    }
  ];
  
  // Test group building
  const groups = resourceService.buildResourceGroups(resources, ResourceCategory.CHATMODES);
  
  // Verify structure
  if (groups.length !== 2) {
    throw new Error(`Expected 2 top-level groups, got ${groups.length}`);
  }
  
  const aiAgentsGroup = groups.find(g => g.name === 'ai-agents');
  const workflowsGroup = groups.find(g => g.name === 'workflows');
  
  if (!aiAgentsGroup) {
    throw new Error('ai-agents group not found');
  }
  
  if (!workflowsGroup) {
    throw new Error('workflows group not found');
  }
  
  // Check ai-agents group
  if (aiAgentsGroup.resources.length !== 2) {
    throw new Error(`Expected 2 resources in ai-agents group, got ${aiAgentsGroup.resources.length}`);
  }
  
  if (!aiAgentsGroup.partiallyEnabled) {
    throw new Error('ai-agents group should be partially enabled (1 active, 1 inactive)');
  }
  
  // Check workflows group  
  if (workflowsGroup.resources.length !== 1) {
    throw new Error(`Expected 1 resource in workflows group, got ${workflowsGroup.resources.length}`);
  }
  
  if (workflowsGroup.enabled) {
    throw new Error('workflows group should not be enabled (all resources inactive)');
  }
  
  logTestSuccess('resourceGroups');
}

createTestRunner('resourceGroups', testGroupExtraction);