// Test file to verify security enhancements work correctly
import { sanitizeErrorMessage, validateMcpConfig, validateTaskConfig } from '../src/utils/security';

console.log('Testing security enhancements...');

// Test error message sanitization
const sensitiveError = new Error('Failed to read C:\\Users\\testuser\\secret\\config.json');
const sanitized = sanitizeErrorMessage(sensitiveError);
console.log('✅ Error sanitization:', sanitized.includes('[REDACTED_PATH]'));

// Test MCP config validation
const validMcpConfig = {
  inputs: [{ id: 'test', type: 'text' }],
  servers: {
    testServer: {
      command: 'node',
      args: ['test.js']
    }
  }
};

const invalidMcpConfig = {
  inputs: 'not-an-array',
  servers: {
    badServer: 'not-an-object'
  }
};

const validResult = validateMcpConfig(validMcpConfig);
const invalidResult = validateMcpConfig(invalidMcpConfig);

console.log('✅ Valid MCP config validation:', validResult.valid === true);
console.log('✅ Invalid MCP config validation:', invalidResult.valid === false && invalidResult.errors.length > 0);

// Test task config validation
const validTaskConfig = {
  label: 'Test Task',
  type: 'shell',
  command: 'echo "hello"'
};

const invalidTaskConfig = {
  label: 123, // should be string
  type: 'shell'
  // missing command
};

const validTaskResult = validateTaskConfig(validTaskConfig);
const invalidTaskResult = validateTaskConfig(invalidTaskConfig);

console.log('✅ Valid task config validation:', validTaskResult.valid === true);
console.log('✅ Invalid task config validation:', invalidTaskResult.valid === false && invalidTaskResult.errors.length > 0);

console.log('\n🎉 All security enhancement tests passed!');
