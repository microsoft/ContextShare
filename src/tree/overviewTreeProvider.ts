// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { getVSCode } from '../utils/vscode';
import { CatalogTreeItem, Repository, Resource, ResourceState } from '../models';

const vscode = getVSCode();

export class OverviewTreeProvider {
  private _onDidChangeTreeData = vscode ? new vscode.EventEmitter<CatalogTreeItem|void>() : { fire: (_?:any)=>{} } as any;
  readonly onDidChangeTreeData = (this._onDidChangeTreeData as any).event || (()=>{});
  private resources: Resource[] = [];
  private repo?: Repository;
  private catalogFilter?: string;
  
  setCatalogFilter(filter?: string) {
    this.catalogFilter = filter;
    this.refresh();
  }
  
  setRepository(repo: Repository|undefined, resources: Resource[]){ 
    this.repo = repo; 
    // Apply catalog filter if set
    this.resources = resources.filter(r => {
      if (this.catalogFilter && r.catalogName !== this.catalogFilter) return false;
      return true;
    });
    this.refresh(); 
  }
  
  refresh(){ this._onDidChangeTreeData.fire(); }
  getTreeItem(e: CatalogTreeItem){ return e; }
  
  getChildren(e?: CatalogTreeItem): CatalogTreeItem[] {
    if(!this.repo){
      return [
        this.infoItem('Welcome to ContextShare'),
        this.infoItem(''),
  this.infoItem('No repository found with a ContextShare catalog.'),
        this.infoItem('Use the Dev menu to create a template catalog.')
            ];
    }
    
    if(this.resources.length === 0){
      return [
        this.infoItem('No catalog resources discovered.'),
        this.infoItem(''),
        this.infoItem('Use the Refresh button or check settings.'),
        this.infoItem('Ensure your catalog directory contains:'),
        this.infoItem('• chatmodes/'),
        this.infoItem('• instructions/'), 
        this.infoItem('• prompts/'),
        this.infoItem('• tasks/'),
        this.infoItem('• mcp/')
      ];
    }
    
    // Show summary when resources exist
    const summary = this.generateSummary();
    return [
      this.infoItem('Catalog Summary'),
      this.infoItem(''),
      ...summary
    ];
  }
  
  private generateSummary(): CatalogTreeItem[] {
    const categories = ['chatmodes', 'instructions', 'prompts', 'tasks', 'mcp'];
    const items: CatalogTreeItem[] = [];
    
    // Show current filter if active
    if (this.catalogFilter) {
      items.push(this.infoItem(`Filter: ${this.catalogFilter}`));
      items.push(this.infoItem(''));
    }
    
    for(const cat of categories) {
      const categoryResources = this.resources.filter(r => r.category === cat);
      const active = categoryResources.filter(r => r.state === ResourceState.ACTIVE).length;
      const total = categoryResources.length;
      
      if(total > 0) {
        items.push(this.infoItem(`${cat}: ${active}/${total} active`));
      }
    }
    
    const totalActive = this.resources.filter(r => r.state === ResourceState.ACTIVE).length;
    const totalResources = this.resources.length;
    
    items.push(this.infoItem(''));
    items.push(this.infoItem(`Total: ${totalActive}/${totalResources} active`));
    
    // Show available catalogs
    const catalogs = new Set(this.resources.map(r => r.catalogName).filter(Boolean));
    if (catalogs.size > 1) {
      items.push(this.infoItem(''));
      items.push(this.infoItem('Available Catalogs:'));
      Array.from(catalogs).forEach(catalog => {
        items.push(this.infoItem(`• ${catalog}`));
      });
    }
    
    return items;
  }
  
  private infoItem(message: string): CatalogTreeItem {
    const item = new CatalogTreeItem(message, vscode ? vscode.TreeItemCollapsibleState.None : 0, { type:'info'});
    if(vscode && message && !message.startsWith('•') && message !== '') {
      (item as any).iconPath = new vscode.ThemeIcon('info');
    }
    item.contextValue = 'info';
    return item;
  }
}
