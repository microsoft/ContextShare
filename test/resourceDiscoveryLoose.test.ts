import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { Repository } from '../src/models';
import * as path from 'path';

async function run(){
  const repo: Repository = { id:'repo', name:'repo', rootPath:'/repo', catalogPath:'/repo/copilot_catalog', runtimePath:'/repo/.github', isActive:true };
  // Place files directly under catalog root (and nested arbitrary) without category folders
  const structure: Record<string,string> = {
    '/repo/copilot_catalog/my_custom_chatmode.chatmode.md': 'ChatMode',
    '/repo/copilot_catalog/notes/instruction_overview.INSTRUCTION.MD': 'Instruction',
    '/repo/copilot_catalog/random/prompt_welcome.PROMPT.md': 'Prompt',
    '/repo/copilot_catalog/task_build.task.Md': 'Task file'
  };
  const fs = new MockFileService(structure);
  const svc = new ResourceService(fs as any);
  const resources = await svc.discoverResources(repo);
  const byCat: Record<string,number> = {};
  for(const r of resources){ byCat[r.category] = (byCat[r.category]||0)+1; }
  if(!resources.find(r=> path.basename(r.absolutePath)==='my_custom_chatmode.chatmode.md')) throw new Error('Chatmode file not discovered');
  if(!resources.find(r=> /instruction_overview/i.test(r.absolutePath))) throw new Error('Instruction file not discovered');
  if(!resources.find(r=> /prompt_welcome/i.test(r.absolutePath))) throw new Error('Prompt file not discovered');
  if(!resources.find(r=> /task_build/i.test(r.absolutePath))) throw new Error('Task file not discovered');
  // Ensure each was categorized even though no folder structure
  const expectedCats = ['chatmodes','instructions','prompts','tasks'];
  for(const c of expectedCats){ if(!byCat[c]) throw new Error('Expected category missing '+c); }
  console.log('resourceDiscoveryLoose.test OK', resources.length, 'resources');
}
run().catch(e=>{ console.error('resourceDiscoveryLoose.test FAIL', e); process.exit(1); });
