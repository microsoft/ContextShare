// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Integration test for hierarchical catalog structure with groups

import * as path from 'path';
import { ResourceCategory, Resource, ResourceState, Repository } from '../src/models';
import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';

async function testHierarchicalCatalogDiscovery() {
  console.log('Testing hierarchical catalog discovery...');
  
  // Create mock file structure
  const testStructure: Record<string, string> = {
    '/test-catalog/chatmodes/ai-agents/code-assistant.chatmode.md': '# Code Assistant\nA chatmode for coding assistance.',
    '/test-catalog/chatmodes/ai-agents/testing-assistant.chatmode.md': '# Testing Assistant\nA chatmode for test automation.',
    '/test-catalog/chatmodes/workflows/release-workflow.chatmode.md': '# Release Workflow\nA chatmode for release management.',
    '/test-catalog/instructions/setup/dev-setup.instructions.md': '# Dev Setup\nInstructions for development setup.',
    '/test-catalog/instructions/setup/production-deployment.instructions.md': '# Production Deployment\nInstructions for production deployment.',
    '/test-catalog/instructions/advanced/api-design.instructions.md': '# API Design\nAdvanced API design patterns.',
    '/test-catalog/prompts/dev/code-review.prompt.md': '# Code Review\nPrompt for code review assistance.',
    '/test-catalog/prompts/user-guides/getting-started.prompt.md': '# Getting Started\nPrompt for user onboarding.'
  };
  
  const mockFileService = new MockFileService(testStructure);
  const resourceService = new ResourceService(mockFileService);
  
  // Set up test repository
  const repo: Repository = {
    id: 'test-repo',
    name: 'Test Repository',
    rootPath: '/test-workspace',
    catalogPath: '/test-catalog',
    runtimePath: '/test-workspace/.github',
    isActive: true
  };
  
  // Set root catalog override to enable recursive discovery
  resourceService.setRootCatalogOverride('/test-catalog');
  
  try {
    // Discover resources
    const resources = await resourceService.discoverResources(repo);
    
    console.log(`\nDiscovered ${resources.length} resources:`);
    for (const resource of resources) {
      console.log(`- ${resource.relativePath} (group: ${resource.groupPath || 'none'})`);
    }
    
    // Test group building for each category
    const categories = [ResourceCategory.CHATMODES, ResourceCategory.INSTRUCTIONS, ResourceCategory.PROMPTS];
    
    for (const category of categories) {
      console.log(`\nTesting groups for ${category}:`);
      const groups = resourceService.buildResourceGroups(resources, category);
      
      const printGroups = (groups: any[], indent = '') => {
        for (const group of groups) {
          const resourceCount = group.resources.length;
          const activeCount = group.resources.filter((r: Resource) => r.state === ResourceState.ACTIVE).length;
          console.log(`${indent}📁 ${group.name} (${activeCount}/${resourceCount} active) - ${group.enabled ? 'enabled' : group.partiallyEnabled ? 'partial' : 'disabled'}`);
          
          if (group.children && group.children.length > 0) {
            printGroups(group.children, indent + '  ');
          }
          
          for (const resource of group.resources) {
            const statusIcon = resource.state === ResourceState.ACTIVE ? '✅' : '⏸️';
            console.log(`${indent}  ${statusIcon} ${path.basename(resource.relativePath)}`);
          }
        }
      };
      
      printGroups(groups);
      
      // Validate expected groups
      if (category === ResourceCategory.CHATMODES) {
        const expectedGroups = ['ai-agents', 'workflows'];
        const actualGroups = groups.map(g => g.name);
        for (const expected of expectedGroups) {
          if (!actualGroups.includes(expected)) {
            throw new Error(`Expected group '${expected}' not found in ${category}`);
          }
        }
        console.log(`✅ Found expected groups: ${actualGroups.join(', ')}`);
      }
      
      if (category === ResourceCategory.INSTRUCTIONS) {
        const setupGroup = groups.find(g => g.name === 'setup');
        const advancedGroup = groups.find(g => g.name === 'advanced');
        if (!setupGroup) {
          throw new Error('Expected setup group not found in instructions');
        }
        if (!advancedGroup) {
          throw new Error('Expected advanced group not found in instructions');
        }
        if (setupGroup.resources.length !== 2) {
          throw new Error(`Expected 2 resources in setup group, got ${setupGroup.resources.length}`);
        }
        console.log(`✅ Found setup group with ${setupGroup.resources.length} resources`);
        console.log(`✅ Found advanced group with ${advancedGroup.resources.length} resources`);
      }
    }
    
    console.log('\n🎉 Hierarchical catalog discovery test passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', (error as Error).message);
    throw error;
  }
}

async function runIntegrationTest() {
  try {
    await testHierarchicalCatalogDiscovery();
    console.log('\n🎉 All integration tests passed!');
  } catch (error) {
    console.error('\n❌ Integration test failed:', (error as Error).message);
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  runIntegrationTest();
}

export { testHierarchicalCatalogDiscovery };