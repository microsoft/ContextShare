// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as path from 'path';
import { Hat, HatSource, IFileService, Repository, Resource } from '../models';
import { ResourceService } from './resourceService';
import { logger } from '../utils/logger';

export class HatService {
  constructor(private fileService: IFileService, private resourceService: ResourceService, private userStorageRoot: string){ }

  // Discover hats from catalog (repo.catalogPath/hats/*.json), workspace (.vscode/copilot-hats.json), and user storage (<global>/hats.json)
  async discoverHats(repo: Repository): Promise<Hat[]>{
    const hats: Hat[] = [];
    // Catalog hats directory
    hats.push(...await this.readHatsFromDirectory(path.join(repo.catalogPath, 'hats'), 'catalog'));
    // Workspace hats file
    const workspaceFile = path.join(repo.rootPath, '.vscode', 'copilot-hats.json');
    hats.push(...await this.readHatsFromFile(workspaceFile, 'workspace'));
    // User hats file
    const userFile = path.join(this.userStorageRoot, 'hats.json');
    hats.push(...await this.readHatsFromFile(userFile, 'user'));
    // Ensure unique ids: prefix by source and filename when available
    const seen = new Set<string>();
    for(const h of hats){
      if(!h.id){ h.id = `${h.source}:${h.name}`; }
      let id = h.id; let i=1;
      while(seen.has(id)){ id = `${h.id}-${i++}`; }
      h.id = id; seen.add(id);
    }
    return hats;
  }

  async applyHat(repo: Repository, resources: Resource[], hat: Hat, options?: { exclusive?: boolean }): Promise<{success:boolean; activated:number; deactivated:number; missing:string[]; errors:string[]}>{
    const missing: string[] = [];
    const errors: string[] = [];
    let activated = 0;
    let deactivated = 0;
    const toSlash = (p: string) => p.replace(/\\/g,'/');
    const byRel = new Map<string, Resource>();
    for(const r of resources){ byRel.set(toSlash(r.relativePath), r); }
    // Resolve desired resource relative paths to Resource objects
    const desiredSet = new Set<string>(hat.resources.map(r=> toSlash(r)));
    if(options?.exclusive){
      // Deactivate any currently active (non-user) resource not in desired set
      for(const r of resources){
        const rel = toSlash(r.relativePath);
        if(r.state === 1 /* ACTIVE */ && (r as any).origin !== 'user' && !desiredSet.has(rel)){
          try{
            const res = await this.resourceService.deactivateResource(r);
            if(res.success) deactivated++; else errors.push(`${rel}: ${res.message}`);
          }catch(e:any){ errors.push(`${rel}: ${e?.message||e}`); }
        }
      }
    }
    for(const rel of hat.resources){
      const key = toSlash(rel);
      let target = byRel.get(key);
      if(!target){
        // Fallback: match by filename within same category prefix if provided
        const base = path.posix.basename(key);
        target = resources.find(r=> path.posix.basename(toSlash(r.relativePath)) === base) as any;
      }
      if(!target){ missing.push(rel); continue; }
      try{
        const res = await this.resourceService.activateResource(target);
        if(res.success) activated++; else errors.push(`${rel}: ${res.message}`);
      }catch(e:any){ errors.push(`${rel}: ${e?.message||e}`); }
    }
    return { success: errors.length===0, activated, deactivated, missing, errors };
  }

  async createHatFromActive(name: string, description: string|undefined, resources: Resource[], source: HatSource, repo?: Repository): Promise<Hat>{
    const rels = resources.filter(r=> r.state === 1 /* ACTIVE */ || (r as any).origin === 'user').map(r=> r.relativePath);
    const hat: Hat = { id: `${source}:${name}`, name, description, resources: Array.from(new Set(rels)), source };
    if(source === 'workspace' && repo){
      await this.saveHatToWorkspace(repo, hat);
    } else if(source === 'user'){
      await this.saveHatToUser(hat);
    }
    return hat;
  }

  async listWorkspaceHats(repo: Repository): Promise<Hat[]>{
    const wsFile = path.join(repo.rootPath, '.vscode', 'copilot-hats.json');
    return this.readHatsFromFile(wsFile, 'workspace');
  }
  async listUserHats(): Promise<Hat[]>{
    const userFile = path.join(this.userStorageRoot, 'hats.json');
    return this.readHatsFromFile(userFile, 'user');
  }

  async deleteHat(hat: Hat, repo?: Repository): Promise<boolean>{
    if(hat.source === 'workspace'){
      if(!repo) return false;
      const wsDir = path.join(repo.rootPath, '.vscode');
      const wsFile = path.join(wsDir, 'copilot-hats.json');
      const list = await this.readHatArrayFile(wsFile);
      const before = list.length;
      const filtered = list.filter(h=> (h?.name||'') !== hat.name);
      if(filtered.length === before) return false;
      await this.fileService.ensureDirectory(wsDir);
      await this.fileService.writeFile(wsFile, JSON.stringify(filtered, null, 2));
      return true;
    }
    if(hat.source === 'user'){
      const userFile = path.join(this.userStorageRoot, 'hats.json');
      const list = await this.readHatArrayFile(userFile);
      const before = list.length;
      const filtered = list.filter(h=> (h?.name||'') !== hat.name);
      if(filtered.length === before) return false;
      await this.fileService.ensureDirectory(this.userStorageRoot);
      await this.fileService.writeFile(userFile, JSON.stringify(filtered, null, 2));
      return true;
    }
    return false;
  }

  async saveHatToUser(hat: Hat): Promise<void>{
    const userFile = path.join(this.userStorageRoot, 'hats.json');
    const list = await this.readHatArrayFile(userFile);
    const filtered = list.filter(h=> h.name !== hat.name);
    filtered.push({ name: hat.name, description: hat.description, resources: hat.resources });
    await this.fileService.ensureDirectory(this.userStorageRoot);
    await this.fileService.writeFile(userFile, JSON.stringify(filtered, null, 2));
  }

  async saveHatToWorkspace(repo: Repository, hat: Hat): Promise<void>{
    const wsDir = path.join(repo.rootPath, '.vscode');
    const wsFile = path.join(wsDir, 'copilot-hats.json');
    const list = await this.readHatArrayFile(wsFile);
    const filtered = list.filter(h=> h.name !== hat.name);
    filtered.push({ name: hat.name, description: hat.description, resources: hat.resources });
    await this.fileService.ensureDirectory(wsDir);
    await this.fileService.writeFile(wsFile, JSON.stringify(filtered, null, 2));
  }

  private async readHatsFromDirectory(dir: string, source: HatSource): Promise<Hat[]>{
    const out: Hat[] = [];
    try{
      const entries = await this.fileService.listDirectory(dir);
      for(const name of entries){
        const full = path.join(dir, name);
        const st = await this.fileService.stat(full).catch(()=> 'missing');
        if(st !== 'file') continue;
        if(!name.toLowerCase().endsWith('.json')) continue;
        const parsed = await this.tryParseHatFile(full);
        if(parsed){ out.push({ ...parsed, source, id: `${source}:${parsed.name}`, definitionPath: full }); }
      }
    }catch{ /* no dir */ }
    return out;
  }

  private async readHatsFromFile(file: string, source: HatSource): Promise<Hat[]>{
    const list = await this.readHatArrayFile(file);
    return list.map(h=> ({ id: `${source}:${h.name}` , name: h.name, description: h.description, resources: h.resources||[], source, definitionPath: file }));
  }

  private async tryParseHatFile(file: string): Promise<{name:string; description?:string; resources:string[]} | undefined>{
    try{
      const raw = await this.fileService.readFile(file);
      const obj = JSON.parse(raw);
      if(obj && typeof obj==='object' && typeof obj.name==='string' && Array.isArray(obj.resources)){
        const description = typeof obj.description==='string' ? obj.description : undefined;
        const resources = obj.resources.filter((x:any)=> typeof x==='string');
        return { name: obj.name, description, resources };
      }
    }catch(error) { 
      await logger.warn(`[HatService] Failed to parse hat file: ${error}`);
    }
    return undefined;
  }

  private async readHatArrayFile(file: string): Promise<Array<{name:string; description?:string; resources:string[]}>>{
    try{
      const raw = await this.fileService.readFile(file);
      const arr = JSON.parse(raw);
      if(Array.isArray(arr)){
        return arr.filter(x=> x && typeof x.name==='string' && Array.isArray(x.resources));
      }
      return [];
    }catch{ return []; }
  }
}
