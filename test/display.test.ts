// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Tests for display utilities
 */

import { ResourceCategory } from '../src/models';
import { getDisplayName } from '../src/utils/display';

type TestCase = {
  filename: string;
  category: ResourceCategory;
  expected: string;
  description?: string;
};

const testCases: TestCase[] = [
  // Chatmode files
  { filename: 'default.chatmode.md', category: ResourceCategory.CHATMODES, expected: 'default' },
  { filename: 'Beast3.1.chatmode.md', category: ResourceCategory.CHATMODES, expected: 'Beast3.1' },
  { filename: 'agent-debug.chatmode.md', category: ResourceCategory.CHATMODES, expected: 'agent-debug' },
  
  // Instruction files
  { filename: 'system.instructions.md', category: ResourceCategory.INSTRUCTIONS, expected: 'system' },
  { filename: 'setup.instructions.md', category: ResourceCategory.INSTRUCTIONS, expected: 'setup' },
  
  // Prompt files
  { filename: 'init.prompt.md', category: ResourceCategory.PROMPTS, expected: 'init' },
  { filename: 'debug-helper.prompt.md', category: ResourceCategory.PROMPTS, expected: 'debug-helper' },
  
  // Task files
  { filename: 'build.task.json', category: ResourceCategory.TASKS, expected: 'build' },
  { filename: 'deploy-prod.task.json', category: ResourceCategory.TASKS, expected: 'deploy-prod' },
  
  // MCP files
  { filename: 'servers.mcp.json', category: ResourceCategory.MCP, expected: 'servers' },
  { filename: 'local-config.mcp.json', category: ResourceCategory.MCP, expected: 'local-config' },
  
  // Edge cases
  { filename: 'no-extension', category: ResourceCategory.CHATMODES, expected: 'no-extension', description: 'file without extension' },
  { filename: 'file.md', category: ResourceCategory.PROMPTS, expected: 'file', description: 'generic markdown file' },
  
  // User assets (should still show clean name)
  { filename: 'my-custom.chatmode.md', category: ResourceCategory.CHATMODES, expected: 'my-custom', description: 'user-created chatmode' },
  { filename: 'user-helper.prompt.md', category: ResourceCategory.PROMPTS, expected: 'user-helper', description: 'user-created prompt' },
];

function testDisplayName(testCase: TestCase): boolean {
  const result = getDisplayName(testCase.filename, testCase.category);
  const success = result === testCase.expected;
  const categoryName = Object.keys(ResourceCategory)[Object.values(ResourceCategory).indexOf(testCase.category)];
  console.log(`${success ? '✅' : '❌'} ${testCase.filename} (${categoryName}) -> "${result}" ${success ? '' : `(expected "${testCase.expected}")`}`);
  return success;
}

console.log('Testing display name functionality...\n');

let passedTests = 0;

for (const testCase of testCases) {
  if (testDisplayName(testCase)) {
    passedTests++;
  }
}

console.log(`\nResults: ${passedTests}/${testCases.length} tests passed`);

if (passedTests === testCases.length) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}
