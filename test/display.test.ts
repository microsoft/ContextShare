/**
 * Tests for display utilities
 */

import { getDisplayName } from '../src/utils/display';
import { ResourceCategory } from '../src/models';

function testDisplayName(filename: string, category: ResourceCategory, expected: string) {
  const result = getDisplayName(filename, category);
  const success = result === expected;
  const categoryName = Object.keys(ResourceCategory)[Object.values(ResourceCategory).indexOf(category)];
  console.log(`${success ? '✅' : '❌'} ${filename} (${categoryName}) -> "${result}" ${success ? '' : `(expected "${expected}")`}`);
  return success;
}

console.log('Testing display name functionality...\n');

let allTests = 0;
let passedTests = 0;

// Test chatmode files
allTests++; if (testDisplayName('default.chatmode.md', ResourceCategory.CHATMODES, 'default')) passedTests++;
allTests++; if (testDisplayName('Beast3.1.chatmode.md', ResourceCategory.CHATMODES, 'Beast3.1')) passedTests++;
allTests++; if (testDisplayName('agent-debug.chatmode.md', ResourceCategory.CHATMODES, 'agent-debug')) passedTests++;

// Test instruction files
allTests++; if (testDisplayName('system.instructions.md', ResourceCategory.INSTRUCTIONS, 'system')) passedTests++;
allTests++; if (testDisplayName('setup.instruction.md', ResourceCategory.INSTRUCTIONS, 'setup')) passedTests++;

// Test prompt files
allTests++; if (testDisplayName('init.prompt.md', ResourceCategory.PROMPTS, 'init')) passedTests++;
allTests++; if (testDisplayName('debug-helper.prompt.md', ResourceCategory.PROMPTS, 'debug-helper')) passedTests++;

// Test task files
allTests++; if (testDisplayName('build.task.json', ResourceCategory.TASKS, 'build')) passedTests++;
allTests++; if (testDisplayName('deploy-prod.task.json', ResourceCategory.TASKS, 'deploy-prod')) passedTests++;

// Test MCP files
allTests++; if (testDisplayName('servers.mcp.json', ResourceCategory.MCP, 'servers')) passedTests++;
allTests++; if (testDisplayName('local-config.mcp.json', ResourceCategory.MCP, 'local-config')) passedTests++;

// Test edge cases
allTests++; if (testDisplayName('no-extension', ResourceCategory.CHATMODES, 'no-extension')) passedTests++;
allTests++; if (testDisplayName('file.md', ResourceCategory.PROMPTS, 'file')) passedTests++;

// Test disabled user assets (should still show clean name)
allTests++; if (testDisplayName('my-custom.chatmode.md', ResourceCategory.CHATMODES, 'my-custom')) passedTests++;
allTests++; if (testDisplayName('user-helper.prompt.md', ResourceCategory.PROMPTS, 'user-helper')) passedTests++;

console.log(`\nResults: ${passedTests}/${allTests} tests passed`);

if (passedTests === allTests) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}
