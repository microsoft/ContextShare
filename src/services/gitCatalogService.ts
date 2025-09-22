// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec, ExecException } from 'child_process';
import { promisify } from 'util';
import { IFileService, ResourceCategory } from '../models';
import { sanitizeErrorMessage } from '../utils/security';
import { getErrorMessage } from '../utils/errors';

const execAsync = promisify(exec);

// Configuration for a remote git repository
export interface RemoteGitSpec {
  url: string;                 // HTTPS or SSH URL (HTTPS preferred for MVP)
  branch?: string;            // default 'main'
  includePaths?: string[];    // optional relative paths to constrain scan
  displayNamePrefix?: string; // optional UI prefix
  depth?: number;            // optional shallow depth default 1
  disabled?: boolean;        // optional flag to disable without removing
}

// Metadata about a discovered catalog within a remote
interface CatalogCandidate {
  catalogPath: string;      // absolute path to catalog root
  repoRelPath: string;      // path relative to repo root
  displayName: string;      // generated display name
}

// Persisted metadata about remote repositories
interface RemoteMeta {
  url: string;
  branch: string;
  clonePath: string;
  lastUpdated: string;
  lastCommit?: string;
  specsHash: string;
  catalogs: CatalogCandidate[];
  includePaths?: string[];
  displayNamePrefix?: string;
}

interface GitCatalogMeta {
  version: number;
  remotes: RemoteMeta[];
}

const CATEGORY_DIRS: Record<ResourceCategory, string> = {
  chatmodes: 'chatmodes',
  instructions: 'instructions', 
  prompts: 'prompts',
  tasks: 'tasks',
  mcp: 'mcp'
};

export class GitCatalogService {
  private remotes: RemoteMeta[] = [];
  private globalStoragePath: string = '';
  private gitAvailable: boolean | undefined;
  private logger?: (msg: string) => void;
  private fileService: IFileService;
  private execOverride?: (cmd: string) => Promise<{ stdout: string; stderr: string }>;

  constructor(fileService: IFileService) {
    this.fileService = fileService;
  }

  // Test hook to override git execution
  setExecOverride(fn?: (cmd: string) => Promise<{ stdout: string; stderr: string }>) {
    this.execOverride = fn;
    this.gitAvailable = undefined; // force re-check
  }

  private async runGit(cmd: string): Promise<{ stdout: string; stderr: string }> {
    if (this.execOverride) {
      return this.execOverride(cmd);
    }
    return execAsync(cmd);
  }

  setLogger(fn?: (msg: string) => void) { 
    this.logger = fn; 
  }

  private log(msg: string) {
    try {
      const sanitized = sanitizeErrorMessage(msg);
      this.logger?.(`[GitCatalog] ${sanitized}`);
    } catch {
      // Fail silently if logger fails
    }
  }

  async init(specs: RemoteGitSpec[], globalStoragePath: string): Promise<void> {
    this.globalStoragePath = globalStoragePath;
    this.log(`init with ${specs.length} remote specs`);
    
    // Ensure git-remotes directory exists
    const remotesDir = path.join(globalStoragePath, 'git-remotes');
    await this.fileService.ensureDirectory(remotesDir);
    
    // Load existing meta
    const metaPath = path.join(globalStoragePath, 'git-remotes', 'meta.json');
    const existingMeta = await this.loadMeta(metaPath);
    
    if (specs.length === 0) {
      // No new specs provided: just load existing remotes without wiping them
      this.remotes = existingMeta.remotes;
      this.log(`init loaded ${this.remotes.length} existing remotes (no new specs provided)`);
    } else {
      // Update remotes based on provided specs
      this.remotes = await this.reconcileRemotes(specs, existingMeta.remotes, remotesDir);
      this.log(`init reconciled remotes to ${this.remotes.length} entries from specs`);
    }
    
    // Persist current state
    await this.saveMeta(metaPath);
  }

  // Ensure existing remotes are loaded without requiring spec reconciliation.
  async ensureLoaded(globalStoragePath: string): Promise<number> {
    if (!this.globalStoragePath) {
      this.globalStoragePath = globalStoragePath;
    }
    const remotesDir = path.join(this.globalStoragePath, 'git-remotes');
    await this.fileService.ensureDirectory(remotesDir);
    
    if (this.remotes.length === 0) {
      const metaPath = path.join(this.globalStoragePath, 'git-remotes', 'meta.json');
      const meta = await this.loadMeta(metaPath);
      this.remotes = meta.remotes;
      this.log(`ensureLoaded loaded ${this.remotes.length} remotes from meta.json`);
      
      // Recovery: detect clone directories that are not represented in meta.json
      try {
        const entries = await this.fileService.listDirectory(remotesDir);
        for (const entry of entries) {
          const full = path.join(remotesDir, entry);
          const gitDir = path.join(full, '.git');
          const normFull = path.resolve(full);
          const alreadyTracked = this.remotes.some(r => path.resolve(r.clonePath) === normFull);
          if (alreadyTracked) continue;
          if (!(await this.fileService.pathExists(gitDir))) continue;
          
            // Attempt to recover origin URL & current branch via git commands
          let originUrl: string | undefined;
          let branch: string = 'main';
          try {
            if (await this.validateGitAvailable()) {
              const { stdout: urlStdout } = await this.runGit(`git -C "${full}" config --get remote.origin.url`);
              originUrl = urlStdout.trim() || undefined;
              const { stdout: brStdout } = await this.runGit(`git -C "${full}" rev-parse --abbrev-ref HEAD`);
              const br = brStdout.trim();
              if (br && br !== 'HEAD') branch = br;
            }
          } catch (e) {
            this.log(`ensureLoaded recovery: git probe failed for ${entry}: ${getErrorMessage(e)}`);
          }
          
          if (!originUrl) {
            // Fallback: derive pseudo URL from directory name (best-effort)
            originUrl = `recovered://${entry}`;
          }
          
          const spec: RemoteGitSpec = { url: originUrl, branch };
          const recovered: RemoteMeta = {
            url: originUrl,
            branch,
            clonePath: full,
            lastUpdated: new Date().toISOString(),
            lastCommit: undefined,
            specsHash: this.hashSpec(spec),
            catalogs: [],
          };
          this.remotes.push(recovered);
          this.log(`ensureLoaded recovery: added missing remote clonePath=${full} url=${originUrl} branch=${branch}`);
        }
        
        if (this.remotes.length !== meta.remotes.length) {
          await this.saveMeta(path.join(this.globalStoragePath, 'git-remotes', 'meta.json'));
          this.log(`ensureLoaded recovery: meta.json updated with ${this.remotes.length} remotes`);
        }
      } catch (e) {
        this.log(`ensureLoaded recovery scan failed: ${getErrorMessage(e)}`);
      }
    } else {
      this.log(`ensureLoaded skipped (already have ${this.remotes.length} remotes)`);
    }
    return this.remotes.length;
  }

  private async loadMeta(metaPath: string): Promise<GitCatalogMeta> {
    try {
      const raw = await this.fileService.readFile(metaPath);
      const meta = JSON.parse(raw);
      if (meta.version === 1 && Array.isArray(meta.remotes)) {
        return meta;
      }
    } catch {
      // File doesn't exist or invalid
    }
    return { version: 1, remotes: [] };
  }

  private async saveMeta(metaPath: string): Promise<void> {
    const meta: GitCatalogMeta = {
      version: 1,
      remotes: this.remotes
    };
    await this.fileService.writeFile(metaPath, JSON.stringify(meta, null, 2));
    this.log(`Saved meta with ${this.remotes.length} remotes`);
  }

  private async reconcileRemotes(
    specs: RemoteGitSpec[], 
    existing: RemoteMeta[], 
    remotesDir: string
  ): Promise<RemoteMeta[]> {
    const result: RemoteMeta[] = [];
    
    for (const spec of specs) {
      if (spec.disabled) {
        this.log(`Skipping disabled remote: ${spec.url}`);
        continue;
      }
      
      const branch = spec.branch || 'main';
      const specsHash = this.hashSpec(spec);
      
      // Check if we already have this remote
      const existingRemote = existing.find(r => 
        r.url === spec.url && r.branch === branch
      );
      
      if (existingRemote && existingRemote.specsHash === specsHash) {
        // No changes, keep existing
        result.push(existingRemote);
        this.log(`Remote unchanged: ${spec.url}@${branch}`);
      } else {
        // New or changed remote
        const clonePath = path.join(remotesDir, this.slugify(`${spec.url}_${branch}`));
        
        const remote: RemoteMeta = {
          url: spec.url,
          branch,
          clonePath,
          lastUpdated: new Date().toISOString(),
          specsHash,
          catalogs: existingRemote?.catalogs || [],
          includePaths: spec.includePaths,
          displayNamePrefix: spec.displayNamePrefix
        };
        
        result.push(remote);
        this.log(`Remote configured: ${spec.url}@${branch}`);
      }
    }
    
    return result;
  }

  async ensureAllCloned(): Promise<void> {
    this.log(`ensureAllCloned: Processing ${this.remotes.length} remotes`);
    
    // Check git availability first
    if (!await this.validateGitAvailable()) {
      this.log('Git not available, skipping remote clones');
      return;
    }
    
    // Process remotes with bounded concurrency (max 2 at a time)
    const concurrencyLimit = 2;
    const queue = [...this.remotes];
    const active: Promise<void>[] = [];
    
    while (queue.length > 0 || active.length > 0) {
      // Start new clones up to limit
      while (active.length < concurrencyLimit && queue.length > 0) {
        const remote = queue.shift()!;
        const promise = this.ensureRemoteCloned(remote)
          .then(() => {
            const index = active.indexOf(promise);
            if (index > -1) active.splice(index, 1);
          })
          .catch(err => {
            this.log(`Failed to clone ${remote.url}: ${getErrorMessage(err)}`);
            const index = active.indexOf(promise);
            if (index > -1) active.splice(index, 1);
          });
        active.push(promise);
      }
      
      // Wait for at least one to complete
      if (active.length > 0) {
        await Promise.race(active);
      }
    }
    
    // Save meta with updated info
    const metaPath = path.join(this.globalStoragePath, 'git-remotes', 'meta.json');
    await this.saveMeta(metaPath);
  }

  private async ensureRemoteCloned(remote: RemoteMeta): Promise<void> {
    const exists = await this.fileService.pathExists(remote.clonePath);
    
    if (!exists) {
      // Clone repository
      this.log(`Cloning ${remote.url}@${remote.branch} to ${remote.clonePath}`);
      const depth = 1; // Shallow clone by default
      const cmd = `git clone --depth=${depth} --branch ${remote.branch} ${remote.url} "${remote.clonePath}"`;
      
      try {
        await this.runGit(cmd);
        this.log(`Clone successful: ${remote.url}`);
      } catch (err) {
        throw new Error(`Git clone failed: ${sanitizeErrorMessage(err)}`);
      }
    } else {
      // Update existing clone
      this.log(`Updating ${remote.url}@${remote.branch}`);
      try {
        await this.runGit(`git -C "${remote.clonePath}" fetch origin ${remote.branch} --depth=1`);
        await this.runGit(`git -C "${remote.clonePath}" reset --hard origin/${remote.branch}`);
        this.log(`Update successful: ${remote.url}`);
      } catch (err) {
        this.log(`Update failed (will continue): ${getErrorMessage(err)}`);
      }
    }
    
    // Get current commit
    try {
      const { stdout } = await this.runGit(`git -C "${remote.clonePath}" rev-parse HEAD`);
      const currentCommit = stdout.trim();
      
      // Rescan if commit changed or first scan
      if (currentCommit !== remote.lastCommit || remote.catalogs.length === 0) {
        this.log(`Scanning for catalogs (commit: ${currentCommit.substring(0, 8)})`);
        remote.lastCommit = currentCommit;
        remote.catalogs = await this.discoverCatalogRoots(
          remote.clonePath,
          remote.includePaths,
          remote.url,
          remote.branch,
          remote.displayNamePrefix
        );
        remote.lastUpdated = new Date().toISOString();
        this.log(`Found ${remote.catalogs.length} catalog(s) in ${remote.url}`);
      }
    } catch (err) {
      this.log(`Failed to get commit hash: ${getErrorMessage(err)}`);
    }
  }

  private async discoverCatalogRoots(
    clonePath: string,
    includePaths?: string[],
    repoUrl?: string,
    branch?: string,
    displayNamePrefix?: string
  ): Promise<CatalogCandidate[]> {
    const candidates: CatalogCandidate[] = [];
    const repoName = this.getRepoName(repoUrl || clonePath);
    const branchName = branch || 'main';
    
    // If includePaths specified, only scan those
    const pathsToScan = includePaths?.map(p => path.join(clonePath, p)) || [clonePath];
    
    for (const scanPath of pathsToScan) {
      if (!await this.fileService.pathExists(scanPath)) {
        this.log(`Include path does not exist: ${scanPath}`);
        continue;
      }
      
      // Recursively scan for catalog roots
      const found = await this.scanForCatalogRoots(scanPath, clonePath);
      
      for (const catalogPath of found) {
        const repoRelPath = path.relative(clonePath, catalogPath).replace(/\\/g, '/');
        const displayName = this.generateDisplayName(
          displayNamePrefix || repoName,
          branchName,
          repoRelPath
        );
        
        candidates.push({
          catalogPath,
          repoRelPath,
          displayName
        });
      }
    }
    
    // Deduplicate nested catalogs
    return this.deduplicateCatalogs(candidates);
  }

  private async scanForCatalogRoots(dir: string, repoRoot: string, depth: number = 0): Promise<string[]> {
    const results: string[] = [];
    
    // Limit recursion depth to avoid excessive scanning
    if (depth > 10) return results;
    
    try {
      const entries = await this.fileService.listDirectory(dir);
      
      // Check if current dir is a catalog root
      if (await this.isCatalogRoot(dir, entries)) {
        results.push(dir);
        // Don't scan subdirectories if we found a catalog here
        return results;
      }
      
      // Recursively scan subdirectories
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = await this.fileService.stat(fullPath);
        
        if (stat === 'dir' && !entry.startsWith('.') && entry !== 'node_modules') {
          const subResults = await this.scanForCatalogRoots(fullPath, repoRoot, depth + 1);
          results.push(...subResults);
        }
      }
    } catch (err) {
      this.log(`Error scanning ${dir}: ${getErrorMessage(err)}`);
    }
    
    return results;
  }

  private async isCatalogRoot(dir: string, entries: string[]): Promise<boolean> {
    const dirName = path.basename(dir);
    
    // Rule A: Directory named 'copilot_catalog'
    if (dirName === 'copilot_catalog') {
      this.log(`Found catalog by name: ${dir}`);
      return true;
    }
    
    // Rule B: Contains category subdirectories with resources
    const categoryDirs = Object.values(CATEGORY_DIRS);
    const presentCategories = entries.filter(e => categoryDirs.includes(e));
    
    if (presentCategories.length >= 1) {
      // Verify at least one category has actual resource files
      for (const catDir of presentCategories) {
        const catPath = path.join(dir, catDir);
        const stat = await this.fileService.stat(catPath);
        
        if (stat === 'dir') {
          try {
            const files = await this.fileService.listDirectory(catPath);
            const resourceFiles = files.filter(f => 
              f.endsWith('.md') || 
              f.endsWith('.json') || 
              f.includes('.chatmode.') ||
              f.includes('.instructions.') ||
              f.includes('.prompt.') ||
              f.includes('.task.') ||
              f.includes('.mcp.')
            );
            
            if (resourceFiles.length > 0) {
              this.log(`Found catalog by structure: ${dir}`);
              return true;
            }
          } catch {
            // Category dir not accessible
          }
        }
      }
    }
    
    return false;
  }

  private deduplicateCatalogs(candidates: CatalogCandidate[]): CatalogCandidate[] {
    // Remove nested duplicates - if one catalog is inside another, keep the innermost
    const filtered: CatalogCandidate[] = [];
    
    for (const candidate of candidates) {
      let isNested = false;
      
      for (const other of candidates) {
        if (candidate === other) continue;
        
        // Check if candidate is nested inside other
        if (candidate.catalogPath.startsWith(other.catalogPath + path.sep)) {
          // Keep the innermost (candidate) not the outer
          const index = filtered.findIndex(f => f.catalogPath === other.catalogPath);
          if (index >= 0) {
            filtered.splice(index, 1);
          }
        }
      }
      
      // Add if not already present
      if (!filtered.some(f => f.catalogPath === candidate.catalogPath)) {
        filtered.push(candidate);
      }
    }
    
    return filtered;
  }

  getCatalogDirectoryMap(): Record<string, string> {
    const map: Record<string, string> = {};
    
    for (const remote of this.remotes) {
      for (const catalog of remote.catalogs) {
        map[catalog.catalogPath] = catalog.displayName;
      }
    }
    
    return map;
  }

  async addRemoteInteractively(
    url: string,
    branch: string = 'main',
    includePaths?: string[],
    displayNamePrefix?: string
  ): Promise<void> {
    this.log(`Adding remote interactively: ${url}@${branch}`);
    
    // Validate git availability
    if (!await this.validateGitAvailable()) {
      throw new Error('Git is not installed or not available in PATH');
    }
    
    // Validate URL (HTTPS only for MVP)
    if (!url.startsWith('https://')) {
      throw new Error('Only HTTPS URLs are supported in this version');
    }
    
    const spec: RemoteGitSpec = {
      url,
      branch,
      includePaths,
      displayNamePrefix,
      depth: 1
    };
    
    // Add to remotes
    const remotesDir = path.join(this.globalStoragePath, 'git-remotes');
    await this.fileService.ensureDirectory(remotesDir);
    
    const clonePath = path.join(remotesDir, this.slugify(`${url}_${branch}`));
    const remote: RemoteMeta = {
      url,
      branch,
      clonePath,
      lastUpdated: new Date().toISOString(),
      specsHash: this.hashSpec(spec),
      catalogs: [],
      includePaths,
      displayNamePrefix
    };
    
    // Check if already exists
    const existing = this.remotes.findIndex(r => r.url === url && r.branch === branch);
    if (existing >= 0) {
      this.remotes[existing] = remote;
    } else {
      this.remotes.push(remote);
    }
    
    // Clone and scan
    await this.ensureRemoteCloned(remote);
    
    // Save meta
    const metaPath = path.join(this.globalStoragePath, 'git-remotes', 'meta.json');
    await this.saveMeta(metaPath);
    
    this.log(`Successfully added remote with ${remote.catalogs.length} catalog(s)`);
  }

  async removeRemote(url: string, branch?: string): Promise<void> {
    const index = this.remotes.findIndex(r => 
      r.url === url && (!branch || r.branch === branch)
    );
    
    if (index < 0) {
      throw new Error('Remote not found');
    }
    
    const remote = this.remotes[index];
    this.remotes.splice(index, 1);
    
    // Optionally delete clone directory
    try {
      const files = await this.fileService.listDirectory(remote.clonePath);
      if (files.length > 0) {
        // Directory exists, could delete it
        this.log(`Clone directory preserved: ${remote.clonePath}`);
      }
    } catch {
      // Directory doesn't exist
    }
    
    // Save updated meta
    const metaPath = path.join(this.globalStoragePath, 'git-remotes', 'meta.json');
    await this.saveMeta(metaPath);
    
    this.log(`Removed remote: ${url}@${remote.branch}`);
  }

  async refreshAll(): Promise<void> {
    this.log('Refreshing all remotes');
    await this.ensureAllCloned();
  }

  getRemotes(): RemoteMeta[] {
    return [...this.remotes];
  }

  async validateGitAvailable(): Promise<boolean> {
    if (this.gitAvailable !== undefined) {
      return this.gitAvailable;
    }
    
    try {
      const { stdout } = await this.runGit('git --version');
      this.gitAvailable = stdout.includes('git version');
      this.log(`Git available: ${this.gitAvailable}`);
      return this.gitAvailable;
    } catch {
      this.gitAvailable = false;
      this.log('Git not available');
      return false;
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

  private hashSpec(spec: RemoteGitSpec): string {
    const str = JSON.stringify({
      url: spec.url,
      branch: spec.branch,
      includePaths: spec.includePaths,
      displayNamePrefix: spec.displayNamePrefix
    });
    
    // Simple hash for change detection
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private getRepoName(url: string): string {
    // Extract repo name from URL or path
    const parts = url.replace(/\.git$/, '').split('/');
    return parts[parts.length - 1] || 'repo';
  }

  private generateDisplayName(prefix: string, branch: string, repoRelPath: string): string {
    let name = `${prefix}@${branch}`;
    if (repoRelPath && repoRelPath !== '.' && repoRelPath !== '') {
      name += `:${repoRelPath}`;
    }
    return name;
  }
}
