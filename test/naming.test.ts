// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { generateUserVariantFilename } from '../src/utils/naming';
import { createTestRunner, logTestSuccess } from './testUtils';

function assertEquals(actual: any, expected: any, label: string) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: Expected '${expected}', got '${actual}'`);
    process.exit(1);
  }
}

async function run() {
  const existing = new Set(['file.md', 'file.1.md']);
  const next = generateUserVariantFilename('file.md', existing);
  assertEquals(next, 'user.file.md', 'Next available filename');

  const fresh = generateUserVariantFilename('another.md', new Set());
  assertEquals(fresh, 'user.another.md', 'Fresh filename');
  
  const already = generateUserVariantFilename('user.existing.md', new Set(['user.existing.md']));
  assertEquals(already, 'user.0.user.existing.md', 'Already existing filename');
  
  logTestSuccess('naming');
}

createTestRunner('naming', run);
