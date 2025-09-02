import { getVSCode } from '../utils/vscode';
import { CatalogTreeItem } from '../models';

const vscode = getVSCode();

type OptionNode = {
  id: string;
  label: string;
  icon?: string;
  command?: string;
  children?: OptionNode[];
};

export class OptionsTreeProvider {
  private _onDidChangeTreeData = (vscode ? new vscode.EventEmitter<CatalogTreeItem | void>() : { fire: (_?: any) => {} }) as any;
  readonly onDidChangeTreeData = (this._onDidChangeTreeData as any).event || (() => {});

  refresh() { this._onDidChangeTreeData.fire(); }
  getTreeItem(e: CatalogTreeItem) { return e; }

  getChildren(e?: CatalogTreeItem): CatalogTreeItem[] {
    if (!e) {
      // Root groups
      return this.buildNodes(this.getRootNodes());
    }
    const node: OptionNode | undefined = (e as any).__node;
    if (node?.children?.length) {
      return this.buildNodes(node.children);
    }
    return [];
  }

  private buildNodes(nodes: OptionNode[]): CatalogTreeItem[] {
    return nodes.map(n => {
      const collapsible = n.children && n.children.length > 0;
      const ti = new CatalogTreeItem(n.label, vscode ? (collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None) : (collapsible ? 1 : 0), { type: collapsible ? 'options-group' : 'options-command' });
      (ti as any).id = n.id;
      (ti as any).__node = n;
      if (n.icon && vscode) (ti as any).iconPath = new vscode.ThemeIcon(n.icon);
      if (n.command && vscode) (ti as any).command = { command: n.command, title: n.label };
      ti.contextValue = collapsible ? 'options-group' : 'options-command';
      return ti;
    });
  }

  private getRootNodes(): OptionNode[] {
    return [
      {
        id: 'catalog',
        label: 'Catalog',
        icon: 'library',
        children: [
          { id: 'catalog-refresh', label: 'Refresh', icon: 'refresh', command: 'copilotCatalog.refresh' },
          { id: 'catalog-filter', label: 'Filter by Catalog', icon: 'filter', command: 'copilotCatalog.filterCatalog' }
        ]
      },
      {
        id: 'hats',
        label: 'Hats',
        icon: 'kebab-vertical',
        children: [
          { id: 'hats-apply', label: 'Apply Hat (Preset)', icon: 'play', command: 'copilotCatalog.hats.apply' },
          { id: 'hats-save-workspace', label: 'Save Hat from Active (Workspace)', icon: 'save', command: 'copilotCatalog.hats.createWorkspace' },
          { id: 'hats-save-user', label: 'Save Hat from Active (User)', icon: 'account', command: 'copilotCatalog.hats.createUser' },
          { id: 'hats-delete', label: 'Delete Hat (Workspace/User)', icon: 'trash', command: 'copilotCatalog.hats.delete' }
        ]
      },
      {
        id: 'dev',
        label: 'Dev',
        icon: 'tools',
        children: [
          { id: 'dev-open-settings', label: 'Open Settings', icon: 'gear', command: 'copilotCatalog.openSettings' },
          { id: 'dev-create-template', label: 'Create Template Catalog', icon: 'new-folder', command: 'copilotCatalog.dev.createTemplateCatalog' },
          { id: 'dev-add-dir', label: 'Add Catalog Directory…', icon: 'folder-opened', command: 'copilotCatalog.addCatalogDirectory' },
          { id: 'dev-configure', label: 'Configure Source/Target Settings', icon: 'gear', command: 'copilotCatalog.dev.configureSettings' }
        ]
      }
    ];
  }
}
