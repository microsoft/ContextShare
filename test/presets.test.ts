// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { MockFileService } from './fileService.mock';
import { ResourceService } from '../src/services/resourceService';
import { PresetService } from '../src/services/presetService';
import { Repository, ResourceCategory } from '../src/models';
import * as path from 'path';

function repoFor(root: string): Repository {
  return { id: 'r', name: 'r', rootPath: root, catalogPath: path.join(root,'copilot_catalog'), runtimePath: path.join(root,'.github'), isActive: true };
}

(async function run(){
  const root = path.resolve('/ws');
  const files: Record<string,string> = {
    [path.join(root, 'copilot_catalog', 'chatmodes', 'a.chatmode.md')]: 'A',
  [path.join(root, 'copilot_catalog', 'instructions', 'b.instructions.md')]: 'B',
  [path.join(root, 'copilot_catalog', 'presets', 'ab.json')]: JSON.stringify({ name: 'AB', resources: [ 'chatmodes/a.chatmode.md', 'instructions/b.instructions.md' ]}, null, 2)
  };
  const fs = new MockFileService(files);
  const rs = new ResourceService(fs);
  const presets = new PresetService(fs, rs, path.join(root, '.user'));
  const repo = repoFor(root);
  const resources = await rs.discoverResources(repo);
  const discovered = await presets.discoverPresets(repo);
  if(discovered.length !== 1 || discovered[0].name !== 'AB') throw new Error('Preset discovery failed');
  const applyRes = await presets.applyPreset(repo, resources, discovered[0]);
  if(!applyRes.success || applyRes.activated !== 2){
    console.error('applyRes', applyRes);
    throw new Error('Preset apply failed');
  }
  // Exclusive apply should deactivate any active not in preset (none at this moment because only two are active); still fine to call
  const applyExclusive = await presets.applyPreset(repo, resources, discovered[0], { exclusive: true });
  if(!applyExclusive.success){ throw new Error('Exclusive preset apply failed'); }
  // Save from active to workspace
  const created = await presets.createPresetFromActive('WS', 'desc', resources, 'workspace', repo);
  if(created.name !== 'WS') throw new Error('Create preset failed');
  const wsFile = path.join(root, '.vscode', 'copilot-presets.json');
  const wsExists = await fs.pathExists(wsFile);
  if(!wsExists) throw new Error('Workspace presets file not written');
  // Create a user preset as well
  await presets.createPresetFromActive('USR', undefined, resources, 'user');
  const userFile = path.join(root, '.user', 'presets.json');
  const userExists = await fs.pathExists(userFile);
  if(!userExists) throw new Error('User presets file not written');
  // Delete both
  const wsPresets = await presets.listWorkspacePresets(repo);
  const usrPresets = await presets.listUserPresets();
  const delWs = await presets.deletePreset(wsPresets.find(h=> h.name==='WS')!, repo);
  const delUsr = await presets.deletePreset(usrPresets.find(h=> h.name==='USR')!);
  if(!delWs || !delUsr) throw new Error('Delete preset failed');
  console.log('presets.test PASS');
})().catch(e=>{ console.error('presets.test FAIL', e); process.exit(1); });
