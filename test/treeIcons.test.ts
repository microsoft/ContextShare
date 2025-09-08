// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { computeIconId } from '../src/tree/catalogTreeProvider';
import { ResourceState, Resource, ResourceCategory, Repository } from '../src/models';
import { createTestRunner, logTestSuccess } from './testUtils';

const repo: Repository = { id:'r', name:'r', rootPath:'/r', catalogPath:'/r/copilot_catalog', runtimePath:'/r/.github', isActive:true };

function makeResource(state: ResourceState, origin: any = 'catalog'): Resource {
  return { id: 'id', relativePath: 'chatmodes/x.chatmode.md', absolutePath: '/r/copilot_catalog/chatmodes/x.chatmode.md', category: ResourceCategory.CHATMODES, targetSubdir: 'chatmodes', repository: repo, state, origin } as any;
}

async function run(){
  if(computeIconId(makeResource(ResourceState.INACTIVE)) !== undefined) throw new Error('Inactive should map to undefined (no icon)');
  if(computeIconId(makeResource(ResourceState.ACTIVE)) !== 'check') throw new Error('Active should map to check (checkmark icon)');
  if(computeIconId(makeResource(ResourceState.MODIFIED)) !== 'warning') throw new Error('Modified should map to warning');
  if(computeIconId(makeResource(ResourceState.ACTIVE, 'user')) !== 'person') throw new Error('User origin (enabled) should map to person');
  
  // Test disabled user resource
  const disabledUser = makeResource(ResourceState.ACTIVE, 'user');
  (disabledUser as any).disabled = true;
  if(computeIconId(disabledUser) !== 'circle-slash') throw new Error('Disabled user resource should map to circle-slash');
  
  logTestSuccess('treeIcons');
}

createTestRunner('treeIcons', run);
