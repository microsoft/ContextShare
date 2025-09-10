// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as fs from 'fs/promises';
import { IncomingMessage } from 'http';
import * as https from 'https';
import * as path from 'path';
import { ActivateOptions, IFileService, IResourceService, OperationResult, Repository, Resource, ResourceCategory, ResourceState } from '../models';
import { isSafeRelativeEntry, sanitizeFilename, isValidHttpsUrl, sanitizeErrorMessage, validateMcpConfig, validateTaskConfig } from '../utils/security';
import { getErrorMessage } from '../utils/errors';

const CATEGORY_DIRS: Record<ResourceCategory,string> = { chatmodes:'chatmodes', instructions:'instructions', prompts:'prompts', tasks:'tasks', mcp:'mcp'};

export class ResourceService implements IResourceService {
  private sourceOverrides: Partial<Record<ResourceCategory,string>> = {};
  private remoteCacheTtlMs = 5 * 60 * 1000; // 5 minutes default
  private remoteCache: Map<string,{timestamp:number; content:string}> = new Map();
  private remoteCacheMaxSize = 50; // Maximum number of cached entries
  private remoteCacheMaxEntrySize = 1000000; // 1MB per entry
  private rootCatalogOverride?: string;
  private targetWorkspaceOverride?: string;
  private currentWorkspaceRoot?: string;
  private runtimeDirectoryName: string = '.github'; // Default runtime directory
  private logger?: (msg: string) => void;
  constructor(private fileService: IFileService){}

  // Optional logger injected by host extension
  setLogger(fn?: (msg: string) => void){ this.logger = fn; }
  private log(msg: string){ 
    try { 
      // Sanitize log messages to prevent information disclosure
      const sanitized = sanitizeErrorMessage(msg);
      this.logger?.(sanitized); 
    } catch (error) { 
      // Log to console as fallback if logger fails
      console.warn(`[ResourceService] Logger failed: ${getErrorMessage(error)}`);
    } 
  }

  setTargetWorkspaceOverride(path?: string){
    this.targetWorkspaceOverride = path && path.trim() ? path : undefined;
  this.log(`[ResourceService] setTargetWorkspaceOverride=${this.targetWorkspaceOverride || '(cleared)'}`);
  }

  setCurrentWorkspaceRoot(path?: string){
    this.currentWorkspaceRoot = path && path.trim() ? path : undefined;
  this.log(`[ResourceService] setCurrentWorkspaceRoot=${this.currentWorkspaceRoot || '(cleared)'}`);
  }

  setRuntimeDirectoryName(name: string){
    this.runtimeDirectoryName = name || '.github';
  this.log(`[ResourceService] setRuntimeDirectoryName=${this.runtimeDirectoryName}`);
  }

  setSourceOverrides(overrides: Partial<Record<ResourceCategory,string>>){
    this.sourceOverrides = overrides;
  const keys = Object.keys(overrides||{}).join(',') || '(none)';
  this.log(`[ResourceService] setSourceOverrides keys=${keys}`);
  }

  setRemoteCacheTtl(seconds: number){
    if(Number.isFinite(seconds) && seconds >= 0){
      this.remoteCacheTtlMs = seconds * 1000;
  this.log(`[ResourceService] setRemoteCacheTtlSeconds=${seconds}`);
    }
  }

  setRootCatalogOverride(root?: string){
    this.rootCatalogOverride = root && root.trim() ? root : undefined;
  this.log(`[ResourceService] setRootCatalogOverride=${this.rootCatalogOverride || '(cleared)'}`);
  }

  clearRemoteCache(){ 
    this.remoteCache.clear(); 
  }

  private evictOldCacheEntries(){
    const now = Date.now();
    // Remove expired entries
    for(const [key, entry] of this.remoteCache.entries()){
      if((now - entry.timestamp) >= this.remoteCacheTtlMs){
        this.remoteCache.delete(key);
      }
    }
    // If still over size limit, remove oldest entries
    if(this.remoteCache.size > this.remoteCacheMaxSize){
      const entries = Array.from(this.remoteCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - this.remoteCacheMaxSize);
      for(const [key] of toRemove){
        this.remoteCache.delete(key);
      }
    }
  }

  async discoverResources(repository: Repository): Promise<Resource[]> {
    const resources: Resource[] = [];
    const t0 = Date.now();
    this.log(`[ResourceService] discoverResources start repo=${repository.name} catalog=${repository.catalogPath} rootOverride=${this.rootCatalogOverride || '(none)'} targetWs=${this.targetWorkspaceOverride || '(none)'} currentWs=${this.currentWorkspaceRoot || '(none)'} runtimeDir=${this.runtimeDirectoryName}`);
    // Unified root override mode (recursive, filename inference)
    if(this.rootCatalogOverride){
      this.log(`[ResourceService] rootCatalogOverride mode: scanning ${this.rootCatalogOverride}`);
      const collected = await this.collectRecursive(this.rootCatalogOverride);
      for(const filePath of collected){
        const category = this.inferCategoryFromFilename(filePath);
        if(!category) continue;
        // Preserve subfolder structure relative to the override root to avoid id collisions
        let relWithinRoot = path.relative(this.rootCatalogOverride, filePath);
        // Normalize separators to ensure stable ids across platforms
        relWithinRoot = relWithinRoot.split(path.sep).join('/');
        let rel = path.join(CATEGORY_DIRS[category], relWithinRoot);
        // Ensure unique ID within this discovery batch
        let candidateId = `${repository.name}:${rel}`;
        if (resources.find(r => r.id === candidateId)) {
          // If collision still occurs, prefix an incrementing counter before filename
          const dirPart = path.dirname(rel);
          const base = path.basename(rel);
          let counter = 1;
          while(resources.find(r => r.id === candidateId)){
            const newBase = `${counter}_${base}`;
            rel = dirPart === '.' ? newBase : path.join(dirPart, newBase);
            candidateId = `${repository.name}:${rel}`;
            counter++;
          }
        }
        resources.push({ id: candidateId, relativePath: rel, absolutePath: filePath, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'catalog'});
      }
    } else {
    // Legacy per-category sources
    for(const category of Object.values(ResourceCategory)){
      const override = this.sourceOverrides[category];
      if(override && /^https?:\/\//i.test(override)){
        // Enhanced HTTPS-only validation for remote sources
        if(!isValidHttpsUrl(override)) {
          this.log(`[ResourceService] Skipping invalid or insecure URL: ${override}`);
          continue;
        }
        const isDir = override.endsWith('/');
        try {
          if(isDir){
            // Expect index.json listing file names
            const indexUrl = (override.endsWith('/') ? override : (override + '/')) + 'index.json';
            const listingRaw = await this.fetchRemoteCached(indexUrl);
            const listing: string[] = JSON.parse(listingRaw);
            for(const fname of listing){
              // Ignore unsafe entries and sanitize final filename used for caching/display
              if(!isSafeRelativeEntry(fname)) { continue; }
              const safeName = sanitizeFilename(fname);
              const fileUrl = (override.endsWith('/') ? override : (override + '/')) + encodeURIComponent(safeName);
              try {
                const content = await this.fetchRemoteCached(fileUrl);
                const abs = await this.cacheRemoteToDisk(repository, category, safeName, content);
                const rel = path.join(CATEGORY_DIRS[category], safeName);
                resources.push({ id: `${repository.name}:remote:${rel}`, relativePath: rel, absolutePath: abs, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'remote'});
              } catch (error) { 
                this.log(`[ResourceService] Failed to fetch individual file ${fileUrl}: ${getErrorMessage(error)}`);
              }
            }
          } else {
            const content = await this.fetchRemoteCached(override);
            const fileName = override.split('/').filter(Boolean).pop() || `${category}.txt`;
            const safeName = sanitizeFilename(fileName);
            const abs = await this.cacheRemoteToDisk(repository, category, safeName, content);
            const rel = path.join(CATEGORY_DIRS[category], safeName);
            resources.push({ id: `${repository.name}:remote:${rel}`, relativePath: rel, absolutePath: abs, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'remote'});
          }
          } catch (e:any) { 
            this.log(`[ResourceService] remote source failed for ${category}: ${sanitizeErrorMessage(e)}`); 
            // Continue with other sources even if remote fails
          }
        continue;
      }
      const baseDir = override ? this.resolveSourceDir(repository, override) : repository.catalogPath;
      // If override already points exactly to the category directory, use it directly
      let catDir: string;
      if(override && path.basename(baseDir) === CATEGORY_DIRS[category]) {
        catDir = baseDir;
      } else {
        catDir = path.join(baseDir, CATEGORY_DIRS[category]);
      }
  this.log(`[ResourceService] scan category=${category} dir=${catDir}`);
  let entries = await this.safeList(catDir);
      // Secondary fallback: if no entries and override path was absolute and exists, try baseDir directly
      if(entries.length === 0 && override) {
        const st = await this.fileService.stat(baseDir).catch(()=> 'missing');
        if(st === 'dir') {
          const attempt = await this.safeList(baseDir);
          if(attempt.length > 0) { catDir = baseDir; entries = attempt; }
        }
      }
      for(const entry of entries){
        const full = path.join(catDir, entry);
        const st = await this.fileService.stat(full);
        if(st !== 'file') continue;
        const rel = path.join(CATEGORY_DIRS[category], entry);
        // Ensure unique ID for resources from different repos but with same relative path
        const resourceId = `${repository.name}:${rel}`;
        if (!resources.find(r => r.id === resourceId)) {
          resources.push({ id: resourceId, relativePath: rel, absolutePath: full, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'catalog'});
        }
      }
  }
  }
    // Fallback filename-based discovery across entire catalog tree (non-root-override mode) so
    // that loose files (not organized into category subfolders) are still recognized.
    if(!this.rootCatalogOverride){
      try {
        const all = await this.collectRecursive(repository.catalogPath);
        const existingAbs = new Set(resources.map(r=> r.absolutePath));
        for(const filePath of all){
          if(existingAbs.has(filePath)) continue; // already captured via structured discovery
          const category = this.inferCategoryFromFilename(filePath);
          if(!category) continue;
            const rel = path.join(CATEGORY_DIRS[category], path.basename(filePath));
            // Avoid duplicate relativePath collisions by ensuring uniqueness of id (append index if needed)
            let relCandidate = rel;
            let counter = 0;
            while(resources.find(r=> r.id === `${repository.name}:${relCandidate}`)){
              counter++; relCandidate = path.join(CATEGORY_DIRS[category], `${counter}_${path.basename(filePath)}`);
            }
            resources.push({ id: `${repository.name}:${relCandidate}`, relativePath: relCandidate, absolutePath: filePath, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'catalog'});
        }
  } catch (e:any) { 
    this.log(`[ResourceService] fallback recursive scan failed: ${sanitizeErrorMessage(e)}`); 
    // Return empty array if recursive scan fails
    return [];
  }
    }
    // User created runtime-only resources (exist in runtime but not catalog). We treat them as ACTIVE and origin 'user'
    const runtimeUser: Resource[] = [];
    
    // Determine where to look for user assets - use target workspace override if set, otherwise repository runtime path
    const userAssetBaseDir = this.targetWorkspaceOverride || this.currentWorkspaceRoot || repository.rootPath;
    const userAssetRuntimePath = path.join(userAssetBaseDir, this.runtimeDirectoryName);
    
  for(const category of Object.values(ResourceCategory)){
      const runtimeDir = path.join(userAssetRuntimePath, CATEGORY_DIRS[category]);
      const entries = await this.safeList(runtimeDir);
      for(const entry of entries){
        const runtimeFull = path.join(runtimeDir, entry);
        const st = await this.fileService.stat(runtimeFull);
        if(st !== 'file') continue;
        // Determine if exists already in resources (catalog)
        const exists = resources.find(r => path.basename(r.relativePath) === entry && r.category===category);
        if(!exists){
          const disabled = entry.toLowerCase().endsWith('.disabled');
          const rel = path.join(CATEGORY_DIRS[category], entry); // relative to catalog path semantics
          runtimeUser.push({ id: `${repository.name}:user:${rel}`, relativePath: rel, absolutePath: runtimeFull, category, targetSubdir: CATEGORY_DIRS[category], repository, state: disabled ? ResourceState.INACTIVE : ResourceState.ACTIVE, origin: 'user', disabled });
        }
      }
    }
    resources.push(...runtimeUser);
    // Compute states for catalog resources (skip user ones)
  for(const r of resources){ if(r.origin !== 'user'){ r.state = await this.getResourceState(r); } }
  const dt = Date.now() - t0;
  const byCat: Record<string, number> = {};
  for(const r of resources){ byCat[r.category] = (byCat[r.category]||0)+1; }
  this.log(`[ResourceService] discoverResources done ${dt}ms total=${resources.length} byCat=${JSON.stringify(byCat)}`);
  return resources;
  }

  private resolveSourceDir(repository: Repository, overridePath: string){
    if(/^https?:\/\//i.test(overridePath)){
      // TODO: For remote sources we could implement download caching later. For now unsupported - fallback.
      return repository.catalogPath;
    }
    if(path.isAbsolute(overridePath)) return overridePath;
    return path.join(repository.rootPath, overridePath);
  }

  private async safeList(dir: string): Promise<string[]> { try { return await this.fileService.listDirectory(dir); } catch { return []; } }

  private async collectRecursive(root: string): Promise<string[]>{
    const out: string[] = [];
    const stack: string[] = [root];
    while(stack.length){
      const current = stack.pop()!;
      const entries = await this.safeList(current);
      for(const name of entries){
        const full = path.join(current, name);
        const st = await this.fileService.stat(full);
        if(st === 'file') out.push(full);
        else if(st === 'dir') stack.push(full);
      }
    }
    return out;
  }

  private inferCategoryFromFilename(filePath: string): ResourceCategory | undefined {
    const base = path.basename(filePath).toLowerCase();
    if(base.includes('chatmode')) return ResourceCategory.CHATMODES;
    if(base.includes('instruction')) return ResourceCategory.INSTRUCTIONS;
    if(base.includes('prompt')) return ResourceCategory.PROMPTS;
    if(base.includes('task')) return ResourceCategory.TASKS;
  if(base.includes('mcp')) return ResourceCategory.MCP;
    return undefined;
  }

  private async cacheRemoteToDisk(repository: Repository, category: ResourceCategory, fileName: string, content: string){
    const tempPath = path.join(repository.runtimePath, '.copilot_catalog_cache', CATEGORY_DIRS[category]);
    await this.fileService.ensureDirectory(tempPath);
    const abs = path.join(tempPath, fileName);
    await this.fileService.writeFile(abs, content);
    return abs;
  }

  private fetchRemote(url: string): Promise<string>{
    // Safer HTTPS-only fetch with enhanced security measures
    const TIMEOUT_MS = 8000;
    const MAX_BYTES = 1_000_000; // 1 MB safety limit
    const MAX_REDIRECTS = 3;
    
    return this.fetchRemoteWithRedirects(url, MAX_REDIRECTS, MAX_BYTES, TIMEOUT_MS);
  }

  private fetchRemoteWithRedirects(url: string, maxRedirects: number, maxBytes: number, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        if (!isValidHttpsUrl(url)) { 
          reject(new Error('Invalid or insecure URL provided')); 
          return; 
        }

        const req = https.get(url, {
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'VSCode-ContextShare/1.0'
          }
        }, (res: IncomingMessage) => {
          // Handle redirects more safely
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (maxRedirects <= 0) {
              reject(new Error('Too many redirects'));
              return;
            }
            
            const location = res.headers.location as string;
            if (!location || !isValidHttpsUrl(location)) {
              reject(new Error('Invalid redirect location'));
              return;
            }
            
            // Recursively handle redirect with decremented counter
            this.fetchRemoteWithRedirects(location, maxRedirects - 1, maxBytes, timeoutMs)
              .then(resolve)
              .catch(reject);
            return;
          }
          
          this.collectResponse(res, resolve, reject, maxBytes);
        });

        req.on('error', (err) => {
          reject(new Error(`Network error: ${sanitizeErrorMessage(err)}`));
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

      } catch (e) { 
        this.log(`[ResourceService] fetchRemote exception: ${sanitizeErrorMessage(e)}`); 
        reject(new Error(`Request failed: ${sanitizeErrorMessage(e)}`)); 
      }
    });
  }

  private async fetchRemoteCached(url: string): Promise<string>{
    // Evict old entries before checking cache
    this.evictOldCacheEntries();
    
    const entry = this.remoteCache.get(url);
    const now = Date.now();
    if(entry && (now - entry.timestamp) < this.remoteCacheTtlMs){ 
      return entry.content; 
    }
    
    const content = await this.fetchRemote(url);
    
    // Check content size before caching
    if(content.length <= this.remoteCacheMaxEntrySize){
      this.remoteCache.set(url, { timestamp: now, content });
      // Evict again if we're over the limit
      this.evictOldCacheEntries();
    }
    
    return content;
  }

  private collectResponse(res: IncomingMessage, resolve: (v:string)=>void, reject:(e:any)=>void, maxBytes: number){
    if(res.statusCode !== 200){ 
      reject(new Error(`HTTP ${res.statusCode}`)); 
      return; 
    }
    
    const chunks: Buffer[] = [];
    let total = 0;
    
    res.on('data',(chunk: Buffer)=>{
      total += chunk.length;
      if(total > maxBytes){
        try { 
          res.destroy(); 
        } catch {}
        reject(new Error('Response too large'));
        return;
      }
      chunks.push(chunk);
    });
    
    res.on('end',()=>{
      try {
        resolve(Buffer.concat(chunks).toString('utf8'));
      } catch (e) {
        reject(new Error(`Failed to decode response: ${sanitizeErrorMessage(e)}`));
      }
    });
    
    (res as any).on('error', (err: any) => {
      reject(new Error(`Response error: ${sanitizeErrorMessage(err)}`));
    });
  }

  async getResourceState(resource: Resource): Promise<ResourceState>{
    if(resource.origin === 'user') return ResourceState.ACTIVE;
    // Special handling for MCP: merge into .vscode/mcp.json, compare presence of the same servers
    if(resource.category === ResourceCategory.MCP){
      const target = this.getTargetPath(resource);
      const exists = await this.fileService.pathExists(target);
      if(!exists) return ResourceState.INACTIVE;
      try {
        const [srcRaw, tgtRaw] = await Promise.all([
          this.fileService.readFile(resource.absolutePath),
          this.fileService.readFile(target)
        ]);
        const src = this.parseMcpConfig(srcRaw);
        const tgt = this.parseMcpConfig(tgtRaw);
        const status = this.compareMcpPresence(src, tgt);
        return status;
  } catch (e:any) { this.log(`[ResourceService] getResourceState(MCP) error for ${resource.relativePath}: ${sanitizeErrorMessage(e)}`); return ResourceState.INACTIVE; }
    } else {
      const target = this.getTargetPath(resource);
      const exists = await this.fileService.pathExists(target);
      if(!exists) return ResourceState.INACTIVE;
      try {
        const [srcContent, tgtContent] = await Promise.all([
          this.fileService.readFile(resource.absolutePath),
          this.fileService.readFile(target)
        ]);
        if(srcContent === tgtContent) return ResourceState.ACTIVE;
        return ResourceState.MODIFIED;
  } catch (e:any) { this.log(`[ResourceService] getResourceState error for ${resource.relativePath}: ${sanitizeErrorMessage(e)}`); return ResourceState.INACTIVE; }
    }
  }

  getTargetPath(resource: Resource){
    // MCP targets the workspace-level .vscode/mcp.json file (not under runtime dir)
    if(resource.category === ResourceCategory.MCP){
      const base = this.targetWorkspaceOverride || this.currentWorkspaceRoot || resource.repository.rootPath;
      return path.join(base, '.vscode', 'mcp.json');
    }

  const fileName = path.basename(resource.relativePath);
  // Use plain filename for both catalog and user resources to match expected runtime layout
  const targetFileName = fileName;

    if(this.targetWorkspaceOverride){
      return path.join(this.targetWorkspaceOverride, this.runtimeDirectoryName, resource.targetSubdir, targetFileName);
    }
    // When no target workspace override is set, use current workspace root if available, otherwise fall back to repository root
    const base = this.currentWorkspaceRoot || resource.repository.rootPath;
    return path.join(base, this.runtimeDirectoryName, resource.targetSubdir, targetFileName);
  }

  async activateResource(resource: Resource, _options?: ActivateOptions): Promise<OperationResult>{
    this.log(`[ResourceService] activateResource start id=${resource.id} cat=${resource.category} origin=${resource.origin}`);
    if(resource.origin === 'user'){
      this.log('[ResourceService] activateResource no-op for user resource');
      return { success:true, resource, message:'User resource already active' };
    }
    if(resource.category === ResourceCategory.MCP){
      const target = this.getTargetPath(resource);
      try {
        const srcRaw = await this.fileService.readFile(resource.absolutePath);
        const srcCfg = this.parseMcpConfig(srcRaw);
        const exists = await this.fileService.pathExists(target);
        let merged: any = exists ? this.parseMcpConfig(await this.fileService.readFile(target)) : { inputs: [], servers: {} };
        // Merge inputs by id, keep existing target on conflict
        const srcInputs: any[] = Array.isArray(srcCfg.inputs) ? srcCfg.inputs : [];
        const tgtInputs: any[] = Array.isArray(merged.inputs) ? merged.inputs : [];
        const byId = new Map<string, any>();
        for(const inp of tgtInputs){ if(inp && inp.id) byId.set(String(inp.id), inp); }
        for(const inp of srcInputs){ const id = inp && inp.id ? String(inp.id) : undefined; if(!id) continue; if(!byId.has(id)) { byId.set(id, inp); } }
        merged.inputs = Array.from(byId.values());
        // Merge servers: if an equal config already exists under any name, skip adding.
        // Otherwise, prefer original name if free; else add with a unique -catalog suffix.
        merged.servers = merged.servers && typeof merged.servers === 'object' ? merged.servers : {};
        const srcServers = srcCfg.servers && typeof srcCfg.servers === 'object' ? srcCfg.servers : {};
        const addedNames: string[] = [];
        for(const [name, cfg] of Object.entries<any>(srcServers)){
          // Check if equal exists under any name
          let equalExists = false;
          for(const tv of Object.values<any>(merged.servers)){
            if(this.deepEqual(tv, cfg)) { equalExists = true; break; }
          }
          if(equalExists) continue;
          let toUse = name;
          if(merged.servers[toUse]){
            let i = 1; let candidate = `${name}-catalog`;
            while(merged.servers[candidate]){ candidate = `${name}-catalog-${i++}`; }
            toUse = candidate;
          }
          merged.servers[toUse] = cfg;
          addedNames.push(toUse);
        }
        // Ensure folder and write
        await this.fileService.ensureDirectory(path.dirname(target));
        await this.fileService.writeFile(target, JSON.stringify(merged, null, 2));
        // Update sidecar meta with added names for this resource id
        try {
          const metaPath = this.getMcpMetaPath(target);
          const meta = await this.readMcpMeta(metaPath);
          if(addedNames.length){
            meta.byResourceId = meta.byResourceId || {};
            const key = resource.id;
            const existing: string[] = Array.isArray(meta.byResourceId[key]) ? meta.byResourceId[key] : [];
            const combined = Array.from(new Set([...existing, ...addedNames]));
            meta.byResourceId[key] = combined;
            await this.fileService.ensureDirectory(path.dirname(metaPath));
            await this.fileService.writeFile(metaPath, JSON.stringify(meta, null, 2));
          }
        } catch { /* meta write best-effort */ }
        resource.state = await this.getResourceState(resource);
        this.log(`[ResourceService] activateResource MCP merged target=${target} added=${JSON.stringify(addedNames)}`);
        return { success:true, resource, message:'MCP configuration merged' };
      } catch(e:any){
        this.log(`[ResourceService] activateResource MCP error: ${sanitizeErrorMessage(e)}`);
        return { success:false, resource, message:'MCP activation failed', details: sanitizeErrorMessage(e) };
      }
    } else {
      const target = this.getTargetPath(resource);
      try {
        await this.fileService.copyFile(resource.absolutePath, target);
        resource.state = await this.getResourceState(resource);
        this.log(`[ResourceService] activateResource copied ${resource.absolutePath} -> ${target} state=${resource.state}`);
        // If this is a VS Code task, also merge into .vscode/tasks.json
        if(resource.category === ResourceCategory.TASKS){
          try {
            const { added } = await this.mergeVsCodeTasks(resource);
            this.log(`[ResourceService] tasks.json merge added=${added}`);
          } catch(e:any){ this.log(`[ResourceService] tasks.json merge failed: ${sanitizeErrorMessage(e)}`); }
        }
        return { success: true, resource, message: 'Activated' };
      } catch(e:any){
        this.log(`[ResourceService] activateResource error for ${resource.relativePath}: ${sanitizeErrorMessage(e)}`);
        return { success:false, resource, message:'Activation failed', details: sanitizeErrorMessage(e) };
      }
    }
  }

  async deactivateResource(resource: Resource): Promise<OperationResult>{
    this.log(`[ResourceService] deactivateResource start id=${resource.id} cat=${resource.category} origin=${resource.origin}`);
    if(resource.origin === 'user'){
      return { success:false, resource, message:'Cannot deactivate user-created resource'};
    }
    if(resource.category === ResourceCategory.MCP){
      const target = this.getTargetPath(resource);
      try {
        const exists = await this.fileService.pathExists(target);
        if(!exists) return { success:true, resource, message:'MCP not present' };
        const [srcRaw, tgtRaw, meta] = await Promise.all([
          this.fileService.readFile(resource.absolutePath),
          this.fileService.readFile(target),
          this.readMcpMetaSafe(this.getMcpMetaPath(target))
        ]);
        const src = this.parseMcpConfig(srcRaw);
        const tgt = this.parseMcpConfig(tgtRaw);
        const newServers: any = { ...(tgt.servers || {}) };
        const namesToRemove: string[] = (meta.byResourceId && Array.isArray(meta.byResourceId[resource.id])) ? meta.byResourceId[resource.id] : [];
        // Remove only servers we previously added for this resource
        for(const name of namesToRemove){ if(name in newServers) delete newServers[name]; }
        const updated = { ...tgt, servers: newServers };
        await this.fileService.writeFile(target, JSON.stringify(updated, null, 2));
        // Update meta to drop these names from this resource
        try {
          const metaPath = this.getMcpMetaPath(target);
          if(meta.byResourceId){
            const remaining = (meta.byResourceId[resource.id] || []).filter((n: string)=> !namesToRemove.includes(n));
            if(remaining.length) meta.byResourceId[resource.id] = remaining; else delete meta.byResourceId[resource.id];
            await this.fileService.writeFile(metaPath, JSON.stringify(meta, null, 2));
          }
        } catch (error) { 
          this.log(`[ResourceService] Failed to update meta file: ${getErrorMessage(error)}`);
        }
        resource.state = await this.getResourceState(resource);
        this.log(`[ResourceService] deactivateResource MCP updated target=${target} removed=${namesToRemove.length}`);
        return { success:true, resource, message:'MCP entries removed (kept user entries)'};
      } catch(e:any){
        this.log(`[ResourceService] deactivateResource MCP error: ${sanitizeErrorMessage(e)}`);
        return { success:false, resource, message:'MCP deactivate failed', details: sanitizeErrorMessage(e) };
      }
    } else {
      const target = this.getTargetPath(resource);
      // Prefer fileService delete if available (mock aware), fallback to fs.unlink
      const deleter: any = (this.fileService as any).deleteFile?.bind(this.fileService);
      if(deleter){ 
        await deleter(target); 
      } else { 
        try { 
          await fs.unlink(target);
        } catch (error) {
          this.log(`[ResourceService] Failed to unlink target file ${target}: ${getErrorMessage(error)}`);
        }
      }
      // If task, also remove from .vscode/tasks.json based on metadata
      if(resource.category === ResourceCategory.TASKS){
        try { const removed = await this.removeVsCodeTasks(resource); this.log(`[ResourceService] tasks.json cleanup removed=${removed}`); } catch(e:any){ this.log(`[ResourceService] tasks.json cleanup failed: ${sanitizeErrorMessage(e)}`); }
      }
      resource.state = await this.getResourceState(resource);
      this.log(`[ResourceService] deactivateResource removed target=${target} state=${resource.state}`);
      return { success:true, resource, message:'Deactivated'};
    }
  }

  // -- Atomic file operations helper
  private async atomicFileOperation(
    sourcePath: string, 
    targetPath: string, 
    operation: 'move' | 'copy'
  ): Promise<void> {
    const tempPath = targetPath + '.tmp.' + Date.now();
    let tempCreated = false;
    
    try {
      // Step 1: Copy source to temp location
      await (this.fileService as any).copyFile(sourcePath, tempPath);
      tempCreated = true;
      
      // Step 2: Move/copy temp to final location
      if(typeof (this.fileService as any).renameFile === 'function') {
        await (this.fileService as any).renameFile(tempPath, targetPath);
      } else {
        // Fallback: copy and delete temp
        await (this.fileService as any).copyFile(tempPath, targetPath);
        await this.safeDeleteFile(tempPath);
      }
      
      // Step 3: Delete source if this is a move operation
      if(operation === 'move') {
        await this.safeDeleteFile(sourcePath);
      }
      
    } catch (error) {
      // Rollback: clean up temp file if it was created
      if(tempCreated) {
        await this.safeDeleteFile(tempPath);
      }
      throw error;
    }
  }
  
  private async safeDeleteFile(filePath: string): Promise<void> {
    try {
      const deleter: any = (this.fileService as any).deleteFile?.bind(this.fileService);
      if(deleter) {
        await deleter(filePath);
      } else {
        await fs.unlink(filePath);
      }
    } catch (error) {
      this.log(`[ResourceService] Failed to delete file ${filePath}: ${getErrorMessage(error)}`);
      // Don't throw - file deletion failures are often non-critical
    }
  }

  // -- User asset enable/disable with atomic operations
  async disableUserResource(resource: Resource): Promise<OperationResult>{
    if(resource.origin !== 'user') return { success:false, resource, message:'Only user resources can be disabled' };
    if(resource.disabled) return { success:true, resource, message:'Already disabled' };
    
    try {
      const dir = path.dirname(resource.absolutePath);
      const base = path.basename(resource.absolutePath);
      const newPath = path.join(dir, base + '.disabled');
      
      // Atomic move operation
      await this.atomicFileOperation(resource.absolutePath, newPath, 'move');
      
      resource.absolutePath = newPath;
      (resource as any).disabled = true;
      resource.state = ResourceState.INACTIVE;
      this.log(`[ResourceService] disableUserResource ${resource.id} -> ${newPath}`);
      return { success:true, resource, message:'Disabled user resource' };
      
    } catch(e:any){ 
      return { success:false, resource, message:'Disable failed', details: sanitizeErrorMessage(e) }; 
    }
  }
  
  async enableUserResource(resource: Resource): Promise<OperationResult>{
    if(resource.origin !== 'user') return { success:false, resource, message:'Only user resources can be enabled' };
    if(!resource.disabled) return { success:true, resource, message:'Already enabled' };
    
    try {
      const dir = path.dirname(resource.absolutePath);
      let base = path.basename(resource.absolutePath);
      if(base.toLowerCase().endsWith('.disabled')) base = base.slice(0, -('.disabled'.length));
      const newPath = path.join(dir, base);
      
      // Atomic move operation
      await this.atomicFileOperation(resource.absolutePath, newPath, 'move');
      
      resource.absolutePath = newPath;
      (resource as any).disabled = false;
      resource.state = ResourceState.ACTIVE;
      this.log(`[ResourceService] enableUserResource ${resource.id} -> ${newPath}`);
      return { success:true, resource, message:'Enabled user resource' };
      
    } catch(e:any){ 
      return { success:false, resource, message:'Enable failed', details: sanitizeErrorMessage(e) }; 
    }
  }

  // --- MCP helpers ---
  private stripJsonComments(s: string): string {
    // Remove // and /* */ comments in a simplistic but effective way for well-formed files
    return s
      .replace(/(^|\s)\/\/.*$/gm, '$1')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }
  // --- VS Code tasks.json helpers ---
  private getTasksJsonPath(resource: Resource): string {
    const base = this.targetWorkspaceOverride || this.currentWorkspaceRoot || resource.repository.rootPath;
    return path.join(base, '.vscode', 'tasks.json');
  }
  private getTasksMetaPath(resource: Resource): string {
    return path.join(path.dirname(this.getTasksJsonPath(resource)), '.copilot-catalog-tasks-meta.json');
  }
  private normalizeTaskForKey(task: any): string {
    if(task && typeof task === 'object' && typeof task.label === 'string' && task.label.trim()){
      return `label:${task.label.trim()}`;
    }
    // Fallback to a stable JSON key
    try {
      const ordered = (obj: any): any => {
        if(Array.isArray(obj)) return obj.map(ordered);
        if(obj && typeof obj === 'object'){
          return Object.keys(obj).sort().reduce((acc: any, k: string)=>{ acc[k]=ordered(obj[k]); return acc; }, {});
        }
        return obj;
      };
      return 'hash:' + JSON.stringify(ordered(task));
    } catch { return 'hash:unknown'; }
  }
  private async readJsonFileSafe(p: string): Promise<any> { 
    try { 
      const raw = await this.fileService.readFile(p); 
      const cleaned = this.stripJsonComments(raw||'{}');
      return JSON.parse(cleaned); 
    } catch (e) { 
      this.log(`[ResourceService] readJsonFileSafe failed for ${path.basename(p)}: ${sanitizeErrorMessage(e)}`);
      return {}; 
    } 
  }
  private async writeJsonFilePretty(p: string, obj: any): Promise<void> {
    await this.fileService.ensureDirectory(path.dirname(p));
    await this.fileService.writeFile(p, JSON.stringify(obj, null, 2));
  }
  private async readTasksMeta(resource: Resource): Promise<any> { return this.readJsonFileSafe(this.getTasksMetaPath(resource)); }
  private async writeTasksMeta(resource: Resource, obj: any): Promise<void> { await this.writeJsonFilePretty(this.getTasksMetaPath(resource), obj); }

  private extractVsCodeTasks(obj: any): any[] {
    if(!obj || typeof obj !== 'object') return [];
    if(Array.isArray(obj.tasks)) return obj.tasks.filter((t:any)=> t && typeof t==='object');
    if(obj.version && Array.isArray(obj.tasks)) return obj.tasks.filter((t:any)=> t && typeof t==='object');
    if(obj.vscodeTask && typeof obj.vscodeTask==='object') return [obj.vscodeTask];
    if(obj.vsCodeTask && typeof obj.vsCodeTask==='object') return [obj.vsCodeTask];
    // A single task object (has type/label)
    if(typeof obj.type==='string' || typeof obj.label==='string') return [obj];
    return [];
  }

  private async mergeVsCodeTasks(resource: Resource): Promise<{added:number}> {
    try {
      const srcObj = await this.readJsonFileSafe(resource.absolutePath);
      
      // Validate task configuration before processing
      const validation = validateTaskConfig(srcObj);
      if (!validation.valid) {
        this.log(`[ResourceService] mergeVsCodeTasks validation failed: ${validation.errors.join(', ')}`);
        return { added: 0 };
      }
      
      const newTasks = this.extractVsCodeTasks(srcObj);
      this.log(`[ResourceService] mergeVsCodeTasks src=${path.basename(resource.absolutePath)} extracted=${newTasks.length}`);
      if(newTasks.length === 0) return { added: 0 };
      
      const tasksPath = this.getTasksJsonPath(resource);
      this.log(`[ResourceService] mergeVsCodeTasks tasksPath=${tasksPath}`);
      const tasksObj = await this.readJsonFileSafe(tasksPath);
      const tasksArr: any[] = Array.isArray(tasksObj.tasks) ? tasksObj.tasks : [];
      const existingKeys = new Set(tasksArr.map(t=> this.normalizeTaskForKey(t)));
      const toAdd: any[] = [];
      const addedKeys: string[] = [];
      
      for(const t of newTasks){
        const key = this.normalizeTaskForKey(t);
        if(!existingKeys.has(key)){
          toAdd.push(t);
          addedKeys.push(key);
          existingKeys.add(key);
        }
      }
      
      if(toAdd.length === 0) return { added: 0 };
      const updated = { version: '2.0.0', ...tasksObj, tasks: [...tasksArr, ...toAdd] };
      await this.writeJsonFilePretty(tasksPath, updated);
      this.log(`[ResourceService] mergeVsCodeTasks wrote tasks.json added=${toAdd.length}`);
      
      // Update meta
      const meta = await this.readTasksMeta(resource);
      meta.byResourceId = meta.byResourceId || {};
      const prev: string[] = Array.isArray(meta.byResourceId[resource.id]) ? meta.byResourceId[resource.id] : [];
      meta.byResourceId[resource.id] = Array.from(new Set([...prev, ...addedKeys]));
      await this.writeTasksMeta(resource, meta);
      return { added: toAdd.length };
    } catch (e:any) {
      throw e;
    }
  }

  private async removeVsCodeTasks(resource: Resource): Promise<number> {
    const tasksPath = this.getTasksJsonPath(resource);
    this.log(`[ResourceService] removeVsCodeTasks tasksPath=${tasksPath}`);
    const tasksObj = await this.readJsonFileSafe(tasksPath);
    const arr: any[] = Array.isArray(tasksObj.tasks) ? tasksObj.tasks : [];
    if(arr.length === 0) return 0;
    const meta = await this.readTasksMeta(resource);
    const keys: string[] = Array.isArray(meta?.byResourceId?.[resource.id]) ? meta.byResourceId[resource.id] : [];
    if(keys.length === 0) return 0;
    const toRemove = new Set(keys);
    const kept = arr.filter(t => !toRemove.has(this.normalizeTaskForKey(t)));
    const removed = arr.length - kept.length;
    if(removed > 0){
      const updated = { version: tasksObj.version || '2.0.0', ...tasksObj, tasks: kept };
      await this.writeJsonFilePretty(tasksPath, updated);
      // Update meta
      try {
        const remaining = (meta.byResourceId[resource.id] || []).filter((k: string)=> !toRemove.has(k));
        if(remaining.length) meta.byResourceId[resource.id] = remaining; else delete meta.byResourceId[resource.id];
        await this.writeTasksMeta(resource, meta);
      } catch (error) { 
        this.log(`[ResourceService] Failed to update meta file during activation: ${getErrorMessage(error)}`);
      }
    }
    return removed;
  }
  private parseMcpConfig(raw: string): any {
    try {
      const text = this.stripJsonComments(raw);
      const obj = JSON.parse(text || '{}');
      
      // Validate MCP configuration
      const validation = validateMcpConfig(obj);
      if (!validation.valid) {
        this.log(`[ResourceService] parseMcpConfig validation warnings: ${validation.errors.join(', ')}`);
        // Continue with parsing but log warnings
      }
      
      // Normalize shape
      const servers = obj.servers && typeof obj.servers === 'object' ? obj.servers : (obj["mcpServers"] && typeof obj["mcpServers"] === 'object' ? obj["mcpServers"] : {});
      const inputs = Array.isArray(obj.inputs) ? obj.inputs : [];
      return { inputs, servers };
    } catch (e) {
      this.log(`[ResourceService] parseMcpConfig failed: ${sanitizeErrorMessage(e)}`);
      return { inputs: [], servers: {} };
    }
  }
  private compareMcpPresence(src: any, tgt: any): ResourceState {
    const srcServers = src.servers || {};
    const tgtServers = tgt.servers || {};
    const names = Object.keys(srcServers);
    if(names.length === 0) return ResourceState.INACTIVE;
    let presentEqual = 0; let presentNonEqual = 0; let missing = 0;
    for(const [name, cfg] of Object.entries<any>(srcServers)){
      // Look for any target entry that matches by deep equality (allow suffixed names)
      let foundEqual = false; let foundAny = false;
      for(const [tn, tv] of Object.entries<any>(tgtServers)){
        if(tn === name) foundAny = true;
        if(this.deepEqual(tv, cfg)) { foundEqual = true; foundAny = true; break; }
      }
      if(foundEqual) presentEqual++;
      else if(foundAny) presentNonEqual++;
      else missing++;
    }
    if(presentEqual === names.length) return ResourceState.ACTIVE;
    if(missing === names.length) return ResourceState.INACTIVE;
    return ResourceState.MODIFIED;
  }
  private deepEqual(a: any, b: any): boolean {
    if(a === b) return true;
    if(typeof a !== typeof b) return false;
    if(!a || !b) return false;
    if(Array.isArray(a)){
      if(!Array.isArray(b) || a.length !== b.length) return false;
      for(let i=0;i<a.length;i++){ if(!this.deepEqual(a[i], b[i])) return false; }
      return true;
    }
    if(typeof a === 'object'){
      const ak = Object.keys(a).sort();
      const bk = Object.keys(b).sort();
      if(ak.length !== bk.length) return false;
      for(let i=0;i<ak.length;i++){ if(ak[i]!==bk[i]) return false; }
      for(const k of ak){ if(!this.deepEqual(a[k], (b as any)[k])) return false; }
      return true;
    }
    return false;
  }
  private getMcpMetaPath(targetMcpJson: string): string { return path.join(path.dirname(targetMcpJson), '.copilot-catalog-mcp-meta.json'); }
  private async readMcpMeta(metaPath: string): Promise<any> {
    try { const raw = await this.fileService.readFile(metaPath); const obj = JSON.parse(raw||'{}'); return obj && typeof obj==='object' ? obj : {}; } catch { return {}; }
  }
  private async readMcpMetaSafe(metaPath: string): Promise<any> { return this.readMcpMeta(metaPath); }
}
