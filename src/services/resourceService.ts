import * as path from 'path';
import { ActivateOptions, IFileService, IResourceService, OperationResult, Repository, Resource, ResourceCategory, ResourceState, ResourceOrigin } from '../models';
import * as fs from 'fs/promises';
import * as https from 'https';
import { IncomingMessage } from 'http';
import { sanitizeFilename, isSafeRelativeEntry } from '../utils/security';

const CATEGORY_DIRS: Record<ResourceCategory,string> = { chatmodes:'chatmodes', instructions:'instructions', prompts:'prompts', tasks:'tasks', mcp:'mcp'};

export class ResourceService implements IResourceService {
  private sourceOverrides: Partial<Record<ResourceCategory,string>> = {};
  private remoteCacheTtlMs = 5 * 60 * 1000; // 5 minutes default
  private remoteCache: Map<string,{timestamp:number; content:string}> = new Map();
  private rootCatalogOverride?: string;
  private targetWorkspaceOverride?: string;
  private runtimeDirectoryName: string = '.github'; // Default runtime directory
  constructor(private fileService: IFileService){}

  setTargetWorkspaceOverride(path?: string){
    this.targetWorkspaceOverride = path && path.trim() ? path : undefined;
  }

  setRuntimeDirectoryName(name: string){
    this.runtimeDirectoryName = name || '.github';
  }

  setSourceOverrides(overrides: Partial<Record<ResourceCategory,string>>){
    this.sourceOverrides = overrides;
  }

  setRemoteCacheTtl(seconds: number){
    if(Number.isFinite(seconds) && seconds >= 0){
      this.remoteCacheTtlMs = seconds * 1000;
    }
  }

  setRootCatalogOverride(root?: string){
    this.rootCatalogOverride = root && root.trim() ? root : undefined;
  }

  clearRemoteCache(){ this.remoteCache.clear(); }

  async discoverResources(repository: Repository): Promise<Resource[]> {
    const resources: Resource[] = [];
    // Unified root override mode (recursive, filename inference)
    if(this.rootCatalogOverride){
      const collected = await this.collectRecursive(this.rootCatalogOverride);
      for(const filePath of collected){
        const category = this.inferCategoryFromFilename(filePath);
        if(!category) continue;
        const rel = path.join(CATEGORY_DIRS[category], path.basename(filePath));
        resources.push({ id: `${repository.name}:${rel}`, relativePath: rel, absolutePath: filePath, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'catalog'});
      }
    } else {
    // Legacy per-category sources
    for(const category of Object.values(ResourceCategory)){
      const override = this.sourceOverrides[category];
      if(override && /^https?:\/\//i.test(override)){
        // Enforce HTTPS-only for remote sources
        if(!/^https:\/\//i.test(override)) {
          // Skip insecure HTTP sources
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
              } catch { /* individual file skip */ }
            }
          } else {
            const content = await this.fetchRemoteCached(override);
            const fileName = override.split('/').filter(Boolean).pop() || `${category}.txt`;
            const safeName = sanitizeFilename(fileName);
            const abs = await this.cacheRemoteToDisk(repository, category, safeName, content);
            const rel = path.join(CATEGORY_DIRS[category], safeName);
            resources.push({ id: `${repository.name}:remote:${rel}`, relativePath: rel, absolutePath: abs, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'remote'});
          }
        } catch { /* ignore remote failure */ }
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
        resources.push({ id: `${repository.name}:${rel}`, relativePath: rel, absolutePath: full, category, targetSubdir: CATEGORY_DIRS[category], repository, state: ResourceState.INACTIVE, origin: 'catalog'});
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
      } catch { /* ignore recursive scan failure */ }
    }
    // User created runtime-only resources (exist in runtime but not catalog). We treat them as ACTIVE and origin 'user'
    const runtimeUser: Resource[] = [];
    for(const category of Object.values(ResourceCategory)){
      const runtimeDir = path.join(repository.runtimePath, CATEGORY_DIRS[category]);
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
    // HTTPS-only fetch with timeout and max size limits
    const TIMEOUT_MS = 8000;
    const MAX_BYTES = 1_000_000; // 1 MB safety limit
    return new Promise((resolve, reject)=>{
      try {
        if(!/^https:\/\//i.test(url)) { reject(new Error('Only HTTPS URLs are allowed')); return; }
        const req = https.get(url, (res: IncomingMessage)=>{
          if(res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location){
            const loc = res.headers.location as string;
            if(loc && /^https:\/\//i.test(loc)){
              const req2 = https.get(loc, (r2: IncomingMessage)=>{ this.collectResponse(r2, resolve, reject, MAX_BYTES); }).on('error', reject);
              req2.setTimeout(TIMEOUT_MS, ()=>{ try { req2.destroy(new Error('Request timeout')); } catch {} });
            } else {
              reject(new Error('Redirected to non-HTTPS location'));
            }
          } else {
            this.collectResponse(res, resolve, reject, MAX_BYTES);
          }
        }).on('error', reject);
        req.setTimeout(TIMEOUT_MS, ()=>{ try { req.destroy(new Error('Request timeout')); } catch {} });
      } catch(e){ reject(e); }
    });
  }

  private async fetchRemoteCached(url: string): Promise<string>{
    const entry = this.remoteCache.get(url);
    const now = Date.now();
    if(entry && (now - entry.timestamp) < this.remoteCacheTtlMs){ return entry.content; }
    const content = await this.fetchRemote(url);
    this.remoteCache.set(url, { timestamp: now, content });
    return content;
  }

  private collectResponse(res: IncomingMessage, resolve: (v:string)=>void, reject:(e:any)=>void, maxBytes: number){
    if(res.statusCode !== 200){ reject(new Error(`HTTP ${res.statusCode}`)); return; }
    const chunks: Buffer[] = [];
    let total = 0;
    res.on('data',(c: Buffer)=>{
      total += c.length;
      if(total > maxBytes){
        try { (res as any).destroy?.(new Error('Response too large')); } catch {}
        reject(new Error('Response too large'));
        return;
      }
      chunks.push(c);
    });
    res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
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
      } catch { return ResourceState.INACTIVE; }
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
      } catch { return ResourceState.INACTIVE; }
    }
  }

  getTargetPath(resource: Resource){
    // MCP targets the workspace-level .vscode/mcp.json file (not under runtime dir)
    if(resource.category === ResourceCategory.MCP){
      const base = this.targetWorkspaceOverride || resource.repository.rootPath;
      return path.join(base, '.vscode', 'mcp.json');
    }
    if(this.targetWorkspaceOverride){
      return path.join(this.targetWorkspaceOverride, this.runtimeDirectoryName, resource.targetSubdir, path.basename(resource.relativePath));
    }
    return path.join(resource.repository.runtimePath, resource.targetSubdir, path.basename(resource.relativePath));
  }

  async activateResource(resource: Resource, _options?: ActivateOptions): Promise<OperationResult>{
    if(resource.origin === 'user'){
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
        return { success:true, resource, message:'MCP configuration merged' };
      } catch(e:any){
        return { success:false, resource, message:'MCP activation failed', details: e?.message };
      }
    } else {
      const target = this.getTargetPath(resource);
      try {
        await this.fileService.copyFile(resource.absolutePath, target);
        resource.state = await this.getResourceState(resource);
        return { success: true, resource, message: 'Activated' };
      } catch(e:any){
        return { success:false, resource, message:'Activation failed', details: e?.message };
      }
    }
  }

  async deactivateResource(resource: Resource): Promise<OperationResult>{
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
        } catch { /* ignore meta update errors */ }
        resource.state = await this.getResourceState(resource);
        return { success:true, resource, message:'MCP entries removed (kept user entries)'};
      } catch(e:any){
        return { success:false, resource, message:'MCP deactivate failed', details: e?.message };
      }
    } else {
      const target = this.getTargetPath(resource);
      // Prefer fileService delete if available (mock aware), fallback to fs.unlink
      const deleter: any = (this.fileService as any).deleteFile?.bind(this.fileService);
      if(deleter){ await deleter(target); } else { try { await fs.unlink(target);} catch {} }
      resource.state = await this.getResourceState(resource);
      return { success:true, resource, message:'Deactivated'};
    }
  }

  // -- User asset enable/disable by renaming file extension
  async disableUserResource(resource: Resource): Promise<OperationResult>{
    if(resource.origin !== 'user') return { success:false, resource, message:'Only user resources can be disabled' };
    if(resource.disabled) return { success:true, resource, message:'Already disabled' };
    try {
      const dir = path.dirname(resource.absolutePath);
      const base = path.basename(resource.absolutePath);
      const newPath = path.join(dir, base + '.disabled');
      await (this.fileService as any).copyFile(resource.absolutePath, newPath);
      const deleter: any = (this.fileService as any).deleteFile?.bind(this.fileService);
      if(deleter) await deleter(resource.absolutePath); else await fs.unlink(resource.absolutePath);
      resource.absolutePath = newPath;
      (resource as any).disabled = true;
      resource.state = ResourceState.INACTIVE;
      return { success:true, resource, message:'Disabled user resource' };
    } catch(e:any){ return { success:false, resource, message:'Disable failed', details: e?.message }; }
  }
  async enableUserResource(resource: Resource): Promise<OperationResult>{
    if(resource.origin !== 'user') return { success:false, resource, message:'Only user resources can be enabled' };
    if(!resource.disabled) return { success:true, resource, message:'Already enabled' };
    try {
      const dir = path.dirname(resource.absolutePath);
      let base = path.basename(resource.absolutePath);
      if(base.toLowerCase().endsWith('.disabled')) base = base.slice(0, -('.disabled'.length));
      const newPath = path.join(dir, base);
      await (this.fileService as any).copyFile(resource.absolutePath, newPath);
      const deleter: any = (this.fileService as any).deleteFile?.bind(this.fileService);
      if(deleter) await deleter(resource.absolutePath); else await fs.unlink(resource.absolutePath);
      resource.absolutePath = newPath;
      (resource as any).disabled = false;
      resource.state = ResourceState.ACTIVE;
      return { success:true, resource, message:'Enabled user resource' };
    } catch(e:any){ return { success:false, resource, message:'Enable failed', details: e?.message }; }
  }

  // --- MCP helpers ---
  private stripJsonComments(s: string): string {
    // Remove // and /* */ comments in a simplistic but effective way for well-formed files
    return s
      .replace(/(^|\s)\/\/.*$/gm, '$1')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }
  private parseMcpConfig(raw: string): any {
    try {
      const text = this.stripJsonComments(raw);
      const obj = JSON.parse(text || '{}');
      // Normalize shape
      const servers = obj.servers && typeof obj.servers === 'object' ? obj.servers : (obj["mcpServers"] && typeof obj["mcpServers"] === 'object' ? obj["mcpServers"] : {});
      const inputs = Array.isArray(obj.inputs) ? obj.inputs : [];
      return { inputs, servers };
    } catch {
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
