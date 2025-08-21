import { ResourceService } from '../src/services/resourceService';
import { MockFileService } from './fileService.mock';
import { Repository, Resource, ResourceCategory, ResourceState } from '../src/models';
import * as path from 'path';

async function run(){
  const repo: Repository = { id:'repo', name:'repo', rootPath:'/repo', catalogPath:'/repo/copilot_catalog', runtimePath:'/repo/.github', isActive:true };
  const catalogMcpPath = '/repo/copilot_catalog/mcp/github.mcp.json';
  const localMcpPath = path.join(repo.rootPath, '.vscode/mcp.json');
  const src = JSON.stringify({
    inputs: [{ id: 'perplexity-key', type: 'promptString', password: true }],
    servers: {
      Github: { url: 'https://api.githubcopilot.com/mcp/' },
      Perplexity: { type: 'stdio', command: 'npx', args: ['-y','server-perplexity-ask'], env: { PERPLEXITY_API_KEY: '${input:perplexity-key}' } }
    }
  });
  const fs = new MockFileService({ [catalogMcpPath]: src });
  const svc = new ResourceService(fs as any);
  const resources = await svc.discoverResources(repo);
  const mcpRes = resources.find(r=> r.category===ResourceCategory.MCP);
  if(!mcpRes) throw new Error('No MCP resource discovered');
  // Initially inactive
  const st0 = await svc.getResourceState(mcpRes);
  if(st0 !== ResourceState.INACTIVE) throw new Error('Expected MCP inactive initially');
  // Activate (merge)
  const res1 = await svc.activateResource(mcpRes);
  if(!res1.success) throw new Error('Activation failed: '+res1.details);
  const st1 = await svc.getResourceState(mcpRes);
  if(st1 !== ResourceState.ACTIVE) throw new Error('Expected MCP active after activation');
  // Activate again should remain active and not drop existing
  const res2 = await svc.activateResource(mcpRes);
  if(!res2.success) throw new Error('Re-activation failed: '+res2.details);
  const st2 = await svc.getResourceState(mcpRes);
  if(st2 === ResourceState.INACTIVE) throw new Error('Unexpected inactive after re-activation');
  // Deactivate should remove catalog entries but not delete file or user entries
  const res3 = await svc.deactivateResource(mcpRes);
  if(!res3.success) throw new Error('Deactivation failed: '+res3.details);
  const exists = await fs.pathExists(localMcpPath);
  if(!exists) throw new Error('mcp.json should remain (not deleted)');
  const raw = await fs.readFile(localMcpPath);
  const cfg = JSON.parse(raw);
  if(cfg.servers && Object.keys(cfg.servers).length !== 0){
    throw new Error('Expected catalog servers removed');
  }
  console.log('mcpMerge.test OK');
}

run().catch(e=>{ console.error('mcpMerge.test FAIL', e); process.exit(1); });
