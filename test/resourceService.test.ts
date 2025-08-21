import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { Repository, ResourceCategory } from '../src/models';
import * as path from 'path';
import { sanitizeFilename, isSafeRelativeEntry } from '../src/utils/security';

async function run(){
  const repo: Repository = { id:'repo', name:'repo', rootPath:'/repo', catalogPath:'/repo/copilot_catalog', runtimePath:'/repo/.github', isActive:true };
  const structure: Record<string,string> = {
    '/repo/copilot_catalog/chatmodes/a.chatmode.md': 'A',
    '/repo/.github/chatmodes/custom.chatmode.md': 'User Custom',
    '/repo/copilot_catalog/prompts/x.prompt.md': 'PX'
  };
  const fs = new MockFileService(structure);
  const svc = new ResourceService(fs as any);
  const resources = await svc.discoverResources(repo);
  const names = resources.map(r=>`${r.origin}:${path.basename(r.absolutePath)}`).sort();
  if(!names.find(n=> n.includes('user:custom.chatmode.md'))) throw new Error('Missing user resource');
  if(!names.find(n=> n.includes('catalog:a.chatmode.md'))) throw new Error('Missing catalog resource');
  console.log('resourceService.test OK', names);
}

run().catch(e=>{ console.error('resourceService.test FAIL', e); process.exit(1); });

// Basic security util sanity
if(sanitizeFilename('..///evil.txt') !== 'evil.txt') { console.error('sanitizeFilename failed'); process.exit(1); }
if(isSafeRelativeEntry('../bad')) { console.error('isSafeRelativeEntry failed'); process.exit(1); }
