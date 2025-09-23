// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as path from 'path';
import { Preset, PresetSource, IFileService, Repository, Resource } from '../models';
import { ResourceService } from './resourceService';
import { logger } from '../utils/logger';

export class PresetService {
  constructor(private fileService: IFileService, private resourceService: ResourceService, private userStorageRoot: string){ }

  // Discover presets from catalog (repo.catalogPath/presets/*.json), workspace (.vscode/copilot-presets.json), and user storage (<global>/presets.json)
  async discoverPresets(repo: Repository): Promise<Preset[]>{
    const presets: Preset[] = [];
    // Catalog presets directory
    presets.push(...await this.readPresetsFromDirectory(path.join(repo.catalogPath, 'presets'), 'catalog'));
    // Workspace presets file
    const workspaceFile = path.join(repo.rootPath, '.vscode', 'copilot-presets.json');
    presets.push(...await this.readPresetsFromFile(workspaceFile, 'workspace'));
    // User presets file
    const userFile = path.join(this.userStorageRoot, 'presets.json');
    presets.push(...await this.readPresetsFromFile(userFile, 'user'));
    // Ensure unique ids: prefix by source and filename when available
    const seen = new Set<string>();
    for(const h of presets){
      if(!h.id){ h.id = `${h.source}:${h.name}`; }
      let id = h.id; let i=1;
      while(seen.has(id)){ id = `${h.id}-${i++}`; }
      h.id = id; seen.add(id);
    }
    return presets;
  }

  async applyPreset(repo: Repository, resources: Resource[], preset: Preset, options?: { exclusive?: boolean }): Promise<{success:boolean; activated:number; deactivated:number; missing:string[]; errors:string[]}>{
    const missing: string[] = [];
    const errors: string[] = [];
    let activated = 0;
    let deactivated = 0;
    const toSlash = (p: string) => p.replace(/\\/g,'/');
    const byRel = new Map<string, Resource>();
    for(const r of resources){ byRel.set(toSlash(r.relativePath), r); }
    // Resolve desired resource relative paths to Resource objects
    const desiredSet = new Set<string>(preset.resources.map(r=> toSlash(r)));
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
    for(const rel of preset.resources){
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

  async createPresetFromActive(name: string, description: string|undefined, resources: Resource[], source: PresetSource, repo?: Repository): Promise<Preset>{
    const rels = resources.filter(r=> r.state === 1 /* ACTIVE */ || (r as any).origin === 'user').map(r=> r.relativePath);
    const preset: Preset = { id: `${source}:${name}`, name, description, resources: Array.from(new Set(rels)), source };
    if(source === 'workspace' && repo){
      await this.savePresetToWorkspace(repo, preset);
    } else if(source === 'user'){
      await this.savePresetToUser(preset);
    }
    return preset;
  }

  async listWorkspacePresets(repo: Repository): Promise<Preset[]>{
    const wsFile = path.join(repo.rootPath, '.vscode', 'copilot-presets.json');
    return this.readPresetsFromFile(wsFile, 'workspace');
  }
  async listUserPresets(): Promise<Preset[]>{
    const userFile = path.join(this.userStorageRoot, 'presets.json');
    return this.readPresetsFromFile(userFile, 'user');
  }

  async deletePreset(preset: Preset, repo?: Repository): Promise<boolean>{
    if(preset.source === 'workspace'){
      if(!repo) return false;
      const wsDir = path.join(repo.rootPath, '.vscode');
      const wsFile = path.join(wsDir, 'copilot-presets.json');
      const list = await this.readPresetArrayFile(wsFile);
      const before = list.length;
      const filtered = list.filter(h=> (h?.name||'') !== preset.name);
      if(filtered.length === before) return false;
      await this.fileService.ensureDirectory(wsDir);
      await this.fileService.writeFile(wsFile, JSON.stringify(filtered, null, 2));
      return true;
    }
    if(preset.source === 'user'){
      const userFile = path.join(this.userStorageRoot, 'presets.json');
      const list = await this.readPresetArrayFile(userFile);
      const before = list.length;
      const filtered = list.filter(h=> (h?.name||'') !== preset.name);
      if(filtered.length === before) return false;
      await this.fileService.ensureDirectory(this.userStorageRoot);
      await this.fileService.writeFile(userFile, JSON.stringify(filtered, null, 2));
      return true;
    }
    return false;
  }

  async savePresetToUser(preset: Preset): Promise<void>{
    const userFile = path.join(this.userStorageRoot, 'presets.json');
    const list = await this.readPresetArrayFile(userFile);
    const filtered = list.filter(h=> h.name !== preset.name);
    filtered.push({ name: preset.name, description: preset.description, resources: preset.resources });
    await this.fileService.ensureDirectory(this.userStorageRoot);
    await this.fileService.writeFile(userFile, JSON.stringify(filtered, null, 2));
  }

  async savePresetToWorkspace(repo: Repository, preset: Preset): Promise<void>{
    const wsDir = path.join(repo.rootPath, '.vscode');
    const wsFile = path.join(wsDir, 'copilot-presets.json');
    const list = await this.readPresetArrayFile(wsFile);
    const filtered = list.filter(h=> h.name !== preset.name);
    filtered.push({ name: preset.name, description: preset.description, resources: preset.resources });
    await this.fileService.ensureDirectory(wsDir);
    await this.fileService.writeFile(wsFile, JSON.stringify(filtered, null, 2));
  }

  private async readPresetsFromDirectory(dir: string, source: PresetSource): Promise<Preset[]>{
    const out: Preset[] = [];
    try{
      const entries = await this.fileService.listDirectory(dir);
      for(const name of entries){
        const full = path.join(dir, name);
        const st = await this.fileService.stat(full).catch(()=> 'missing');
        if(st !== 'file') continue;
        if(!name.toLowerCase().endsWith('.json')) continue;
        const parsed = await this.tryParsePresetFile(full);
        if(parsed){ out.push({ ...parsed, source, id: `${source}:${parsed.name}`, definitionPath: full }); }
      }
    }catch{ /* no dir */ }
    return out;
  }

  private async readPresetsFromFile(file: string, source: PresetSource): Promise<Preset[]>{
    const list = await this.readPresetArrayFile(file);
    return list.map(h=> ({ id: `${source}:${h.name}` , name: h.name, description: h.description, resources: h.resources||[], source, definitionPath: file }));
  }

  private async tryParsePresetFile(file: string): Promise<{name:string; description?:string; resources:string[]} | undefined>{
    try{
      const raw = await this.fileService.readFile(file);
      const obj = JSON.parse(raw);
      if(obj && typeof obj==='object' && typeof obj.name==='string' && Array.isArray(obj.resources)){
        const description = typeof obj.description==='string' ? obj.description : undefined;
        const resources = obj.resources.filter((x:any)=> typeof x==='string');
        return { name: obj.name, description, resources };
      }
    }catch(error) { 
      await logger.warn(`[PresetService] Failed to parse preset file: ${error}`);
    }
    return undefined;
  }

  private async readPresetArrayFile(file: string): Promise<Array<{name:string; description?:string; resources:string[]}>>{
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
