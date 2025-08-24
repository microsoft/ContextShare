import { getVSCode } from '../utils/vscode';
import { CatalogTreeItem, Repository, Resource, ResourceCategory, ResourceState } from '../models';
import { computeIconId } from './catalogTreeProvider';
import { getDisplayName } from '../utils/display';

const vscode = getVSCode();

export class CategoryTreeProvider {
  private _onDidChangeTreeData = vscode ? new vscode.EventEmitter<CatalogTreeItem|void>() : { fire: (_?:any)=>{} } as any;
  readonly onDidChangeTreeData = (this._onDidChangeTreeData as any).event || (()=>{});
  private resources: Resource[] = [];
  private repo?: Repository;
  private catalogFilter?: string;
  
  constructor(private category: ResourceCategory) {}
  
  setCatalogFilter(filter?: string) {
    this.catalogFilter = filter;
    this.refresh();
  }
  
  setRepository(repo: Repository|undefined, resources: Resource[]){ 
    this.repo = repo; 
    // Filter by category and optionally by catalog name
    this.resources = resources.filter(r => {
      if (r.category !== this.category) return false;
      if (this.catalogFilter && r.catalogName !== this.catalogFilter) return false;
      return true;
    });
    this.refresh(); 
  }
  
  refresh(){ this._onDidChangeTreeData.fire(); }
  getTreeItem(e: CatalogTreeItem){ return e; }
  
  getChildren(e?: CatalogTreeItem): CatalogTreeItem[] {
    if(!this.repo){
      return [this.placeholderItem('No repository found with a copilot catalog.')];
    }
    
    if(this.resources.length === 0){
      return [this.placeholderItem(`No ${this.category} resources found.`)];
    }
    
    // Return resources directly (no grouping needed since this is category-specific)
    return this.resources.map(r => {
      const label = this.decorateLabel(r);
      const ti = new CatalogTreeItem(label, vscode ? vscode.TreeItemCollapsibleState.None : 0, { type:'resource', resourceState: r.state});
      (ti as any).id = r.id;
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
  
  private placeholderItem(message: string){
    const item = new CatalogTreeItem(message, vscode ? vscode.TreeItemCollapsibleState.None : 0, { type:'placeholder'});
    if(vscode) (item as any).iconPath = new vscode.ThemeIcon('info');
    item.contextValue = 'placeholder';
    return item;
  }
  
  private decorateLabel(r: Resource){ 
    const filename = r.relativePath.split(/[\\/]/).pop() || r.relativePath;
    const base = getDisplayName(filename, r.category);
    let label = base;
    
    if((r as any).origin==='user'){ 
      label = (r as any).disabled ? `${base} (user, disabled)` : `${base} (user)`; 
    }
    
    // Add catalog name if available and not filtered
    if (r.catalogName && !this.catalogFilter) {
      label += ` [${r.catalogName}]`;
    }
    
    return label;
  }
}
