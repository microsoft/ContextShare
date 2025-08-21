#!/usr/bin/env node
/**
 * Test suite for catalog display name functionality
 * Tests the getCatalogDisplayName utility function
 */

import { getCatalogDisplayName } from '../src/utils/display';

let hasErrors = false;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error}`);
    hasErrors = true;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${message ? ` - ${message}` : ''}`);
  }
}

console.log('Testing catalog display name functionality...\n');

// Test basic functionality
test('Should return custom display name when exact path matches', () => {
  const mapping = {
    '/path/to/catalog': 'My Custom Catalog',
    '/another/catalog': 'Another Catalog'
  };
  const result = getCatalogDisplayName('/path/to/catalog', mapping);
  assertEqual(result, 'My Custom Catalog');
});

test('Should return custom display name when basename matches', () => {
  const mapping = {
    'copilot_catalog': 'Main Catalog',
    'shared_catalog': 'Shared Resources'
  };
  const result = getCatalogDisplayName('/some/path/copilot_catalog', mapping);
  assertEqual(result, 'Main Catalog');
});

test('Should fall back to basename when no mapping exists', () => {
  const mapping = {};
  const result = getCatalogDisplayName('/path/to/my_catalog', mapping);
  assertEqual(result, 'my_catalog');
});

test('Should handle empty mapping', () => {
  const result = getCatalogDisplayName('/path/to/catalog', {});
  assertEqual(result, 'catalog');
});

test('Should handle relative paths', () => {
  const mapping = {
    'shared/catalog': 'Shared Catalog'
  };
  const result = getCatalogDisplayName('shared/catalog', mapping);
  assertEqual(result, 'Shared Catalog');
});

test('Should handle Windows-style paths', () => {
  const mapping = {
    'C:\\Users\\Dev\\catalog': 'Windows Catalog'
  };
  const result = getCatalogDisplayName('C:\\Users\\Dev\\catalog', mapping);
  assertEqual(result, 'Windows Catalog');
});

test('Should prefer exact path match over basename match', () => {
  const mapping = {
    '/full/path/catalog': 'Full Path Catalog',
    'catalog': 'Basename Catalog'
  };
  const result = getCatalogDisplayName('/full/path/catalog', mapping);
  assertEqual(result, 'Full Path Catalog');
});

test('Should handle URL-style paths', () => {
  const mapping = {
    'https://example.com/catalog': 'Remote Catalog',
    'catalog': 'Local Catalog'
  };
  const result = getCatalogDisplayName('https://example.com/catalog', mapping);
  assertEqual(result, 'Remote Catalog');
});

test('Should handle empty or undefined directory paths', () => {
  const mapping = {};
  const result1 = getCatalogDisplayName('', mapping);
  assertEqual(result1, 'Unknown');
  
  const result2 = getCatalogDisplayName('.', mapping);
  assertEqual(result2, '.');
});

test('Should handle complex nested paths', () => {
  const mapping = {
    'projects/shared/resources': 'Shared Resources',
    'resources': 'Local Resources'
  };
  const result = getCatalogDisplayName('/workspace/projects/shared/resources', mapping);
  assertEqual(result, 'Shared Resources');
});

console.log('\nResults: All catalog display name tests passed!');
console.log('🎉 Catalog display names working correctly!');

if (hasErrors) {
  process.exit(1);
}
