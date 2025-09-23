// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as assert from 'assert';
import { suite, test } from 'mocha';
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

suite('Git Catalog Integration Tests', () => {
  const assertEquals = (actual: any, expected: any, message?: string) => {
    assert.deepStrictEqual(actual, expected, message);
  };

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
    assert.ok(true, 'Refresh completed');
  });

  test('should validate git availability', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    await service.init([], '/test/global');
    const available = await service.validateGitAvailable();
    assert.ok(available, 'Git should be available');
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
      assert.ok(error.message.includes('HTTPS'), 'Should mention HTTPS requirement');
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

  // New tests for branch listing, locked commit, and update detection
  
  test('should list remote branches', async () => {
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(async (cmd: string) => {
      if (cmd.startsWith('git --version')) return { stdout: 'git version 2.40.0', stderr: '' };
      if (cmd.startsWith('git ls-remote --heads')) {
        return { stdout: [
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\trefs/heads/main',
          'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\trefs/heads/feature/x',
          'cccccccccccccccccccccccccccccccccccccccc\trefs/heads/develop'
        ].join('\n'), stderr: '' };
      }
      if (cmd.startsWith('git clone')) return { stdout: '', stderr: '' };
      if (cmd.includes('rev-parse HEAD')) return { stdout: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n', stderr: '' };
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return { stdout: 'main\n', stderr: '' };
      if (cmd.includes(' fetch origin ')) return { stdout: '', stderr: '' };
      if (cmd.includes(' reset --hard ')) return { stdout: '', stderr: '' };
      return { stdout: '', stderr: '' };
    });
    await service.init([], '/test/global');
    const branches = await service.listRemoteBranches('https://github.com/test/repo.git');
    const names = branches.map(b => b.name).sort();
    const expected = ['develop', 'feature/x', 'main'];
    assert.deepStrictEqual(names, expected, 'Branch names should match');
  });
  
  test('should add remote locked to commit', async () => {
    const lockedSha = '1234567890abcdef1234567890abcdef12345678';
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(async (cmd: string) => {
      if (cmd.startsWith('git --version')) return { stdout: 'git version 2.40.0', stderr: '' };
      if (cmd.startsWith('git clone')) return { stdout: '', stderr: '' };
      if (cmd.includes(' fetch origin ')) return { stdout: '', stderr: '' };
      if (cmd.includes(' checkout ')) return { stdout: '', stderr: '' };
      if (cmd.includes('rev-parse HEAD')) return { stdout: lockedSha + '\n', stderr: '' };
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return { stdout: 'main\n', stderr: '' };
      return { stdout: '', stderr: '' };
    });
    await service.init([], '/test/global');
    await service.addRemoteInteractively('https://github.com/test/locked.git', 'main', lockedSha);
    const remotes = service.getRemotes();
    assert.strictEqual(remotes.length, 1, 'Expected exactly one remote');
    assert.strictEqual(remotes[0].lockedCommit, lockedSha, 'lockedCommit not set correctly');
    assert.strictEqual(remotes[0].lastCommit, lockedSha, 'lastCommit should equal locked commit after scan');
  });
  
  test('should detect branch update when remote head changes', async () => {
    const originalSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newSha = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const mockFileService = new MockFileService({});
    const service = new GitCatalogService(mockFileService);
    
    // First exec override for initial add (originalSha)
    service.setExecOverride(async (cmd: string) => {
      if (cmd.startsWith('git --version')) return { stdout: 'git version 2.40.0', stderr: '' };
      if (cmd.startsWith('git clone')) return { stdout: '', stderr: '' };
      if (cmd.includes(' fetch origin ')) return { stdout: '', stderr: '' };
      if (cmd.includes(' reset --hard ')) return { stdout: '', stderr: '' };
      if (cmd.includes('rev-parse HEAD')) return { stdout: originalSha + '\n', stderr: '' };
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return { stdout: 'main\n', stderr: '' };
      return { stdout: '', stderr: '' };
    });
    await service.init([], '/test/global');
    await service.addRemoteInteractively('https://github.com/test/update.git', 'main');
    
    // Swap override to simulate new remote head
    service.setExecOverride(async (cmd: string) => {
      if (cmd.startsWith('git --version')) return { stdout: 'git version 2.40.0', stderr: '' };
      if (cmd.startsWith('git ls-remote https://github.com/test/update.git main')) {
        return { stdout: `${newSha}\trefs/heads/main\n`, stderr: '' };
      }
      if (cmd.includes('rev-parse HEAD')) return { stdout: originalSha + '\n', stderr: '' };
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return { stdout: 'main\n', stderr: '' };
      return { stdout: '', stderr: '' };
    });
    
    const remote = service.getRemotes()[0];
    const info = await service.detectBranchUpdate(remote as any);
    assert.ok(info.hasUpdate, 'Expected hasUpdate=true');
    assert.strictEqual(info.remoteHead, newSha, 'remoteHead mismatch');
    assert.strictEqual(info.current, originalSha, 'current commit mismatch');
  });

  test('should prune unused remote when its catalogs are no longer active', async () => {
    const repo1Clone = '/test/global/git-remotes/repo1-main';
    const repo2Clone = '/test/global/git-remotes/repo2-main';
    const repo1Catalog = path.join(repo1Clone, 'catalogA');
    const repo2Catalog = path.join(repo2Clone, 'catalogB');

    const metaContent = JSON.stringify({
      version: 2,
      remotes: [
        {
          url: 'https://github.com/test/repo1.git',
          branch: 'main',
          clonePath: repo1Clone,
          lastCommit: 'abc',
          catalogs: [{ catalogPath: repo1Catalog, repoRelPath: 'catalogA', displayName: 'repo1' }]
        },
        {
          url: 'https://github.com/test/repo2.git',
          branch: 'main',
          clonePath: repo2Clone,
          lastCommit: 'def',
          catalogs: [{ catalogPath: repo2Catalog, repoRelPath: 'catalogB', displayName: 'repo2' }]
        }
      ]
    });

    const mockFileService = new MockFileService({
      '/test/global/git-remotes/meta.json': metaContent,
      [repo1Clone]: 'dir',
      [repo2Clone]: 'dir',
    });
    (mockFileService as any).deletedPaths = new Set();

    const service = new GitCatalogService(mockFileService);
    service.setExecOverride(makeExecOverride());
    await service.ensureLoaded('/test/global');

    assertEquals(service.getRemotes().length, 2, 'Should start with two remotes');

    // Prune, keeping only repo1's catalog active
    await service.pruneUnusedCatalogs([repo1Catalog]);

    const finalRemotes = service.getRemotes();
    assertEquals(finalRemotes.length, 1, 'Should have one remote after pruning');
    assertEquals(finalRemotes[0].url, 'https://github.com/test/repo1.git', 'Should keep repo1');

    const deleted = (mockFileService as any).deletedPaths;
    assert.ok(deleted.has(repo2Clone), 'Should have deleted the clone directory for repo2');
  });
});
