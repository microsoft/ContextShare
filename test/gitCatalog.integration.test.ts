// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as path from 'path';
import { GitCatalogService, RemoteGitSpec } from '../src/services/gitCatalogService';
import { MockFileService } from './fileService.mock';

// Helper to build a deterministic git exec override
function makeExecOverride(extra?: Record<string, { stdout?: string; stderr?: string }>) {
  return async (cmd: string): Promise<{ stdout: string; stderr: string }> => {
    if (cmd.startsWith('git --version')) {
      return { stdout: 'git version 2.30.0', stderr: '' };
    }
    if (cmd.startsWith('git clone')) {
      return { stdout: '', stderr: '' };
    }
    if (cmd.includes(' fetch origin ')) {
      return { stdout: '', stderr: '' };
    }
    if (cmd.includes(' reset --hard ')) {
      return { stdout: '', stderr: '' };
    }
    if (cmd.includes('config --get remote.origin.url')) {
      if (cmd.includes('repo1-main')) return { stdout: 'https://github.com/test/repo1.git\n', stderr: '' };
      if (cmd.includes('repo2-main')) return { stdout: 'https://github.com/test/repo2.git\n', stderr: '' };
      return { stdout: 'https://github.com/test/repo.git\n', stderr: '' };
    }
    if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
      return { stdout: 'main\n', stderr: '' };
    }
    if (cmd.includes('rev-parse HEAD')) {
      return { stdout: 'abcdef1234567890\n', stderr: '' };
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (cmd.includes(k)) {
          return { stdout: v.stdout ?? '', stderr: v.stderr ?? '' };
        }
      }
    }
    return { stdout: '', stderr: '' };
  };
}

// Simple test runner
async function runTests() {
  console.log('\n🧪 Git Catalog Integration Tests\n');
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => Promise<void>) {
    tests.push({ name, fn });
  }

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  function assertEquals(actual: any, expected: any, message?: string) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(`${message || 'Values not equal'}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
    }
  }

  // Tests

  test('should initialize with empty remotes', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    await service.init([], '/test/global');
    const remotes = service.getRemotes();
    assertEquals(remotes.length, 0, 'Should have no remotes initially');
  });

  test('should add a remote repository', async () => {
    const mockFileService = new MockFileService({
      '/test/global/git-remotes/meta.json': JSON.stringify({
        version: 1,
        remotes: []
      })
    });
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    await service.init([], '/test/global');

    const url = 'https://github.com/test/repo.git';
    const branch = 'main';

    await service.addRemoteInteractively(url, branch);
    const remotes = service.getRemotes();
    assertEquals(remotes.length, 1, 'Should have one remote');
    assertEquals(remotes[0].url, url, 'URL should match');
    assertEquals(remotes[0].branch, branch, 'Branch should match');
  });

  test('should get catalog directory map', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    const specs: RemoteGitSpec[] = [];
    await service.init(specs, '/test/global');
    const catalogMap = service.getCatalogDirectoryMap();
    assertEquals(Object.keys(catalogMap).length, 0, 'Should have empty catalog map initially');
  });

  test('should save and load remote configuration', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    const specs: RemoteGitSpec[] = [
      { url: 'https://github.com/test/repo1.git', branch: 'main' },
      { url: 'https://github.com/test/repo2.git', branch: 'develop', disabled: true }
    ];
    await service.init(specs, '/test/global');
    const remotes = service.getRemotes();
    assertEquals(remotes.length, 1, 'Should load only enabled remotes');
    assertEquals(remotes[0].url, specs[0].url, 'URL should match');
    assertEquals(remotes[0].branch, specs[0].branch, 'Branch should match');
  });

  test('should remove a remote repository', async () => {
    const mockFileService = new MockFileService({
      '/test/global/git-remotes/meta.json': JSON.stringify({ version: 1, remotes: [] })
    });
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    await service.init([], '/test/global');

    const url = 'https://github.com/test/repo.git';
    await service.addRemoteInteractively(url, 'main');
    assertEquals(service.getRemotes().length, 1, 'Should have one remote');

    await service.removeRemote(url);
    assertEquals(service.getRemotes().length, 0, 'Should have no remotes after removal');
  });

  test('should refresh all remotes', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    const specs: RemoteGitSpec[] = [{ url: 'https://github.com/test/repo.git', branch: 'main' }];
    await service.init(specs, '/test/global');
    await service.refreshAll(); // Should not throw
    assert(true, 'Refresh completed');
  });

  test('should validate git availability', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    await service.init([], '/test/global');
    const available = await service.validateGitAvailable();
    assert(available, 'Git should be available');
  });

  test('should handle non-HTTPS URLs', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    await service.init([], '/test/global');
    try {
      await service.addRemoteInteractively('git@github.com:user/repo.git', 'main');
      throw new Error('Should have rejected non-HTTPS URL');
    } catch (error: any) {
      assert(error.message.includes('HTTPS'), 'Should mention HTTPS requirement');
    }
  });

  test('should recover missing remote clone directories not in meta.json', async () => {
    const repo1Clone = '/test/global/git-remotes/repo1-main';
    const repo2Clone = '/test/global/git-remotes/repo2-main';
    const metaContent = JSON.stringify({
      version: 1,
      remotes: [
        {
          url: 'https://github.com/test/repo1.git',
            branch: 'main',
            clonePath: repo1Clone,
            lastUpdated: new Date().toISOString(),
            specsHash: 'abc123',
            catalogs: []
        }
      ]
    }, null, 2);

    const mockFileService = new MockFileService({
      '/test/global/git-remotes/meta.json': metaContent,
      [path.join(repo1Clone, '.git', 'HEAD')]: 'ref: refs/heads/main',
      [path.join(repo2Clone, '.git', 'HEAD')]: 'ref: refs/heads/main'
    });

    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());

    const count = await service.ensureLoaded('/test/global');
    assertEquals(count, 2, 'Service should recover second remote from filesystem');
    const remotes = service.getRemotes();
    const urls = remotes.map(r => r.url).sort();
    assertEquals(urls, ['https://github.com/test/repo1.git', 'https://github.com/test/repo2.git'], 'Recovered remote URLs mismatch');
  });

  // Run all tests
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error: any) {
      console.log(`❌ ${name}`);
      console.log(`   ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Tests: ${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
