import { IFileService } from '../src/models';
import * as path from 'path';

export class MockFileService implements IFileService {
  private files = new Map<string,string>();
  private dirs = new Set<string>();
  constructor(structure: Record<string,string>){
    for(const [p,content] of Object.entries(structure)){
      const norm = path.resolve('/', p);
      this.files.set(norm, content);
      // register all ancestor directories
      let dir = path.dirname(norm);
      while(dir && !this.dirs.has(dir)) { this.dirs.add(dir); const parent = path.dirname(dir); if(parent===dir) break; dir = parent; }
    }
  }
  async readFile(p: string){ const norm = path.resolve(p); if(!this.files.has(norm)) throw new Error('missing'); return this.files.get(norm)!; }
  async writeFile(p: string, content: string){ const norm = path.resolve(p); this.files.set(norm, content); this.dirs.add(path.dirname(norm)); }
  async ensureDirectory(p: string){ this.dirs.add(path.resolve(p)); }
  async pathExists(p: string){ const norm = path.resolve(p); return this.files.has(norm) || this.dirs.has(norm); }
  async listDirectory(p: string){ const norm = path.resolve(p); const results = new Set<string>(); for(const f of this.files.keys()){ if(path.dirname(f)===norm) results.add(path.basename(f)); const dir = path.dirname(f); if(dir.startsWith(norm) && dir!==norm){ const child = dir.slice(norm.length+1).split(/[\\/]/)[0]; if(child) results.add(child); } } return [...results]; }
  async stat(p: string){ const norm = path.resolve(p); if(this.files.has(norm)) return 'file'; if(this.dirs.has(norm)) return 'dir'; return 'missing'; }
  async copyFile(src: string, dest: string){ const s = path.resolve(src); const d = path.resolve(dest); if(!this.files.has(s)) throw new Error('missing src'); this.files.set(d, this.files.get(s)!); this.dirs.add(path.dirname(d)); }
  async deleteFile(p: string){ const norm = path.resolve(p); this.files.delete(norm); }
}
