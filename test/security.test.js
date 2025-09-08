#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Security validation tests for enhanced security functions
const { sanitizeFilename, isSafeRelativeEntry, isValidHttpsUrl } = require('../dist/utils/security');

let hasErrors = false;

function assertEqual(actual, expected) {
  if (actual !== expected) {
    console.error(`❌ FAIL: Expected ${expected}, got ${actual}`);
    hasErrors = true;
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    hasErrors = true;
  }
}

console.log('Testing enhanced security functions...\n');

// Test sanitizeFilename enhancements
test('Should handle Unicode control characters', () => {
  const result = sanitizeFilename('file\u200B\u200C\u200D\uFEFF.txt');
  assertEqual(result, 'file.txt');
});

test('Should handle excessively long filenames', () => {
  const longName = 'a'.repeat(300) + '.txt';
  const result = sanitizeFilename(longName);
  assertEqual(result.length <= 204, true); // 200 + '.txt'
});

test('Should handle control characters in filenames', () => {
  const result = sanitizeFilename('file\x00\x01\x1F.txt');
  assertEqual(result, 'file.txt');
});

// Test isSafeRelativeEntry enhancements
test('Should reject encoded path traversal', () => {
  assertEqual(isSafeRelativeEntry('dir/%2e%2e/file.txt'), false);
  assertEqual(isSafeRelativeEntry('dir/%2E%2E/file.txt'), false);
});

test('Should reject UNC paths', () => {
  assertEqual(isSafeRelativeEntry('\\\\server\\share\\file.txt'), false);
  assertEqual(isSafeRelativeEntry('//server/share/file.txt'), false);
});

test('Should reject entries with control characters', () => {
  assertEqual(isSafeRelativeEntry('file\x00.txt'), false);
  assertEqual(isSafeRelativeEntry('file\x1F.txt'), false);
});

test('Should reject excessively long entries', () => {
  const longEntry = 'a'.repeat(1001);
  assertEqual(isSafeRelativeEntry(longEntry), false);
});

test('Should accept valid relative entries', () => {
  assertEqual(isSafeRelativeEntry('folder/file.txt'), true);
  assertEqual(isSafeRelativeEntry('file.txt'), true);
});

// Test isValidHttpsUrl function
test('Should reject HTTP URLs', () => {
  assertEqual(isValidHttpsUrl('http://example.com'), false);
});

test('Should reject localhost URLs', () => {
  assertEqual(isValidHttpsUrl('https://localhost/path'), false);
  assertEqual(isValidHttpsUrl('https://127.0.0.1/path'), false);
});

test('Should reject private IP ranges', () => {
  assertEqual(isValidHttpsUrl('https://192.168.1.1/path'), false);
  assertEqual(isValidHttpsUrl('https://10.0.0.1/path'), false);
  assertEqual(isValidHttpsUrl('https://172.16.0.1/path'), false);
});

test('Should accept valid HTTPS URLs', () => {
  assertEqual(isValidHttpsUrl('https://example.com/path'), true);
  assertEqual(isValidHttpsUrl('https://api.github.com/repos'), true);
});

test('Should reject invalid URLs', () => {
  assertEqual(isValidHttpsUrl('not-a-url'), false);
  assertEqual(isValidHttpsUrl(''), false);
  assertEqual(isValidHttpsUrl(null), false);
});

test('Should reject excessively long URLs', () => {
  const longUrl = 'https://example.com/' + 'a'.repeat(2000);
  assertEqual(isValidHttpsUrl(longUrl), false);
});

console.log('\nSecurity Enhancement Results:');
if (hasErrors) {
  console.log('❌ Some security tests failed!');
  process.exit(1);
} else {
  console.log('✅ All security enhancement tests passed!');
  console.log('🔒 Enhanced security validation is working correctly!');
}
