#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Demonstration of the relative path fix
 * Shows before/after behavior of catalog path resolution
 */

import * as path from 'path';

console.log('=== Demonstration: Relative Catalog Path Resolution Fix ===\n');

// Mock workspace configuration
const mockWorkspaceFolders = [
  { name: 'main-project', uri: { fsPath: '/home/user/main-project' } },
  { name: 'shared-resources', uri: { fsPath: '/home/user/shared-resources' } }
];

// Test cases that would fail before the fix
const testCases = [
  {
    name: 'Workspace folder token',
    catalogPath: '${workspaceFolder}/team-catalog',
    description: 'Uses ${workspaceFolder} token to reference main workspace'
  },
  {
    name: 'Named workspace folder token', 
    catalogPath: '${workspaceFolder:shared-resources}/global-catalog',
    description: 'Uses ${workspaceFolder:name} token to reference specific workspace'
  },
  {
    name: 'Simple relative path',
    catalogPath: 'resources/catalog',
    description: 'Basic relative path from workspace root'
  },
  {
    name: 'Absolute path',
    catalogPath: '/absolute/path/to/catalog',
    description: 'Absolute path should be preserved unchanged'
  }
];

// Old implementation (simplified)
function oldResolveLogic(catalogPath: string): string {
  if (path.isAbsolute(catalogPath)) {
    return catalogPath;
  } else {
    // Only handled basic relative paths, no token expansion
    const workspaceFolder = mockWorkspaceFolders[0];
    return path.join(workspaceFolder.uri.fsPath, catalogPath);
  }
}

// New implementation using resolveWorkspacePath
function newResolveLogic(catalogPath: string): string {
  if(!catalogPath) return catalogPath;
  let out = catalogPath;
  const folders = mockWorkspaceFolders;
  
  // ${workspaceFolder}
  if(out.includes('${workspaceFolder}')){
    const base = folders[0]?.uri.fsPath;
    if(base){ out = out.replace(/\$\{workspaceFolder\}/g, base); }
  }
  
  // ${workspaceFolder:name}
  out = out.replace(/\$\{workspaceFolder:([^}]+)\}/g, (_m, name) => {
    const f = folders.find(f => f.name === name || f.uri.fsPath.endsWith('/'+name) || f.uri.fsPath.endsWith('\\'+name));
    return f ? f.uri.fsPath : (folders[0]?.uri.fsPath || _m);
  });
  
  // Make absolute if still relative
  if(!path.isAbsolute(out) && folders[0]){ 
    out = path.resolve(folders[0].uri.fsPath, out); 
  }
  return out;
}

console.log('Test Cases:\n');

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   Input: "${testCase.catalogPath}"`);
  console.log(`   Description: ${testCase.description}`);
  
  try {
    const oldResult = oldResolveLogic(testCase.catalogPath);
    console.log(`   OLD: "${oldResult}"`);
  } catch (error) {
    console.log(`   OLD: ❌ ERROR - ${error}`);
  }
  
  try {
    const newResult = newResolveLogic(testCase.catalogPath);
    console.log(`   NEW: "${newResult}"`);
  } catch (error) {
    console.log(`   NEW: ❌ ERROR - ${error}`);
  }
  
  console.log('');
});

console.log('Summary:');
console.log('- OLD implementation only handled basic relative and absolute paths');
console.log('- NEW implementation supports ${workspaceFolder} and ${workspaceFolder:name} tokens');
console.log('- This enables more flexible catalog configuration in VS Code settings');
console.log('- Users can now reference catalogs in different workspace folders by name');
console.log('\nExample VS Code settings.json:');
console.log(JSON.stringify({
  "copilotCatalog.catalogDirectory": {
    "${workspaceFolder}/team-catalog": "Team Resources",
    "${workspaceFolder:shared-resources}/global-catalog": "Shared Assets",
    "local/resources": "Local Development"
  }
}, null, 2));