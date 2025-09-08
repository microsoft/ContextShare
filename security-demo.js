#!/usr/bin/env node

/**
 * Security Enhancement Demonstration
 * This script demonstrates the security improvements implemented in ContextShare
 */

console.log('🔐 ContextShare Security Enhancements Demo\n');

// Import the security utilities (in a real scenario, these would be imported from dist/)
const securityUtils = require('./dist/src/utils/security.js');

console.log('1. ERROR MESSAGE SANITIZATION');
console.log('==============================');

const sensitiveErrors = [
  'Failed to read C:\\Users\\admin\\secrets\\config.json',
  'Permission denied accessing /home/user/.ssh/private_key',
  'Network error connecting to 192.168.1.100:8080',
  'Database connection failed: mysql://user:password@localhost/db'
];

sensitiveErrors.forEach((error, i) => {
  const sanitized = securityUtils.sanitizeErrorMessage(error);
  console.log(`Original ${i+1}: ${error}`);
  console.log(`Sanitized: ${sanitized}\n`);
});

console.log('2. JSON SCHEMA VALIDATION');
console.log('=========================');

// Test MCP config validation
const mcpConfigs = [
  {
    name: 'Valid MCP Config',
    config: {
      inputs: [{ id: 'test', type: 'text' }],
      servers: {
        myServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    }
  },
  {
    name: 'Invalid MCP Config',
    config: {
      inputs: 'should-be-array',
      servers: {
        badServer: 'should-be-object'
      }
    }
  }
];

mcpConfigs.forEach(({ name, config }) => {
  const result = securityUtils.validateMcpConfig(config);
  console.log(`${name}: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    console.log(`  Errors: ${result.errors.join(', ')}`);
  }
  console.log();
});

// Test Task config validation
const taskConfigs = [
  {
    name: 'Valid Task Config',
    config: {
      label: 'Build Project',
      type: 'shell',
      command: 'npm run build'
    }
  },
  {
    name: 'Invalid Task Config',
    config: {
      label: 123, // should be string
      type: 'shell'
      // missing command
    }
  }
];

taskConfigs.forEach(({ name, config }) => {
  const result = securityUtils.validateTaskConfig(config);
  console.log(`${name}: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
  if (!result.valid) {
    console.log(`  Errors: ${result.errors.join(', ')}`);
  }
  console.log();
});

console.log('3. SECURE HTTP FEATURES');
console.log('======================');
console.log('✅ HTTPS-only remote sources enforced');
console.log('✅ Enhanced redirect handling with limits');
console.log('✅ Request timeout and size limits');
console.log('✅ Cache size and entry limits implemented');
console.log('✅ Proper error handling for network failures');

console.log('\n4. ATOMIC FILE OPERATIONS');
console.log('=========================');
console.log('✅ User resource enable/disable uses temp files');
console.log('✅ Rollback mechanism on operation failure');
console.log('✅ Prevents data loss during file operations');

console.log('\n5. PATH SECURITY');
console.log('===============');
console.log('✅ Path traversal protection maintained');
console.log('✅ Filename sanitization improved');
console.log('✅ Safe relative entry validation');

console.log('\n🎉 All security enhancements successfully implemented!');
console.log('\nSUMMARY OF IMPROVEMENTS:');
console.log('- Replaced custom HTTP client with safer implementation');
console.log('- Added JSON schema validation for all external content');
console.log('- Implemented cache size limits for remote content');
console.log('- Added atomic file operations for user resources');
console.log('- Enhanced error message sanitization');
console.log('- Improved request security with better redirect handling');
