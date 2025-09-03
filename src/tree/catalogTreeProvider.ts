import { getVSCode } from '../utils/vscode';
import { CatalogTreeItem, Repository, Resource, ResourceCategory, ResourceState } from '../models';
import { getDisplayName } from '../utils/display';

const vscode = getVSCode();

interface CategoryGroup { category: ResourceCategory; resources: Resource[]; }
// Export a pure helper so tests (which do not load the full VS Code host) can validate
// icon selection logic without depending on ThemeIcon objects.
export function computeIconId(resource: Resource): string | undefined {
  if((resource as any).origin === 'user'){
    if((resource as any).disabled) return 'circle-slash';
    return 'person'; // Use person icon for enabled user resources
  }
  switch(resource.state){
    case ResourceState.ACTIVE: return 'check'; // Show checkmark for active resources
    case ResourceState.MODIFIED: return 'warning';
    // Inactive: no icon (cleaner UI)
    default: return undefined;
  }
}

export class CatalogTreeProvider {
  private _onDidChangeTreeData = vscode ? new vscode.EventEmitter<CatalogTreeItem|void>() : { fire: (_?:any)=>{} } as any;
  readonly onDidChangeTreeData = (this._onDidChangeTreeData as any).event || (()=>{});
  private resources: Resource[] = [];
  private repo?: Repository;
  setRepository(repo: Repository|undefined, resources: Resource[]){ this.repo = repo; this.resources = resources; this.refresh(); }
  refresh(){ this._onDidChangeTreeData.fire(); }
  getTreeItem(e: CatalogTreeItem){ return e; }
  getChildren(e?: CatalogTreeItem){
    // Root level
    if(!e){
      if(!this.repo){
  return [this.placeholderItem('No repository found with a ContextHub catalog.')];
      }
      if(this.resources.length === 0){
        return [this.placeholderItem('No catalog resources discovered. Use Refresh or check settings.')];
      }
      const groups: CategoryGroup[] = [];
      for(const category of Object.values(ResourceCategory)){
        const rs = this.resources.filter(r=> r.category===category);
        if(rs.length===0) continue;
        groups.push({category, resources: rs});
      }
  const items: CatalogTreeItem[] = [];
  for(let i=0; i<groups.length; i++){
        const g = groups[i];
        const active = g.resources.filter(r=> r.state===ResourceState.ACTIVE).length;
        const label = `${g.category} (${active}/${g.resources.length})`;
  const item = new CatalogTreeItem(label, vscode ? vscode.TreeItemCollapsibleState.Expanded : 1, { type:'category'});
        (item as any).id = `${this.repo?.id}:${g.category}`;
    items.push(item);
    // Add a subtle modern dot divider BETWEEN groups (not after the last)
    if(i < groups.length - 1){
      const dividerLabel = '• • • • • • • • • • • • • • • • • • • •';
      const divider = new CatalogTreeItem(dividerLabel, vscode ? vscode.TreeItemCollapsibleState.None : 0, { type:'divider'});
      (divider as any).contextValue = 'divider';
      (divider as any).command = undefined;
      if(vscode) (divider as any).iconPath = undefined;
      items.push(divider);
    }
  }
  return items;
    }
    // Category level
    if(e && (e as any).contextValue==='category'){
      const labelVal = (e as any).label as string;
      const [catName] = labelVal?.toString().split(' ') ?? [];
      const category = catName as ResourceCategory;
  return this.resources.filter(r=> r.category===category).map(r=>{
        const label = this.decorateLabel(r);
  const ti = new CatalogTreeItem(label, vscode ? vscode.TreeItemCollapsibleState.None : 0, { type:'resource', resourceState: r.state});
        (ti as any).id = r.id;
        // Opening handled by dedicated command (copilotCatalog.openResource) to enforce read-only behavior
        (ti as any).tooltip = r.state === ResourceState.ACTIVE ? `Deactivate ${r.relativePath}` : `Activate ${r.relativePath}`;
        const iconId = computeIconId(r);
  if(iconId && vscode) (ti as any).iconPath = new vscode.ThemeIcon(iconId);
  // Enable double-click open
  (ti as any).command = { command: 'copilotCatalog.openResource', title: 'Open Resource', arguments: [ti] };
  const suffix = r.state === ResourceState.ACTIVE ? 'active' : r.state === ResourceState.MODIFIED ? 'modified' : 'inactive';
  const isUser = (r as any).origin === 'user';
  let context = isUser ? 'resource-user' : `resource-${suffix}`;
  if(isUser && (r as any).disabled){ context = 'resource-user-disabled'; }
        ti.contextValue = context;
        (ti as any).viewItem = context;
        return ti;
      });
    }
    return [];
  }
  private placeholderItem(message: string){
  const item = new CatalogTreeItem(message, vscode ? vscode.TreeItemCollapsibleState.None : 0, { type:'placeholder'});
  if(vscode) (item as any).iconPath = new vscode.ThemeIcon('info');
    item.contextValue = 'placeholder';
    return item;
  }
  private decorateLabel(r: Resource){ 
    const filename = r.relativePath.split(/[\\/]/).pop() || r.relativePath;
    const base = getDisplayName(filename, r.category);
    if((r as any).origin==='user'){ 
      return (r as any).disabled ? `${base} (user, disabled)` : `${base} (user)`; 
    } 
    return base; 
  }
  // Deprecated internal method retained for backward compatibility (not used now).
  private iconForState(state: ResourceState){ if(!vscode) return undefined as any; switch(state){ case ResourceState.ACTIVE: return undefined; case ResourceState.MODIFIED: return new vscode.ThemeIcon('warning'); case ResourceState.INACTIVE: return new vscode.ThemeIcon('lock'); default: return undefined; } }
}
