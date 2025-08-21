import { MockFileService } from './fileService.mock';
import { ResourceService } from '../src/services/resourceService';
import { HatService } from '../src/services/hatService';
import { Repository, ResourceCategory } from '../src/models';
import * as path from 'path';

function repoFor(root: string): Repository {
  return { id: 'r', name: 'r', rootPath: root, catalogPath: path.join(root,'copilot_catalog'), runtimePath: path.join(root,'.github'), isActive: true };
}

(async function run(){
  const root = path.resolve('/ws');
  const files: Record<string,string> = {
    [path.join(root, 'copilot_catalog', 'chatmodes', 'a.chatmode.md')]: 'A',
    [path.join(root, 'copilot_catalog', 'instructions', 'b.instruction.md')]: 'B',
    [path.join(root, 'copilot_catalog', 'hats', 'ab.json')]: JSON.stringify({ name: 'AB', resources: [ 'chatmodes/a.chatmode.md', 'instructions/b.instruction.md' ]}, null, 2)
  };
  const fs = new MockFileService(files);
  const rs = new ResourceService(fs);
  const hats = new HatService(fs, rs, path.join(root, '.user'));
  const repo = repoFor(root);
  const resources = await rs.discoverResources(repo);
  const discovered = await hats.discoverHats(repo);
  if(discovered.length !== 1 || discovered[0].name !== 'AB') throw new Error('Hat discovery failed');
  const applyRes = await hats.applyHat(repo, resources, discovered[0]);
  if(!applyRes.success || applyRes.activated !== 2){
    console.error('applyRes', applyRes);
    throw new Error('Hat apply failed');
  }
  // Exclusive apply should deactivate any active not in hat (none at this moment because only two are active); still fine to call
  const applyExclusive = await hats.applyHat(repo, resources, discovered[0], { exclusive: true });
  if(!applyExclusive.success){ throw new Error('Exclusive hat apply failed'); }
  // Save from active to workspace
  const created = await hats.createHatFromActive('WS', 'desc', resources, 'workspace', repo);
  if(created.name !== 'WS') throw new Error('Create hat failed');
  const wsFile = path.join(root, '.vscode', 'copilot-hats.json');
  const wsExists = await fs.pathExists(wsFile);
  if(!wsExists) throw new Error('Workspace hats file not written');
  // Create a user hat as well
  await hats.createHatFromActive('USR', undefined, resources, 'user');
  const userFile = path.join(root, '.user', 'hats.json');
  const userExists = await fs.pathExists(userFile);
  if(!userExists) throw new Error('User hats file not written');
  // Delete both
  const wsHats = await hats.listWorkspaceHats(repo);
  const usrHats = await hats.listUserHats();
  const delWs = await hats.deleteHat(wsHats.find(h=> h.name==='WS')!, repo);
  const delUsr = await hats.deleteHat(usrHats.find(h=> h.name==='USR')!);
  if(!delWs || !delUsr) throw new Error('Delete hat failed');
  console.log('hats.test PASS');
})().catch(e=>{ console.error('hats.test FAIL', e); process.exit(1); });
