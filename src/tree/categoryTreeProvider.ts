// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { getVSCode } from '../utils/vscode';
import { CatalogTreeItem, Repository, Resource, ResourceCategory, ResourceState, ResourceGroup } from '../models';
import { computeIconId } from './catalogTreeProvider';
import { getDisplayName } from '../utils/display';

const vscode = getVSCode();

export class CategoryTreeProvider {
  private _onDidChangeTreeData = vscode ? new vscode.EventEmitter<CatalogTreeItem|void>() : { fire: (_?:any)=>{} } as any;
  readonly onDidChangeTreeData = (this._onDidChangeTreeData as any).event || (()=>{});
  private resources: Resource[] = [];
  private repo?: Repository;
  private catalogFilter?: string;
  private resourceGroups: ResourceGroup[] = [];
  private resourceService?: any; // Will be injected to avoid circular dependency
  
  constructor(private category: ResourceCategory) {}
  
  // Public getter for resource groups
  get groups(): ResourceGroup[] {
    return this.resourceGroups;
  }
  
  setResourceService(resourceService: any) {
    this.resourceService = resourceService;
  }
  
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
    
    // Build resource groups if we have a resource service
    if (this.resourceService && this.resourceService.buildResourceGroups) {
      this.resourceGroups = this.resourceService.buildResourceGroups(resources, this.category);
    } else {
      this.resourceGroups = [];
    }
    
    this.refresh(); 
  }
  
  refresh(){ this._onDidChangeTreeData.fire(); }
  getTreeItem(e: CatalogTreeItem){ return e; }
  
  getChildren(e?: CatalogTreeItem): CatalogTreeItem[] {
    if(!this.repo){
      return [this.placeholderItem('No repository found with a ContextShare catalog.')];
    }
    
    if(this.resources.length === 0){
      return [this.placeholderItem(`No ${this.category} resources found.`)];
    }
    
    // Check if this is a group item
    if (e && (e as any).contextValue === 'resource-group') {
      const groupId = (e as any).id;
      const group = this.findGroupById(groupId);
      if (group) {
        return this.getGroupChildren(group);
      }
      return [];
    }
    
    // Root level - show groups if they exist, otherwise show resources directly
    if (this.resourceGroups.length > 0) {
      const items: CatalogTreeItem[] = [];
      
      // Add group items
      for (const group of this.resourceGroups) {
        const groupItem = this.createGroupItem(group);
        items.push(groupItem);
      }
      
      // Add ungrouped resources (those without groupPath)
      const ungroupedResources = this.resources.filter(r => !r.groupPath);
      for (const resource of ungroupedResources) {
        const resourceItem = this.createResourceItem(resource);
        items.push(resourceItem);
      }
      
      return items;
    } else {
      // No groups, show all resources directly
      return this.resources.map(r => this.createResourceItem(r));
    }
  }
  
  private findGroupById(groupId: string): ResourceGroup | undefined {
    // Recursive search through groups and their children
    const searchInGroups = (groups: ResourceGroup[]): ResourceGroup | undefined => {
      for (const group of groups) {
        if (group.id === groupId) {
          return group;
        }
        if (group.children && group.children.length > 0) {
          const found = searchInGroups(group.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    
    return searchInGroups(this.resourceGroups);
  }
  
  private getGroupChildren(group: ResourceGroup): CatalogTreeItem[] {
    const items: CatalogTreeItem[] = [];
    
    // Add child groups first
    if (group.children && group.children.length > 0) {
      for (const childGroup of group.children) {
        const groupItem = this.createGroupItem(childGroup);
        items.push(groupItem);
      }
    }
    
    // Add direct resources
    for (const resource of group.resources) {
      const resourceItem = this.createResourceItem(resource);
      items.push(resourceItem);
    }
    
    return items;
  }
  
  private createGroupItem(group: ResourceGroup): CatalogTreeItem {
    const activeCount = group.resources.filter((r: Resource) => r.state === ResourceState.ACTIVE).length;
    const totalCount = group.resources.length;
    const hasChildren = (group.children && group.children.length > 0) || group.resources.length > 0;
    
    let label = group.name;
    if (totalCount > 0) {
      label += ` (${activeCount}/${totalCount})`;
    }
    
    const ti = new CatalogTreeItem(
      label, 
      vscode && hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : (hasChildren ? 1 : 0), 
      { type: 'resource-group' }
    );
    
    (ti as any).id = group.id;
    ti.contextValue = 'resource-group';
    (ti as any).tooltip = `Group: ${group.name}`;
    
    // Set icon based on group state
    let iconId: string | undefined;
    if (group.enabled) {
      iconId = 'check'; // Use checkmark for fully enabled groups
    } else if (group.partiallyEnabled) {
      iconId = 'warning'; // Use warning for partially enabled groups
    } else {
      iconId = 'folder'; // Use a regular folder icon for disabled groups
    }
    
    if (iconId && vscode) {
      (ti as any).iconPath = new vscode.ThemeIcon(iconId);
    }
    
    return ti;
  }
  
  private createResourceItem(resource: Resource): CatalogTreeItem {
    const label = this.decorateLabel(resource);
    const ti = new CatalogTreeItem(label, vscode ? vscode.TreeItemCollapsibleState.None : 0, { type:'resource', resourceState: resource.state});
    (ti as any).id = resource.id;
    (ti as any).tooltip = resource.state === ResourceState.ACTIVE ? `Deactivate ${resource.relativePath}` : `Activate ${resource.relativePath}`;
    
    const iconId = computeIconId(resource);
    if(iconId && vscode) (ti as any).iconPath = new vscode.ThemeIcon(iconId);
    
    // Enable double-click open
    (ti as any).command = { command: 'copilotCatalog.openResource', title: 'Open Resource', arguments: [ti] };
    
    const suffix = resource.state === ResourceState.ACTIVE ? 'active' : resource.state === ResourceState.MODIFIED ? 'modified' : 'inactive';
    const isUser = (resource as any).origin === 'user';
    let context = isUser ? 'resource-user' : `resource-${suffix}`;
    if(isUser && (resource as any).disabled){ context = 'resource-user-disabled'; }
    ti.contextValue = context;
    (ti as any).viewItem = context;
    return ti;
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
